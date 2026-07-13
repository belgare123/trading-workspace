"""
Opportunity Builder (7.6) — создание торговых возможностей из консенсуса.

На основе ConsensusResult строит полноценный Opportunity:
  - entry_price, stop_loss, targets
  - confidence с пересчётом через ConfidenceEngine
  - evidence из всех сигналов
  - список стратегий участников
"""

from __future__ import annotations

import logging
from typing import Any

from core.decision.confidence import ConfidenceEngine
from core.decision.consensus import ConsensusEngine
from core.decision.models import (
    ConsensusResult,
    Evidence,
    NormalizedSignal,
    Opportunity,
    OpportunityStatus,
    SignalDirection,
    StrategyWeight,
)

logger = logging.getLogger(__name__)


class OpportunityBuildError(Exception):
    """Ошибка построения возможности."""


class OpportunityBuilder:
    """Строитель торговых возможностей.

    Usage:
        builder = OpportunityBuilder()
        opp = builder.build(
            signals=signals,
            consensus=consensus,
            current_price=64500.0,
            symbol="BTCUSDT",
        )
    """

    def __init__(
        self,
        confidence_engine: ConfidenceEngine | None = None,
        default_stop_pct: float = 0.5,
        default_target_pcts: list[float] | None = None,
    ) -> None:
        self._confidence_engine = confidence_engine or ConfidenceEngine()
        self._default_stop_pct = default_stop_pct  # 0.5%
        self._default_target_pcts = default_target_pcts or [0.8, 1.5]

    def build(
        self,
        signals: list[NormalizedSignal],
        consensus: ConsensusResult,
        current_price: float,
        symbol: str = "",
        strategy_weights: dict[str, StrategyWeight] | None = None,
        regime: Any = None,
        volatility: float = 0.0,
        policy: str = "moderate",
        entry_price: float | None = None,
        stop_loss: float | None = None,
        targets: list[float] | None = None,
    ) -> Opportunity:
        """Построить Opportunity на основе сигналов и консенсуса.

        Args:
            signals:          Нормализованные сигналы.
            consensus:        Результат консенсуса.
            current_price:    Текущая цена.
            symbol:           Торговый инструмент.
            strategy_weights: Веса стратегий (для confidence).
            regime:           Рыночный режим.
            volatility:       Волатильность.
            policy:           Имя Decision Policy.
            entry_price:      Принудительная цена входа.
            stop_loss:        Принудительный стоп-лосс.
            targets:          Принудительные цели.

        Returns:
            Opportunity.

        Raises:
            OpportunityBuildError: Если консенсус не дал направления.
        """
        if consensus.is_conflict:
            raise OpportunityBuildError(
                f"Cannot build opportunity: unresolved conflict "
                f"({consensus.conflict_type})"
            )

        if consensus.direction == SignalDirection.NEUTRAL:
            raise OpportunityBuildError(
                "Cannot build opportunity: consensus is NEUTRAL"
            )

        if not signals:
            raise OpportunityBuildError("No signals provided")

        # Entry price
        entry = entry_price if entry_price is not None else current_price

        # Stop loss
        if stop_loss is not None:
            stop = stop_loss
        else:
            direction_mult = 1.0 if consensus.direction == SignalDirection.LONG else -1.0
            stop = entry - (entry * self._default_stop_pct / 100.0 * direction_mult)

        # Targets
        if targets is not None:
            opp_targets = targets
        else:
            opp_targets = []
            direction_mult = 1.0 if consensus.direction == SignalDirection.LONG else -1.0
            for pct in self._default_target_pcts:
                opp_targets.append(
                    entry + (entry * pct / 100.0 * direction_mult)
                )

        # Evidence — собираем из всех сигналов (уникальные по label)
        seen_labels: set[str] = set()
        merged_evidence: list[Evidence] = []
        for sig in signals:
            for ev in sig.evidence:
                if ev.label not in seen_labels:
                    seen_labels.add(ev.label)
                    merged_evidence.append(ev)

        # Confidence — через ConfidenceEngine
        strategy_weight = None
        if strategy_weights and signals:
            main_strategy = signals[0].strategy
            sw = strategy_weights.get(main_strategy)
            if sw:
                strategy_weight = sw

        final_confidence = self._confidence_engine.compute(
            raw_confidence=consensus.confidence,
            consensus=consensus,
            strategy_weight=strategy_weight,
            regime=regime,
            volatility=volatility,
        )

        # Стратегии участники (уникальные)
        strategies = list(dict.fromkeys(s.strategy for s in signals))

        return Opportunity(
            direction=consensus.direction,
            entry_price=entry,
            stop_loss=stop,
            targets=opp_targets,
            confidence=final_confidence,
            evidence=merged_evidence,
            strategies=strategies,
            consensus=consensus,
            policy=policy,
            status=OpportunityStatus.PENDING,
            symbol=symbol,
        )
