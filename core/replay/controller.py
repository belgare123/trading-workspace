"""
9.5 + 9.6 Controller — Pause/Resume + Seek для Replay.

Взаимодействие:
  timeline.controller.pause() → seek(14:05) → resume()
"""

from __future__ import annotations

import logging
from typing import Any

from core.replay.models import SeekTarget

logger = logging.getLogger(__name__)


class ReplayController:
    """Управление replay-сессией: пауза, возобновление, перемещение."""

    def __init__(self) -> None:
        self._is_paused = False
        self._pause_time: float = 0.0
        self._seek_target: SeekTarget | None = None

    @property
    def is_paused(self) -> bool:
        return self._is_paused

    def pause(self) -> None:
        """Приостановить replay."""
        self._is_paused = True
        logger.info("Replay paused")

    def resume(self) -> None:
        """Возобновить replay."""
        self._is_paused = False
        logger.info("Replay resumed")

    def toggle(self) -> bool:
        """Переключить паузу. Вернуть новое состояние (True = paused)."""
        if self._is_paused:
            self.resume()
        else:
            self.pause()
        return self._is_paused

    def seek(self, timestamp: float, tolerance: float = 1.0) -> SeekTarget:
        """Установить цель для seek.

        Args:
            timestamp: Целевое время.
            tolerance: Допуск в секундах.

        Returns:
            SeekTarget.
        """
        self._seek_target = SeekTarget(timestamp=timestamp, tolerance=tolerance)
        logger.info("Replay seek target set to %s (±%.1fs)", timestamp, tolerance)
        return self._seek_target

    def consume_seek(self) -> SeekTarget | None:
        """Забрать seek-цель (однократно)."""
        target = self._seek_target
        self._seek_target = None
        return target

    @property
    def has_seek(self) -> bool:
        return self._seek_target is not None

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_paused": self._is_paused,
            "pause_time": self._pause_time,
            "has_seek": self.has_seek,
            "seek_target": self._seek_target.to_dict() if self._seek_target else None,
        }
