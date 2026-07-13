"""
8.6 Expiration Engine — управление TTL для каждого этапа Lifecycle.

Оппортьюнити может истечь на любом этапе:
- CREATED: 60 min
- VALIDATED: 30 min
- WAITING_ENTRY: 20 min (entry TTL)
- ACTIVE: no limit (ждём тейк/стоп)
"""

from __future__ import annotations

import logging
import time
from typing import Any

from core.lifecycle.models import OpportunityState

logger = logging.getLogger(__name__)


# TTL в секундах для каждого состояния
DEFAULT_TTL: dict[OpportunityState, float] = {
    OpportunityState.CREATED: 3600.0,        # 60 min
    OpportunityState.VALIDATED: 1800.0,      # 30 min
    OpportunityState.WAITING_ENTRY: 1200.0,  # 20 min
}


class ExpirationEngine:
    """Двигатель истечения Opportunity.

    Проверяет, не истёк ли TTL для текущего состояния.
    Если TTL истёк — возвращает новый статус EXPIRED.

    Usage:
        engine = ExpirationEngine()
        expired = engine.check(
            state=OpportunityState.WAITING_ENTRY,
            entered_at=1718000000.0,
        )
        if expired:
            print("Opportunity expired!")
    """

    def __init__(self) -> None:
        self._overrides: dict[OpportunityState, float] = {}

    def set_ttl(self, state: OpportunityState, ttl_seconds: float) -> None:
        """Установить кастомный TTL для состояния.

        Args:
            state:       Состояние.
            ttl_seconds: TTL в секундах.
        """
        self._overrides[state] = ttl_seconds

    def get_ttl(self, state: OpportunityState) -> float:
        """Получить TTL для состояния.

        Args:
            state: Состояние.

        Returns:
            TTL в секундах.
        """
        return self._overrides.get(state, DEFAULT_TTL.get(state, float("inf")))

    def check(
        self,
        state: OpportunityState,
        entered_at: float,
        now: float | None = None,
    ) -> bool:
        """Проверить, истёк ли TTL для данного состояния.

        Args:
            state:      Текущее состояние.
            entered_at: Timestamp входа в это состояние (unix sec).
            now:        Текущее время (unix sec), None = utcnow.

        Returns:
            True если Opportunity должна быть EXPIRED.
        """
        if state not in DEFAULT_TTL and state not in self._overrides:
            return False  # нет TTL для этого состояния

        ttl = self.get_ttl(state)
        if ttl == float("inf"):
            return False

        now = now or time.time()
        elapsed = now - entered_at
        return elapsed >= ttl

    def remaining(
        self,
        state: OpportunityState,
        entered_at: float,
        now: float | None = None,
    ) -> float:
        """Оставшееся время до истечения.

        Args:
            state:      Текущее состояние.
            entered_at: Timestamp входа.
            now:        Текущее время.

        Returns:
            Секунд до истечения (0 = уже истекло).
        """
        ttl = self.get_ttl(state)
        if ttl == float("inf"):
            return float("inf")

        now = now or time.time()
        elapsed = now - entered_at
        return max(0.0, ttl - elapsed)
