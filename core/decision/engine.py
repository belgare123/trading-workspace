"""
Decision Engine (Phase 7) — центральное ядро скринера.

Объединяет:
  7.1 Signal Normalization
  7.2 Evidence Model
  7.3 Consensus
  7.4 Conflict Resolver
  7.5 Confidence Engine
  7.6 Opportunity Builder
  7.7 Decision Policy
  7.8 Decision Events
  + Strategy Weight Engine

Pipeline:
  Strategy signals → Normalizer → Consensus → Conflict Resolver →
    Confidence Engine → Policy → Opportunity Builder → Events
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable

from core.decision.confidence import ConfidenceEngine, MarketRegime
from core.decision.consensus import ConsensusEngine, ConsensusError
from core.decision.events import (
    DecisionEvent,
    DecisionEventType,
    EventBus,
    conflict_detected_event,
    consensus_changed_event,
    decision_taken_event,
    opportunity_created_event,
    opportunity_rejected_event,
)
from core.profiler import profile
from core.decision.models import (
    ConsensusResult,
    NormalizedSignal,
    Opportunity,
    OpportunityStatus,
    SignalDirection,
    StrategyWeight,
)
from core.decision.normalizer import NormalizationError, SignalNormalizer
from core.decision.opportunity import OpportunityBuildError, OpportunityBuilder
from core.decision.policy import DecisionPolicy, PolicyResult
from core.decision.weighting import StrategyWeightEngine

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  DecisionEngine
# ═══════════════════════════════════════════════════════════════════


class DecisionEngine:
    """Decision Engine — центральное ядро принятия решений.

    Получает сырые сигналы от стратегий, нормализует,
    вычисляет консенсус, разрешает конфликты, пересчитывает
    уверенность, проверяет политику и публикует Opportunities.

    Usage:
        engine = DecisionEngine()

        # Получение сигналов от стратегий
        raw_signals = [
            {"direction": "long", "score": 65, "confidence": 0.72},
            {"direction": "long", "score": 84, "confidence": 0.64},
        ]

        # Обработка
        result = engine.process(
            raw_signals={"Momentum": raw_signals[0], "ICT": raw_signals[1]},
            current_price=64500.0,
            symbol="BTCUSDT",
        )

        # Результат
        if result.opportunity:
            print(result.opportunity)
        if result.rejected:
            print(f"Rejected: {result.rejected_reason}")
    """

    def __init__(
        self,
        normalizer: SignalNormalizer | None = None,
        consensus_engine: ConsensusEngine | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        opportunity_builder: OpportunityBuilder | None = None,
        weight_engine: StrategyWeightEngine | None = None,
        event_bus: EventBus | None = None,
        default_policy: str = "moderate",
    ) -> None:
        self._normalizer = normalizer or SignalNormalizer()
        self._consensus = consensus_engine or ConsensusEngine()
        self._confidence = confidence_engine or ConfidenceEngine()
        self._builder = opportunity_builder or OpportunityBuilder()
        self._weights = weight_engine or StrategyWeightEngine()
        self._events = event_bus or EventBus()
        self._default_policy = default_policy

        # Кэш последнего консенсуса
        self._last_consensus: ConsensusResult | None = None

    # ── Properties ──

    @property
    def event_bus(self) -> EventBus:
        """EventBus для подписки на события."""
        return self._events

    @property
    def weight_engine(self) -> StrategyWeightEngine:
        """StrategyWeightEngine для управления весами."""
        return self._weights

    # ── Main processing pipeline ──

    @profile("decision_engine.process")
    def process(
        self,
        raw_signals: dict[str, dict[str, Any]],
        current_price: float,
        symbol: str = "",
        policy: str | None = None,
        regime: MarketRegime = MarketRegime.UNKNOWN,
        volatility: float = 0.0,
    ) -> "DecisionResult":
        """Полный пайплайн обработки сигналов.

        Args:
            raw_signals:  {strategy_name: raw_signal_dict}
            current_price: Текущая цена для расчёта entry/stop/targets.
            symbol:       Торговый инструмент.
            policy:       Имя политики (strict/moderate/aggressive).
            regime:       Рыночный режим.
            volatility:   Текущая волатильность.

        Returns:
            DecisionResult.
        """
        if not raw_signals:
            return DecisionResult(accepted=False, reason="No signals")

        policy_name = policy or self._default_policy

        # ── 7.1 Normalization ──
        normalized: list[NormalizedSignal] = []
        normalization_errors: dict[str, str] = {}

        for strategy_name, raw in raw_signals.items():
            try:
                sig = self._normalizer.normalize(strategy_name, raw)
                normalized.append(sig)
            except NormalizationError as e:
                normalization_errors[strategy_name] = str(e)
                logger.warning("Normalization failed for %s: %s", strategy_name, e)

        if not normalized:
            return DecisionResult(
                accepted=False,
                reason="All signals failed normalization",
                normalization_errors=normalization_errors,
            )

        # ── Weight map ──
        weight_map = self._weights.get_all_weights()
        strategy_weights = self._weights.get_weight_objects()

        # ── 7.3 Consensus ──
        try:
            consensus = self._consensus.compute(normalized, weights=weight_map)
        except ConsensusError as e:
            return DecisionResult(
                accepted=False,
                reason=f"Consensus error: {e}",
                signals=normalized,
                normalization_errors=normalization_errors,
            )

        # ── 7.4 Conflict Resolution ──
        old_consensus = self._last_consensus
        if consensus.is_conflict:
            resolved = self._consensus.resolve_conflict(
                consensus, normalized, weights=weight_map
            )
            if resolved.is_conflict != consensus.is_conflict:
                # Конфликт разрешён
                self._events.emit(consensus_changed_event(old_consensus, resolved))
                consensus = resolved
            else:
                # Конфликт не разрешён — события
                self._events.emit(conflict_detected_event(normalized, consensus))
                return DecisionResult(
                    accepted=False,
                    reason=f"Unresolved conflict: {consensus.details}",
                    consensus=consensus,
                    signals=normalized,
                    normalization_errors=normalization_errors,
                )

        if old_consensus and old_consensus.direction != consensus.direction:
            self._events.emit(consensus_changed_event(old_consensus, consensus))

        self._last_consensus = consensus

        # ── 7.6 Build Opportunity ──
        try:
            opportunity = self._builder.build(
                signals=normalized,
                consensus=consensus,
                current_price=current_price,
                symbol=symbol,
                strategy_weights=strategy_weights,
                regime=regime,
                volatility=volatility,
                policy=policy_name,
            )
        except OpportunityBuildError as e:
            return DecisionResult(
                accepted=False,
                reason=f"Opportunity build error: {e}",
                consensus=consensus,
                signals=normalized,
                normalization_errors=normalization_errors,
            )

        # ── 7.7 Policy Check ──
        try:
            dp = DecisionPolicy(policy_name)
        except ValueError as e:
            return DecisionResult(
                accepted=False,
                reason=str(e),
                opportunity=opportunity,
                consensus=consensus,
                signals=normalized,
                normalization_errors=normalization_errors,
            )

        policy_result = dp.evaluate(opportunity, consensus)

        if not policy_result:
            opportunity.status = OpportunityStatus.REJECTED
            self._events.emit(opportunity_rejected_event(opportunity, policy_result.reason))
            return DecisionResult(
                accepted=False,
                reason=f"Policy rejected: {policy_result.reason}",
                opportunity=opportunity,
                consensus=consensus,
                signals=normalized,
                normalization_errors=normalization_errors,
                policy_result=policy_result,
            )

        # ── Акцепт ──
        opportunity.status = OpportunityStatus.ACTIVE
        self._events.emit(opportunity_created_event(opportunity))

        return DecisionResult(
            accepted=True,
            reason="Decision accepted",
            opportunity=opportunity,
            consensus=consensus,
            signals=normalized,
            normalization_errors=normalization_errors,
            policy_result=policy_result,
        )

    def report_outcome(
        self,
        strategy: str,
        won: bool,
    ) -> None:
        """Сообщить результат сигнала стратегии для обновления веса.

        Args:
            strategy: Имя стратегии.
            won:      True если сигнал был успешным.
        """
        self._weights.update(strategy, won)

    # ── Direct signal processing (for strategy-engine → decision) ──

    def process_signal(
        self,
        strategy: str,
        raw_signal: dict[str, Any],
    ) -> NormalizedSignal:
        """Нормализовать одиночный сигнал.

        Args:
            strategy:   Имя стратегии.
            raw_signal: Сырой сигнал.

        Returns:
            NormalizedSignal.
        """
        return self._normalizer.normalize(strategy, raw_signal)


# ═══════════════════════════════════════════════════════════════════
#  DecisionResult
# ═══════════════════════════════════════════════════════════════════


@dataclass
class DecisionResult:
    """Результат обработки сигналов Decision Engine.

    Attributes:
        accepted:            True если решение принято (Opportunity создан).
        reason:              Причина решения.
        opportunity:         Созданная Opportunity (если accepted=True).
        consensus:           Результат консенсуса.
        signals:             Нормализованные сигналы.
        normalization_errors: Ошибки нормализации по стратегиям.
        policy_result:        Результат проверки политики.
    """

    accepted: bool
    reason: str = ""
    opportunity: Opportunity | None = None
    consensus: ConsensusResult | None = None
    signals: list[NormalizedSignal] = field(default_factory=list)
    normalization_errors: dict[str, str] = field(default_factory=dict)
    policy_result: PolicyResult | None = None

    @property
    def rejected(self) -> bool:
        return not self.accepted

    @property
    def rejected_reason(self) -> str:
        return self.reason

    def __bool__(self) -> bool:
        return self.accepted
