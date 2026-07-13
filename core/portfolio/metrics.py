"""
Portfolio Engine — Portfolio Metrics (Phase 12.6).

Агрегированные метрики производительности портфеля.
"""

from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class PortfolioMetricsSnapshot:
    """Снимок метрик портфеля."""
    timestamp: float = 0.0
    active_count: int = 0
    total_strategies: int = 0
    total_weight: float = 1.0
    regime_changes: int = 0
    rebalances: int = 0
    concentration: float = 0.0          # 0..1 (1 = всё в одной)
    diversity_score: float = 1.0         # 0..1 (1 = идеально)
    avg_weight: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "active_count": self.active_count,
            "total_strategies": self.total_strategies,
            "total_weight": self.total_weight,
            "regime_changes": self.regime_changes,
            "rebalances": self.rebalances,
            "concentration": self.concentration,
            "diversity_score": self.diversity_score,
            "avg_weight": self.avg_weight,
        }


class PortfolioMetricsCollector:
    """Сбор метрик портфеля."""

    def __init__(self) -> None:
        self._history: list[PortfolioMetricsSnapshot] = []
        self._regime_changes = 0

    def record_regime_change(self) -> None:
        self._regime_changes += 1

    def snapshot(
        self,
        weights: dict[str, float],
        rebalances: int = 0,
    ) -> PortfolioMetricsSnapshot:
        """Сделать снимок текущих метрик."""
        active = {k: v for k, v in weights.items() if v > 0}
        total = sum(weights.values())

        # Концентрация Херфиндаля-Хиршмана
        if total > 0:
            hhi = sum((v / total) ** 2 for v in active.values())
            concentration = (hhi - 1 / len(weights)) / (1 - 1 / len(weights)) if len(weights) > 1 else 1.0
        else:
            concentration = 0.0

        # Diversity score
        diversity = 1.0 - concentration

        snapshot = PortfolioMetricsSnapshot(
            active_count=len(active),
            total_strategies=len(weights),
            total_weight=round(total, 4),
            regime_changes=self._regime_changes,
            rebalances=rebalances,
            concentration=round(concentration, 4),
            diversity_score=round(diversity, 4),
            avg_weight=round(total / len(weights), 4) if weights else 0.0,
        )
        self._history.append(snapshot)
        return snapshot

    def get_history(self) -> list[PortfolioMetricsSnapshot]:
        return self._history

    def clear(self) -> None:
        self._history.clear()
        self._regime_changes = 0
