"""
Quality Engine — Quality History (Phase 10.6).

Тренды метрик во времени.
Позволяет отслеживать ухудшение стратегии.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from core.quality.models import MetricName, RatingLevel, RatingPassport

logger = logging.getLogger(__name__)


@dataclass
class HistoryEntry:
    """Одна запись в истории качества."""
    timestamp: float
    overall_score: float
    rating: str
    total_trades: int
    metrics: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "overall_score": round(self.overall_score, 2),
            "rating": self.rating,
            "total_trades": self.total_trades,
            "metrics": {k: round(v, 4) for k, v in self.metrics.items()},
        }


class QualityHistory:
    """Хранение истории качества стратегий."""

    def __init__(self, storage_dir: str = "") -> None:
        self._storage_dir = Path(storage_dir) if storage_dir else Path.cwd()
        self._entries: dict[str, list[HistoryEntry]] = {}
        self._max_entries = 1000

    def record(self, passport: RatingPassport) -> None:
        """Записать текущее состояние в историю.

        Args:
            passport: Паспорт стратегии.
        """
        name = passport.strategy_name
        if name not in self._entries:
            self._entries[name] = []

        entry = HistoryEntry(
            timestamp=passport.timestamp,
            overall_score=passport.overall_score,
            rating=passport.rating.value,
            total_trades=passport.total_trades,
            metrics={k.value: v.value for k, v in passport.metrics.items()},
        )
        self._entries[name].append(entry)

        # Ограничение размера
        if len(self._entries[name]) > self._max_entries:
            self._entries[name] = self._entries[name][-self._max_entries:]

        logger.debug("QualityHistory recorded: %s (score=%.2f)", name, entry.overall_score)

    def get_history(self, strategy_name: str) -> list[HistoryEntry]:
        """Получить историю метрик стратегии."""
        return list(self._entries.get(strategy_name, []))

    def get_trend(self, strategy_name: str, window: int = 10) -> dict[str, Any]:
        """Вычислить тренд метрик.

        Args:
            strategy_name: Имя стратегии.
            window: Окно для тренда.

        Returns:
            Словарь с трендами.
        """
        entries = self._entries.get(strategy_name, [])
        if len(entries) < 2:
            return {"strategy": strategy_name, "trend": "stable", "change": 0.0}

        recent = entries[-window:]
        if len(recent) < 2:
            return {"strategy": strategy_name, "trend": "stable", "change": 0.0}

        first_score = recent[0].overall_score
        last_score = recent[-1].overall_score
        change = last_score - first_score

        if change > 0.3:
            trend = "improving"
        elif change < -0.3:
            trend = "declining"
        else:
            trend = "stable"

        return {
            "strategy": strategy_name,
            "trend": trend,
            "change": round(change, 2),
            "first_score": first_score,
            "last_score": last_score,
            "entries": len(recent),
        }

    def all_declining(self, threshold: float = -1.0) -> list[dict[str, Any]]:
        """Найти стратегии с ухудшением больше порога."""
        result = []
        for name in self._entries:
            trend = self.get_trend(name)
            if trend.get("change", 0) < threshold:
                result.append(trend)
        return sorted(result, key=lambda x: x["change"])

    def save(self, path: str | None = None) -> str:
        """Сохранить историю в JSON."""
        save_path = Path(path or self._storage_dir / "quality_history.json")
        data = {
            name: [e.to_dict() for e in entries]
            for name, entries in self._entries.items()
        }
        with open(save_path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info("QualityHistory saved: %s (%d strategies)", save_path, len(self._entries))
        return str(save_path)

    def load(self, path: str) -> None:
        """Загрузить историю из JSON."""
        with open(path) as f:
            data = json.load(f)
        for name, entries_data in data.items():
            self._entries[name] = [
                HistoryEntry(**e) for e in entries_data
            ]
        logger.info("QualityHistory loaded: %s (%d strategies)", path, len(self._entries))

    @property
    def strategies(self) -> list[str]:
        return list(self._entries.keys())

    @property
    def total_records(self) -> int:
        return sum(len(entries) for entries in self._entries.values())
