"""
8.2 Entry Monitor — отслеживание входа в позицию.

Каждая Opportunity имеет entry_price.
Entry Monitor проверяет, достигла ли текущая цена уровня входа.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


class EntryStatus:
    """Статус мониторинга входа."""
    PENDING = "pending"
    ENTERED = "entered"
    MISSED = "missed"
    EXPIRED = "expired"


@dataclass
class EntryResult:
    """Результат проверки входа."""
    status: str  # EntryStatus.*
    current_price: float = 0.0
    entry_price: float = 0.0
    deviation_pct: float = 0.0  # насколько цена далека от entry
    message: str = ""


EntryResultLike = EntryResult


class EntryMonitor:
    """Мониторинг входа в позицию.

    Проверяет, достигла ли текущая цена entry_price Opportunity.
    Учитывает направление: long entry = цена <= entry, short entry = цена >= entry.

    Usage:
        monitor = EntryMonitor()
        result = monitor.check(
            current_price=64800.0,
            entry_price=64500.0,
            direction="long",
        )
        if result.status == EntryStatus.ENTERED:
            print("Entry reached!")
    """

    # Допустимое отклонение от entry в % (по умолчанию 0.1%)
    DEFAULT_TOLERANCE_PCT = 0.1

    def check(
        self,
        current_price: float,
        entry_price: float,
        direction: str = "long",
        tolerance_pct: float = DEFAULT_TOLERANCE_PCT,
    ) -> EntryResult:
        """Проверить, достигнута ли точка входа.

        Args:
            current_price: Текущая рыночная цена.
            entry_price:   Целевая цена входа.
            direction:     "long" (entry = ниже текущей) или "short" (entry = выше).
            tolerance_pct: Допуск в % от entry.

        Returns:
            EntryResult.
        """
        deviation = abs(current_price - entry_price) / entry_price * 100
        direction = direction.lower()

        entered = False
        if direction == "long":
            # Long: entry достигнут, когда цена <= entry (с допуском)
            if current_price <= entry_price * (1.0 + tolerance_pct / 100):
                entered = True
        elif direction == "short":
            # Short: entry достигнут, когда цена >= entry (с допуском)
            if current_price >= entry_price * (1.0 - tolerance_pct / 100):
                entered = True
        else:
            # Любое направление: цена в пределах tolerance_pct от entry
            if deviation <= tolerance_pct:
                entered = True

        if entered:
            return EntryResult(
                status=EntryStatus.ENTERED,
                current_price=current_price,
                entry_price=entry_price,
                deviation_pct=deviation,
                message=f"Entry reached at {current_price} (target {entry_price})",
            )

        missed = deviation > tolerance_pct * 5  # далеко от entry
        return EntryResult(
            status=EntryStatus.MISSED if missed else EntryStatus.PENDING,
            current_price=current_price,
            entry_price=entry_price,
            deviation_pct=deviation,
            message=f"Waiting for entry: current={current_price}, target={entry_price}",
        )

    def distance_to_entry(
        self,
        current_price: float,
        entry_price: float,
        direction: str = "long",
    ) -> float:
        """Расстояние до точки входа в процентах.

        Args:
            current_price: Текущая цена.
            entry_price:   Целевая цена входа.
            direction:     "long" или "short".

        Returns:
            Расстояние в % (положительное = цена ещё не в entry).
        """
        if direction == "long":
            return max(0.0, (current_price - entry_price) / entry_price * 100)
        else:
            return max(0.0, (entry_price - current_price) / entry_price * 100)
