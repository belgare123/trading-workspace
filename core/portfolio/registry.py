"""
Portfolio Engine — Strategy Registry (Phase 12.1).

Реестр доступных стратегий и их метаданных.
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics import RegimeType
from core.portfolio.models import PortfolioState, StrategyRole, StrategySlot

logger = logging.getLogger(__name__)


class StrategyRegistry:
    """Реестр стратегий для портфеля."""

    def __init__(self, state: PortfolioState | None = None) -> None:
        self._state = state or PortfolioState()
        self._next_id = 0

    @property
    def state(self) -> PortfolioState:
        return self._state

    def register(
        self,
        name: str,
        role: StrategyRole = StrategyRole.OPPORTUNISTIC,
        base_weight: float = 1.0,
        allowed_regimes: list[RegimeType] | None = None,
        excluded_regimes: list[RegimeType] | None = None,
        min_rating: str = "C",
        min_confidence: float = 0.3,
        max_position_size: float = 0.0,
        max_concurrent: int = 3,
        cooldown_bars: int = 0,
    ) -> StrategySlot:
        """Зарегистрировать стратегию в портфеле."""
        if name in self._state.slots:
            logger.warning("Strategy '%s' already registered, updating", name)

        slot = StrategySlot(
            name=name,
            role=role,
            base_weight=base_weight,
            current_weight=base_weight,
            allowed_regimes=allowed_regimes or [],
            excluded_regimes=excluded_regimes or [],
            min_rating=next(
                (r for r in __import__("core.quality", fromlist=["RatingLevel"]).RatingLevel
                 if r.value == min_rating),
                __import__("core.quality", fromlist=["RatingLevel"]).RatingLevel.C,
            ),
            min_confidence=min_confidence,
            enabled=True,
            is_active=False,
            max_position_size=max_position_size,
            max_concurrent=max_concurrent,
            cooldown_bars=cooldown_bars,
        )
        self._state.slots[name] = slot
        return slot

    def unregister(self, name: str) -> None:
        """Удалить стратегию из портфеля."""
        self._state.slots.pop(name, None)

    def get(self, name: str) -> StrategySlot | None:
        return self._state.slots.get(name)

    def get_by_role(self, role: StrategyRole) -> list[StrategySlot]:
        return [s for s in self._state.slots.values() if s.role == role]

    def get_enabled(self) -> list[StrategySlot]:
        return self._state.active_slots

    def set_enabled(self, name: str, enabled: bool) -> None:
        slot = self._state.slots.get(name)
        if slot:
            slot.enabled = enabled
            if not enabled:
                slot.current_weight = 0.0

    def set_active(self, name: str, active: bool) -> None:
        slot = self._state.slots.get(name)
        if slot:
            slot.is_active = active

    def count(self) -> int:
        return len(self._state.slots)

    def clear(self) -> None:
        self._state.slots.clear()

    def to_dict(self) -> dict[str, Any]:
        return self._state.to_dict()
