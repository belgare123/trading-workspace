"""
Quality Engine — Passport Generator (Phase 10.2).

Сырые сделки → RatingPassport с 12 метриками.
"""

from __future__ import annotations

import logging
from typing import Any

from core.quality.metrics import (
    calc_avg_hold,
    calc_avg_r_ratio,
    calc_confidence,
    calc_expectancy,
    calc_false_positive_rate,
    calc_max_drawdown,
    calc_profit_factor,
    calc_recovery_factor,
    calc_sharpe,
    calc_signal_precision,
    calc_sortino,
    calc_win_rate,
)
from core.quality.models import (
    ConfidenceGrade,
    MetricName,
    RatingLevel,
    RatingPassport,
)

logger = logging.getLogger(__name__)


class PassportGenerator:
    """Генерация паспорта стратегии из списка закрытых сделок."""

    def generate(
        self,
        strategy_name: str,
        trades: list[dict[str, Any]],
        strategy_type: str = "",
    ) -> RatingPassport:
        """Сгенерировать полный паспорт.

        Args:
            strategy_name: Имя стратегии.
            trades: Список закрытых сделок (Trade.to_dict()).
            strategy_type: Опциональный тип стратегии.

        Returns:
            RatingPassport с 12 метриками.
        """
        if not trades:
            return RatingPassport(
                strategy_name=strategy_name,
                strategy_type=strategy_type,
                rating=RatingLevel.F,
                confidence=ConfidenceGrade.D,
                total_trades=0,
            )

        # Расчёт всех метрик
        metrics = {
            MetricName.WIN_RATE: calc_win_rate(trades),
            MetricName.PROFIT_FACTOR: calc_profit_factor(trades),
            MetricName.EXPECTANCY: calc_expectancy(trades),
            MetricName.SHARPE: calc_sharpe(trades),
            MetricName.SORTINO: calc_sortino(trades),
            MetricName.MAX_DRAWDOWN: calc_max_drawdown(trades),
            MetricName.RECOVERY_FACTOR: calc_recovery_factor(trades),
            MetricName.AVG_R_RATIO: calc_avg_r_ratio(trades),
            MetricName.AVG_HOLD: calc_avg_hold(trades),
            MetricName.SIGNAL_PRECISION: calc_signal_precision(trades),
            MetricName.FALSE_POSITIVE_RATE: calc_false_positive_rate(trades),
            MetricName.CONFIDENCE: calc_confidence(trades),
        }

        # Confidence grade
        conf_value = metrics[MetricName.CONFIDENCE]
        confidence = self._confidence_grade(conf_value.value)

        passport = RatingPassport(
            strategy_name=strategy_name,
            strategy_type=strategy_type,
            metrics=metrics,
            confidence=confidence,
            total_trades=len(trades),
        )
        logger.info(
            "Passport generated: %s (%d trades)",
            strategy_name, len(trades),
        )
        return passport

    @staticmethod
    def _confidence_grade(total_trades: float) -> ConfidenceGrade:
        if total_trades >= 100:
            return ConfidenceGrade.A
        elif total_trades >= 50:
            return ConfidenceGrade.B
        elif total_trades >= 10:
            return ConfidenceGrade.C
        return ConfidenceGrade.D
