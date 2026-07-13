"""
Snapshot Engine — сохранение снимков состояния во время Replay.

Frame 12000:
  - Feature Graph
  - State
  - Lifecycle
  - Decision
  - Context
"""

from __future__ import annotations

import json
import logging
from typing import Any

from core.replay.models import ReplaySnapshot

logger = logging.getLogger(__name__)


class SnapshotEngine:
    """Управление снимками состояния."""

    def __init__(self) -> None:
        self._snapshots: list[ReplaySnapshot] = []
        self._frame_counter = 0
        self._auto_interval: int = 0  # 0 = только ручные

    @property
    def count(self) -> int:
        return len(self._snapshots)

    @property
    def snapshots(self) -> list[ReplaySnapshot]:
        return list(self._snapshots)

    def set_auto_interval(self, interval: int) -> None:
        """Установить интервал автоматических снимков (в событиях)."""
        self._auto_interval = max(0, interval)
        logger.debug("Snapshot auto interval set to %d", self._auto_interval)

    def take(
        self,
        timestamp: float,
        label: str = "",
        feature_graph_state: dict[str, Any] | None = None,
        decision_context: dict[str, Any] | None = None,
        lifecycle_context: dict[str, Any] | None = None,
        meta: dict[str, Any] | None = None,
    ) -> ReplaySnapshot:
        """Создать снимок текущего состояния.

        Args:
            timestamp: Текущее время.
            label: Метка снимка.
            feature_graph_state: Состояние Feature Graph.
            decision_context: Контекст Decision Engine.
            lifecycle_context: Контекст Lifecycle.
            meta: Дополнительные данные.

        Returns:
            ReplaySnapshot.
        """
        self._frame_counter += 1
        snapshot = ReplaySnapshot(
            frame=self._frame_counter,
            timestamp=timestamp,
            label=label or f"Frame_{self._frame_counter}",
            feature_graph_state=feature_graph_state or {},
            decision_context=decision_context or {},
            lifecycle_context=lifecycle_context or {},
            meta=meta or {},
        )
        self._snapshots.append(snapshot)
        return snapshot

    def get_frame(self, frame: int) -> ReplaySnapshot | None:
        """Получить снимок по номеру кадра."""
        for s in self._snapshots:
            if s.frame == frame:
                return s
        return None

    def get_near(self, timestamp: float, tolerance: float = 5.0) -> ReplaySnapshot | None:
        """Получить снимок ближайший к timestamp."""
        best = None
        best_diff = float("inf")
        for s in self._snapshots:
            diff = abs(s.timestamp - timestamp)
            if diff < best_diff and diff <= tolerance:
                best = s
                best_diff = diff
        return best

    def clear(self) -> None:
        """Очистить все снимки."""
        self._snapshots.clear()
        self._frame_counter = 0

    def export(self, path: str) -> None:
        """Экспортировать снимки в JSON."""
        data = [s.to_dict() for s in self._snapshots]
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        logger.info("Snapshots exported: %d frames -> %s", len(data), path)
