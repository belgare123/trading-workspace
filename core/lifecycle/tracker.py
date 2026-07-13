"""
8.3 Opportunity Tracker — текущее состояние активной позиции.

Отслеживает:
  - Current RR
  - Current Profit/Loss
  - Current Drawdown
  - Time Alive
  - Highest/Lowest Price
  - Distance to Stop / Target
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from core.lifecycle.models import LifecycleMetrics, Position

logger = logging.getLogger(__name__)


class OpportunityTracker:
    """Трекер состояния активной позиции.

    Usage:
        tracker = OpportunityTracker()
        metrics = tracker.update(position, current_price=64700.0)
    """

    def update(
        self,
        position: Position,
        current_price: float,
    ) -> LifecycleMetrics:
        """Вычислить текущие метрики по позиции.

        Args:
            position:      Открытая позиция.
            current_price: Текущая рыночная цена.

        Returns:
            LifecycleMetrics.
        """
        direction = position.direction.lower()
        entry = position.entry_price

        # Highest/Lowest
        highest = max(position.highest_price, current_price)
        lowest = min(position.lowest_price, current_price)

        # Текущий PnL
        if direction == "long":
            current_pnl = (current_price - entry) / entry * 100
            # MFE = максимальное движение в нашу пользу
            mfe = (highest - entry) / entry * 100
            # MAE = максимальное движение против нас
            mae = (entry - lowest) / entry * 100
            distance_to_stop = current_price - position.stop_loss if position.stop_loss else 0.0
            distance_to_target1 = (
                (position.targets[0] - current_price)
                if position.targets
                else 0.0
            )
        else:
            current_pnl = (entry - current_price) / entry * 100
            mfe = (entry - lowest) / entry * 100
            mae = (highest - entry) / entry * 100
            distance_to_stop = position.stop_loss - current_price if position.stop_loss else 0.0
            distance_to_target1 = (
                (current_price - position.targets[0])
                if position.targets
                else 0.0
            )

        # Drawdown (от пика)
        peak = highest if direction == "long" else lowest
        if direction == "long":
            drawdown = (peak - current_price) / peak * 100
        else:
            drawdown = (current_price - peak) / current_price * 100
        drawdown = max(0.0, drawdown)

        # Time alive
        now = time.time()
        time_alive = now - position.opened_at

        # Current RR (упрощённо: pnl / риск)
        risk = abs(entry - position.stop_loss) / entry if position.stop_loss else 1.0
        current_rr = abs(current_price - entry) / (entry * risk) if risk > 0 else 0.0

        # Volatility (простая оценка: размах High-Low средний)
        if highest > 0 and lowest > 0:
            volatility = (highest - lowest) / entry * 100
        else:
            volatility = 0.0

        # Обновляем Position
        position.highest_price = highest
        position.lowest_price = lowest

        return LifecycleMetrics(
            opportunity_id=position.opportunity_id,
            current_rr=current_rr,
            current_pnl=current_pnl,
            current_drawdown=drawdown,
            highest_price=highest,
            lowest_price=lowest,
            mfe=mfe,
            mae=mae,
            time_alive=time_alive,
            distance_to_stop=distance_to_stop,
            distance_to_target1=distance_to_target1,
            volatility=volatility,
            updated_at=now,
        )
