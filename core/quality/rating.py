"""
Quality Engine — Rating Calculator (Phase 10.3).

Метрики → ★★★★★ (RatingLevel S/A/B/C/D/F).

Взвешенная оценка:
  - WinRate: 15%
  - Profit Factor: 20%
  - Sharpe: 15%
  - Sortino: 10%
  - MaxDD: 10%
  - Recovery: 10%
  - Expectancy: 10%
  - Avg RR: 5%
  - Signal Precision: 5%
"""

from __future__ import annotations

import logging
from typing import Any

from core.quality.models import (
    MetricName,
    RatingLevel,
    RatingPassport,
)

logger = logging.getLogger(__name__)

# Веса метрик для расчёта общего рейтинга
DEFAULT_WEIGHTS: dict[MetricName, float] = {
    MetricName.PROFIT_FACTOR: 0.20,
    MetricName.WIN_RATE: 0.15,
    MetricName.SHARPE: 0.15,
    MetricName.SORTINO: 0.10,
    MetricName.MAX_DRAWDOWN: 0.10,
    MetricName.RECOVERY_FACTOR: 0.10,
    MetricName.EXPECTANCY: 0.10,
    MetricName.AVG_R_RATIO: 0.05,
    MetricName.SIGNAL_PRECISION: 0.05,
    # AvgHold, FPR, Confidence — информационные, не в рейтинге
}


class RatingCalculator:
    """Расчёт рейтинга стратегии по метрикам."""

    def __init__(self, weights: dict[MetricName, float] | None = None) -> None:
        self._weights = weights or dict(DEFAULT_WEIGHTS)

    def calculate(self, passport: RatingPassport) -> RatingPassport:
        """Вычислить рейтинг для паспорта.

        Args:
            passport: Паспорт с метриками.

        Returns:
            Паспорт с заполненным rating и overall_score.
        """
        if passport.total_trades == 0:
            passport.rating = RatingLevel.F
            passport.overall_score = 0.0
            return passport

        total_score = 0.0
        total_weight = 0.0

        for metric_name, weight in self._weights.items():
            mv = passport.metrics.get(metric_name)
            if mv is None:
                continue

            # Нормализуем метрику в [0, 5]
            normalized = self._normalize(metric_name, mv.value)
            total_score += normalized * weight
            total_weight += weight

        if total_weight > 0:
            passport.overall_score = total_score / total_weight
        else:
            passport.overall_score = 0.0

        passport.rating = RatingLevel.from_score(passport.overall_score)
        logger.debug(
            "Rating: %s -> %.2f (%s)",
            passport.strategy_name, passport.overall_score, passport.rating.value,
        )
        return passport

    @staticmethod
    def _normalize(metric: MetricName, value: float) -> float:
        """Нормализовать метрику в шкалу [0, 5].

        Правила нормализации:
          WinRate: 50% → 2.5, 75% → 4.5
          PF: 1.0 → 2.0, 2.0 → 4.0
          Sharpe: 0 → 2.0, 2 → 4.5
          Sortino: 0 → 2.0, 2 → 4.5
          MaxDD: 30% → 1.0, 10% → 3.5, 5% → 4.5
          Recovery: 0 → 1.0, 3 → 4.0
          Expectancy: 0 → 2.0, 0.5 → 4.0
          AvgRR: 0 → 1.0, 2 → 4.0
          SignalPrecision: 50% → 2.5, 70% → 4.0
        """
        mapping = MetricNormalizer.MAPPING
        if metric in mapping:
            return mapping[metric](value)
        return value / 20.0  # fallback: 100 → 5


class MetricNormalizer:
    """Нормализация значений метрик в [0, 5]."""

    @staticmethod
    def _win_rate(v: float) -> float:
        if v <= 0:
            return 0.0
        # 50% → 2.5, 75% → 4.5, 100% → 5.0
        return min(5.0, v / 20.0 + 0.5)

    @staticmethod
    def _profit_factor(v: float) -> float:
        if v <= 0:
            return 0.0
        if v >= 4.0:
            return 5.0
        # 1.0 → 2.0, 2.0 → 4.0, 3.0 → 4.8
        return min(5.0, 1.0 + v * 1.5)

    @staticmethod
    def _sharpe(v: float) -> float:
        # 0 → 2.0, 1 → 3.5, 2 → 4.5, 3 → 5.0
        return min(5.0, max(0.0, 2.0 + v * 1.2))

    @staticmethod
    def _sortino(v: float) -> float:
        return min(5.0, max(0.0, 2.0 + v * 1.2))

    @staticmethod
    def _max_dd(v: float) -> float:
        if v <= 0:
            return 5.0
        # 5% → 4.5, 15% → 3.0, 30% → 1.0, 50% → 0
        return max(0.0, min(5.0, 5.0 - v / 10.0))

    @staticmethod
    def _recovery(v: float) -> float:
        # 0 → 1.0, 2 → 3.5, 5 → 4.5, 10 → 5.0
        if v <= 0:
            return 1.0
        return min(5.0, 1.0 + v * 0.7)

    @staticmethod
    def _expectancy(v: float) -> float:
        # 0 → 2.0, 0.25 → 3.0, 0.5 → 4.0, 1.0 → 5.0
        return min(5.0, max(0.0, 2.0 + v * 4.0))

    @staticmethod
    def _avg_rr(v: float) -> float:
        # 0 → 1.0, 1 → 3.0, 2 → 4.0, 3 → 4.5, >5 → 5.0
        return min(5.0, max(0.0, 1.0 + v * 1.5))

    @staticmethod
    def _signal_precision(v: float) -> float:
        if v <= 0:
            return 0.0
        # 50% → 2.5, 70% → 4.0, 90% → 5.0
        return min(5.0, v / 20.0 + 0.5)

    MAPPING: dict[MetricName, callable] = {
        MetricName.WIN_RATE: _win_rate,
        MetricName.PROFIT_FACTOR: _profit_factor,
        MetricName.SHARPE: _sharpe,
        MetricName.SORTINO: _sortino,
        MetricName.MAX_DRAWDOWN: _max_dd,
        MetricName.RECOVERY_FACTOR: _recovery,
        MetricName.EXPECTANCY: _expectancy,
        MetricName.AVG_R_RATIO: _avg_rr,
        MetricName.SIGNAL_PRECISION: _signal_precision,
    }
