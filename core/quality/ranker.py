"""
Quality Engine — Ranker (Phase 10.5).

Сравнение и сортировка стратегий по рейтингу.
"""

from __future__ import annotations

import logging
from typing import Any

from core.quality.models import MetricName, RatingPassport

logger = logging.getLogger(__name__)


class Ranker:
    """Ранжирование стратегий по качеству."""

    def rank(
        self,
        passports: list[RatingPassport],
        metric: MetricName | str | None = None,
        min_trades: int = 10,
    ) -> list[RatingPassport]:
        """Отсортировать стратегии по качеству.

        Args:
            passports: Список паспортов.
            metric: Метрика для сортировки (None = overall score).
            min_trades: Минимум сделок для включения.

        Returns:
            Отсортированный список (лучшие первые).
        """
        filtered = [p for p in passports if p.total_trades >= min_trades]
        key_func = self._sort_key(metric)
        ranked = sorted(filtered, key=key_func, reverse=True)
        logger.debug("Ranker: %d/%d passed min_trades=%d", len(ranked), len(passports), min_trades)
        return ranked

    def top_n(
        self,
        passports: list[RatingPassport],
        n: int = 5,
        min_trades: int = 10,
    ) -> list[RatingPassport]:
        """Вернуть топ-N стратегий."""
        ranked = self.rank(passports, min_trades=min_trades)
        return ranked[:n]

    def compare(self, a: RatingPassport, b: RatingPassport) -> dict[str, Any]:
        """Сравнить две стратегии по всем метрикам."""
        result: dict[str, Any] = {
            "winner": a.strategy_name if a.overall_score >= b.overall_score else b.strategy_name,
            "a_score": round(a.overall_score, 2),
            "b_score": round(b.overall_score, 2),
            "metrics": {},
        }
        all_metrics = set(a.metrics.keys()) | set(b.metrics.keys())
        for m in sorted(all_metrics, key=lambda x: x.value):
            va = a.metrics.get(m)
            vb = b.metrics.get(m)
            result["metrics"][m.value] = {
                a.strategy_name: round(va.value, 4) if va else None,
                b.strategy_name: round(vb.value, 4) if vb else None,
                "winner": (
                    a.strategy_name if va and vb and va.value >= vb.value
                    else b.strategy_name if vb and (not va or vb.value > va.value)
                    else "tie"
                ),
            }
        return result

    @staticmethod
    def _sort_key(metric: MetricName | str | None):
        if metric is None:
            return lambda p: (p.overall_score, p.total_trades)
        metric_name = MetricName(metric) if isinstance(metric, str) else metric
        return lambda p: p.metrics.get(metric_name, type("", (), {"value": 0})()).value
