"""
8.4 Stop/Target Monitor — управление стопами и тейками.

Поддерживает:
  - Multiple targets (Target1=25%, Target2=50%, Target3=100%)
  - Trailing Stop
  - Break Even
  - Stop Loss обновление
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from core.lifecycle.models import Position

logger = logging.getLogger(__name__)


class StopTargetEvent(Enum):
    """Типы событий от Stop/Target Monitor."""
    NONE = "none"
    TARGET_1_HIT = "target_1_hit"
    TARGET_2_HIT = "target_2_hit"
    TARGET_3_HIT = "target_3_hit"
    FULL_TARGET = "full_target"
    STOP_HIT = "stop_hit"
    STOP_UPDATED = "stop_updated"
    BREAK_EVEN_ACTIVATED = "break_even_activated"
    TRAILING_ACTIVATED = "trailing_activated"


@dataclass
class StopTargetResult:
    """Результат проверки стопов и тейков."""
    event: StopTargetEvent = StopTargetEvent.NONE
    current_price: float = 0.0
    triggered_level: float = 0.0
    updated_stop: float | None = None
    targets_hit: list[int] = field(default_factory=list)
    message: str = ""
    is_closed: bool = False  # позиция должна быть закрыта


@dataclass
class StopTargetConfig:
    """Конфигурация стоп/тейк менеджера.

    Attributes:
        target_levels:   Уровни тейков (в % от entry к target).
                         [0.25, 0.50, 1.0] = 25%, 50%, 100% от RR.
        trailing_after:  После какого target включить trailing (None = выкл).
        break_even_at:   При каком PnL% перенести стоп в безубыток.
        tailing_stop_distance: Расстояние trailing стопа в %.
    """
    target_levels: list[float] = field(default_factory=lambda: [0.25, 0.50, 1.0])
    trailing_after: int | None = 1  # после Target1
    break_even_at: float | None = 0.5  # при PnL 0.5%
    trailing_stop_distance: float = 0.5  # 0.5%


class StopTargetMonitor:
    """Мониторинг стоп-лоссов и тейк-профитов.

    Usage:
        config = StopTargetConfig(target_levels=[0.25, 0.50, 1.0])
        monitor = StopTargetMonitor(config)
        result = monitor.check(position, current_price=64900.0)
    """

    def __init__(self, config: StopTargetConfig | None = None) -> None:
        self._config = config or StopTargetConfig()
        # Храним уже достигнутые тейки per position
        self._targets_hit: dict[str, set[int]] = {}

    def check(
        self,
        position: Position,
        current_price: float,
    ) -> StopTargetResult:
        """Проверить стопы и тейки для позиции.

        Args:
            position:     Открытая позиция.
            current_price: Текущая цена.

        Returns:
            StopTargetResult.
        """
        pos_id = position.id
        if pos_id not in self._targets_hit:
            self._targets_hit[pos_id] = set()

        direction = position.direction.lower()
        entry = position.entry_price
        stop = position.stop_loss

        # ── 1. Stop Loss ──
        if stop is not None:
            stop_hit = (
                (direction == "long" and current_price <= stop)
                or (direction == "short" and current_price >= stop)
            )
            if stop_hit:
                self._cleanup(pos_id)
                return StopTargetResult(
                    event=StopTargetEvent.STOP_HIT,
                    current_price=current_price,
                    triggered_level=stop,
                    is_closed=True,
                    message=f"Stop loss hit at {stop}",
                )

        # ── 2. Targets ──
        targets_hit_any = False
        all_targets_hit = True

        for i, target_price in enumerate(position.targets):
            target_idx = i + 1  # 1-indexed

            if target_idx in self._targets_hit[pos_id]:
                continue  # уже достигнут

            target_reached = (
                (direction == "long" and current_price >= target_price)
                or (direction == "short" and current_price <= target_price)
            )

            if target_reached:
                self._targets_hit[pos_id].add(target_idx)
                targets_hit_any = True

            # Проверяем все ли цели достигнуты
            all_targets_hit = len(self._targets_hit[pos_id]) >= len(position.targets)

        if all_targets_hit:
            self._cleanup(pos_id)
            return StopTargetResult(
                event=StopTargetEvent.FULL_TARGET,
                current_price=current_price,
                targets_hit=list(self._targets_hit.get(pos_id, set())),
                is_closed=True,
                message="All targets reached",
            )

        # ── 3. Partial target ──
        hit_list = list(self._targets_hit.get(pos_id, set()))
        if targets_hit_any:
            last_hit = max(hit_list)
            event_map = {
                1: StopTargetEvent.TARGET_1_HIT,
                2: StopTargetEvent.TARGET_2_HIT,
                3: StopTargetEvent.TARGET_3_HIT,
            }
            return StopTargetResult(
                event=event_map.get(last_hit, StopTargetEvent.TARGET_1_HIT),
                current_price=current_price,
                targets_hit=hit_list,
                is_closed=False,
                message=f"Target {last_hit} reached at {current_price}",
            )

        # ── 4. Stop updates ──
        updated_stop = None
        event = StopTargetEvent.NONE

        # Break Even
        if (
            self._config.break_even_at is not None
            and self._config.break_even_at > 0.0
            and stop is not None
        ):
            # PnL в %
            if direction == "long":
                pnl_pct = (current_price - entry) / entry * 100
                be_stop = entry * (1.0 + self._config.break_even_at / 100)
            else:
                pnl_pct = (entry - current_price) / entry * 100
                be_stop = entry * (1.0 - self._config.break_even_at / 100)

            if pnl_pct >= self._config.break_even_at:
                be_stop_long = entry * (1.0 + self._config.break_even_at / 100) if direction == "long" else entry * (1.0 - self._config.break_even_at / 100)

                # Обновляем стоп если текущий ниже уровня BE
                if direction == "long" and (stop < be_stop_long):
                    updated_stop = round(be_stop_long, 2)
                    event = StopTargetEvent.BREAK_EVEN_ACTIVATED
                elif direction == "short" and (stop > be_stop_long):
                    updated_stop = round(be_stop_long, 2)
                    event = StopTargetEvent.BREAK_EVEN_ACTIVATED

        # Trailing stop
        if (
            event == StopTargetEvent.NONE
            and self._config.trailing_after is not None
            and len(hit_list) >= self._config.trailing_after
        ):
            trail_dist = entry * self._config.trailing_stop_distance / 100
            if direction == "long":
                trail_stop = current_price - trail_dist
                if stop is None or trail_stop > stop:
                    updated_stop = round(trail_stop, 2)
                    event = StopTargetEvent.TRAILING_ACTIVATED
            else:
                trail_stop = current_price + trail_dist
                if stop is None or trail_stop < stop:
                    updated_stop = round(trail_stop, 2)
                    event = StopTargetEvent.TRAILING_ACTIVATED

        if updated_stop is not None:
            position.stop_loss = updated_stop

        return StopTargetResult(
            event=event,
            current_price=current_price,
            updated_stop=updated_stop,
            targets_hit=hit_list,
            is_closed=False,
            message=f"Stop updated to {updated_stop}" if updated_stop else "No action",
        )

    def _cleanup(self, pos_id: str) -> None:
        self._targets_hit.pop(pos_id, None)

    def reset(self, position_id: str) -> None:
        """Сбросить состояние для позиции."""
        self._targets_hit.pop(position_id, None)
