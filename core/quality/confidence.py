"""
Quality Engine — Confidence Score (Phase 10.4).

A/B/C/D оценка доверия к стратегии.
Доверие зависит от:
  - Количество сделок
  - Период наблюдения
  - Стабильность метрик (необязательно)
"""

from __future__ import annotations

import logging
from typing import Any

from core.quality.models import ConfidenceGrade

logger = logging.getLogger(__name__)


class ConfidenceCalculator:
    """Расчёт уровня доверия к стратегии."""

    def calculate(
        self,
        total_trades: int,
        observation_days: float = 0.0,
        metrics_stability: float | None = None,
    ) -> ConfidenceGrade:
        """Вычислить уровень доверия.

        Args:
            total_trades: Количество закрытых сделок.
            observation_days: Дней наблюдения (0 = неизвестно).
            metrics_stability: Стабильность метрик [0, 1] (None = игнор).

        Returns:
            ConfidenceGrade.
        """
        # База: количество сделок
        if total_trades >= 100 and observation_days >= 90:
            base = ConfidenceGrade.A
        elif total_trades >= 50 and observation_days >= 30:
            base = ConfidenceGrade.B
        elif total_trades >= 10:
            base = ConfidenceGrade.C
        else:
            base = ConfidenceGrade.D

        # Повышение за стабильность
        if metrics_stability is not None and metrics_stability > 0.8:
            if base == ConfidenceGrade.C:
                base = ConfidenceGrade.B
            elif base == ConfidenceGrade.B and total_trades >= 100:
                base = ConfidenceGrade.A

        logger.debug(
            "Confidence: %d trades, %.0f days -> %s",
            total_trades, observation_days, base.value,
        )
        return base

    @staticmethod
    def calculate_stability(passport_history: list[dict[str, Any]]) -> float:
        """Стабильность метрик во времени.

        Args:
            passport_history: Список прошлых паспортов (to_dict).

        Returns:
            Стабильность [0, 1].
        """
        if len(passport_history) < 2:
            return 0.0

        # Изменение рейтинга — чем меньше, тем стабильнее
        ratings = [p.get("overall_score", 0) for p in passport_history]
        if len(ratings) < 2:
            return 0.0

        max_change = max(abs(ratings[i] - ratings[i - 1]) for i in range(1, len(ratings)))
        stability = max(0.0, 1.0 - max_change / 2.0)
        return round(stability, 4)
