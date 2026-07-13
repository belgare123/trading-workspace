"""
Consensus Engine (7.3) + Conflict Resolver (7.4).

- Consensus: определяет общее направление по массиву сигналов
- Conflict Resolver: разрешает конфликты (разные направления, слабая уверенность)
- Поддержка взвешенного голосования (Strategy Weight Engine)
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from core.decision.models import (
    ConflictType,
    ConsensusResult,
    NormalizedSignal,
    SignalDirection,
    StrategyWeight,
)

logger = logging.getLogger(__name__)


class ConsensusError(Exception):
    """Ошибка вычисления консенсуса."""


# ═══════════════════════════════════════════════════════════════════
#  Consensus Engine
# ═══════════════════════════════════════════════════════════════════


class ConsensusEngine:
    """Вычисление консенсуса на основе массива нормализованных сигналов.

    Поддерживает:
      - Простое голосование (один сигнал = один голос)
      - Взвешенное голосование (сигнал × вес стратегии)
      - Порог уверенности
      - Детекцию конфликтов

    Usage:
        engine = ConsensusEngine()
        result = engine.compute(signals, weights=weight_map)
        if result.is_conflict:
            result = engine.resolve_conflict(result, signals)
    """

    def __init__(self, min_agreement: float = 0.0, conflict_threshold: float = 0.6) -> None:
        self._min_agreement = min_agreement
        self._conflict_threshold = conflict_threshold

    def compute(
        self,
        signals: list[NormalizedSignal],
        weights: dict[str, float] | None = None,
    ) -> ConsensusResult:
        """Вычислить консенсус по массиву сигналов.

        Args:
            signals: Нормализованные сигналы от стратегий.
            weights: Карта стратегия → вес (опционально).

        Returns:
            ConsensusResult.

        Raises:
            ConsensusError: Если список сигналов пуст.
        """
        if not signals:
            raise ConsensusError("No signals to compute consensus")

        weights = weights or {}

        # Подсчёт голосов по направлениям
        direction_votes: dict[SignalDirection, float] = {
            SignalDirection.LONG: 0.0,
            SignalDirection.SHORT: 0.0,
            SignalDirection.NEUTRAL: 0.0,
        }

        participating = []
        for sig in signals:
            w = weights.get(sig.strategy, 1.0)
            direction_votes[sig.direction] = (
                direction_votes.get(sig.direction, 0.0) + w
            )
            participating.append(sig.strategy)

        # Направление с максимальным весом
        total_weight = sum(direction_votes.values())
        if total_weight == 0:
            return ConsensusResult(
                direction=SignalDirection.NEUTRAL,
                confidence=0.0,
                agreement=0.0,
                participating=participating,
                weight_map=dict(weights),
                is_conflict=False,
                details="No weighted votes",
            )

        sorted_dirs = sorted(
            direction_votes.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        winner_dir = sorted_dirs[0][0]
        winner_weight = sorted_dirs[0][1]
        runner_up_weight = sorted_dirs[1][1] if len(sorted_dirs) > 1 else 0.0

        # Agreement: доля веса победителя от общего
        agreement = winner_weight / total_weight if total_weight > 0 else 0.0

        # Детекция конфликта
        is_conflict = False
        conflict_type: ConflictType | None = None
        details = ""

        if (
            agreement < self._conflict_threshold
            and winner_dir != SignalDirection.NEUTRAL
            and runner_up_weight > 0
        ):
            # Если победитель набрал меньше порога — конфликт
            runner_up_dir = sorted_dirs[1][0]
            if runner_up_dir != SignalDirection.NEUTRAL and runner_up_dir != winner_dir:
                is_conflict = True
                conflict_type = ConflictType.DIRECTION
                details = (
                    f"Direction conflict: {winner_dir.value} "
                    f"({winner_weight:.2f}, {agreement:.1%}) vs "
                    f"{runner_up_dir.value} ({runner_up_weight:.2f})"
                )

        # Confidence: средний confidence сигналов победившего направления
        winner_signals = [
            s for s in signals if s.direction == winner_dir
        ]
        avg_confidence = (
            sum(s.confidence for s in winner_signals) / len(winner_signals)
            if winner_signals else 0.0
        ) if not is_conflict else 0.0

        return ConsensusResult(
            direction=winner_dir if not is_conflict else SignalDirection.NEUTRAL,
            confidence=avg_confidence,
            agreement=agreement,
            participating=participating,
            weight_map=dict(weights),
            is_conflict=is_conflict,
            conflict_type=conflict_type,
            details=details,
        )

    def resolve_conflict(
        self,
        consensus: ConsensusResult,
        signals: list[NormalizedSignal],
        weights: dict[str, float] | None = None,
    ) -> ConsensusResult:
        """Попытаться разрешить конфликт.

        Стратегии разрешения (по приоритету):
          1. Если одна сторона имеет confidence > порога — берём её
          2. Если у одной стороны больше evidence — берём её
          3. Если всё ещё конфликт — NEUTRAL / NO TRADE

        Args:
            consensus: Текущий результат консенсуса.
            signals:   Все сигналы.
            weights:   Веса стратегий.

        Returns:
            Обновлённый ConsensusResult.
        """
        if not consensus.is_conflict:
            return consensus

        weights = weights or {}
        long_signals = [s for s in signals if s.direction == SignalDirection.LONG]
        short_signals = [s for s in signals if s.direction == SignalDirection.SHORT]

        if not long_signals or not short_signals:
            # Конфликт уже не актуален
            return self.compute(signals, weights)

        # 1. Сравнение по confidence (средний)
        long_conf = (
            sum(s.confidence for s in long_signals) / len(long_signals)
        )
        short_conf = (
            sum(s.confidence for s in short_signals) / len(short_signals)
        )
        conf_diff = abs(long_conf - short_conf)

        if conf_diff >= 0.25:
            winner = SignalDirection.LONG if long_conf > short_conf else SignalDirection.SHORT
            return ConsensusResult(
                direction=winner,
                confidence=max(long_conf, short_conf),
                agreement=max(long_conf, short_conf),
                participating=consensus.participating,
                weight_map=dict(weights),
                is_conflict=False,
                details=f"Resolved by confidence: {winner.value} "
                        f"({max(long_conf, short_conf):.2f} vs "
                        f"{min(long_conf, short_conf):.2f})",
            )

        # 2. Сравнение по evidence
        long_evidence_count = sum(len(s.evidence) for s in long_signals)
        short_evidence_count = sum(len(s.evidence) for s in short_signals)

        if long_evidence_count != short_evidence_count:
            winner = (
                SignalDirection.LONG
                if long_evidence_count > short_evidence_count
                else SignalDirection.SHORT
            )
            max_evidence = max(long_evidence_count, short_evidence_count)
            return ConsensusResult(
                direction=winner,
                confidence=0.5 + (max_evidence / (long_evidence_count + short_evidence_count)) * 0.3,
                agreement=0.6,
                participating=consensus.participating,
                weight_map=dict(weights),
                is_conflict=False,
                details=f"Resolved by evidence count: {winner.value} "
                        f"({long_evidence_count} vs {short_evidence_count})",
            )

        # 3. Не удалось разрешить — NO TRADE
        return ConsensusResult(
            direction=SignalDirection.NEUTRAL,
            confidence=0.0,
            agreement=0.0,
            participating=consensus.participating,
            weight_map=dict(weights),
            is_conflict=True,
            conflict_type=ConflictType.UNCERTAINTY,
            details="Unresolvable conflict — NO TRADE",
        )
