"""
Portfolio Engine — Regime Allocator (Phase 12.2).

Распределение стратегий по рыночным режимам.
Определяет, какие стратегии активны в каком режиме.
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics import RegimeType
from core.portfolio.models import (
    PortfolioAction,
    PortfolioAllocation,
    PortfolioConfig,
    PortfolioState,
    StrategySlot,
)

logger = logging.getLogger(__name__)


class RegimeAllocator:
    """Распределение стратегий по режимам рынка."""

    def __init__(self, config: PortfolioConfig | None = None) -> None:
        self._config = config or PortfolioConfig()

    def allocate(
        self,
        state: PortfolioState,
        current_regime: RegimeType,
        regime_duration: int = 0,
    ) -> list[PortfolioAllocation]:
        """Определить распределение стратегий под текущий режим.

        Args:
            state: Текущее состояние портфеля.
            current_regime: Текущий рыночный режим.
            regime_duration: Сколько свечей длится режим.

        Returns:
            Список распределений (какие стратегии активны, с каким весом).
        """
        allocations: list[PortfolioAllocation] = []

        for slot in state.slots.values():
            if not slot.enabled:
                allocations.append(PortfolioAllocation(
                    slot_name=slot.name,
                    weight=0.0,
                    action=PortfolioAction.DISABLE,
                    reason="disabled",
                ))
                continue

            # Проверка режима
            regime_ok = self._check_regime(slot, current_regime)
            if not regime_ok:
                allocations.append(PortfolioAllocation(
                    slot_name=slot.name,
                    weight=0.0,
                    action=PortfolioAction.DISABLE,
                    reason=f"regime {current_regime.value} not allowed",
                ))
                continue

            # Стратегия активна
            weight = slot.base_weight
            action = PortfolioAction.ENABLE if not slot.is_active else PortfolioAction.NO_CHANGE
            allocations.append(PortfolioAllocation(
                slot_name=slot.name,
                weight=weight,
                action=action,
                reason=f"regime {current_regime.value} OK",
            ))

        return allocations

    @staticmethod
    def _check_regime(slot: StrategySlot, regime: RegimeType) -> bool:
        """Проверить, подходит ли режим для стратегии."""
        if slot.excluded_regimes and regime in slot.excluded_regimes:
            return False
        if slot.allowed_regimes and regime not in slot.allowed_regimes:
            return False
        return True
