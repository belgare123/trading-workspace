"""
9.4 Replay Speed — управление скоростью воспроизведения.

Поддерживает: 0.25x, 0.5x, 1x, 2x, 5x, 10x, 100x, ∞ (max)
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)

# Доступные множители скорости
PRESET_SPEEDS = [0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 100.0]

# Max speed как 1e6 для практического ∞
MAX_SPEED = 1_000_000.0
MIN_SPEED = 0.25


class SpeedMultiplier(Enum):
    QUARTER = 0.25
    HALF = 0.5
    NORMAL = 1.0
    DOUBLE = 2.0
    FIVE_X = 5.0
    TEN_X = 10.0
    HUNDRED_X = 100.0
    MAX = MAX_SPEED


class SpeedController:
    """Управление скоростью replay."""

    def __init__(self, speed: float = 1.0) -> None:
        self._speed = self._clamp(speed)

    @staticmethod
    def _clamp(speed: float) -> float:
        return max(MIN_SPEED, min(speed, MAX_SPEED))

    @property
    def speed(self) -> float:
        return self._speed

    @speed.setter
    def speed(self, value: float) -> None:
        self._speed = self._clamp(value)

    def set(self, speed: float) -> float:
        """Установить скорость и вернуть текущую."""
        self._speed = self._clamp(speed)
        logger.info("Speed set to %gx", self._speed)
        return self._speed

    def step_up(self) -> float:
        """Следующий предустановленный множитель вверх."""
        current_idx = self._preset_index()
        if current_idx < len(PRESET_SPEEDS) - 1:
            self._speed = PRESET_SPEEDS[current_idx + 1]
        else:
            self._speed = MAX_SPEED
        logger.info("Speed stepped up to %gx", self._speed)
        return self._speed

    def step_down(self) -> float:
        """Следующий предустановленный множитель вниз."""
        current_idx = self._preset_index()
        if current_idx > 0:
            self._speed = PRESET_SPEEDS[current_idx - 1]
        else:
            self._speed = PRESET_SPEEDS[0]
        logger.info("Speed stepped down to %gx", self._speed)
        return self._speed

    def _preset_index(self) -> int:
        closest = min(PRESET_SPEEDS, key=lambda x: abs(x - self._speed))
        return PRESET_SPEEDS.index(closest)

    @property
    def label(self) -> str:
        if self._speed >= MAX_SPEED:
            return "∞"
        return f"{self._speed:g}x"

    def to_dict(self) -> dict[str, Any]:
        return {"speed": self._speed, "label": self.label}
