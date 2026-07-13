"""
Opportunity Versioning — управление версиями торговой идеи.

Каждая Opportunity может иметь версии (v1 → v2 → v3 → v4).
Версия создаётся при изменении ключевых параметров:
  - confidence
  - entry_price
  - stop_loss
  - targets
  - state

Позволяет:
  - Explain: почему изменился сигнал
  - Replay: воспроизводить развитие идеи
  - Audit: полная история изменений
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from core.lifecycle.models import OpportunityState, OpportunityVersion

logger = logging.getLogger(__name__)


# Поля, изменения которых создают новую версию
_VERSION_TRIGGERS = frozenset({
    "direction",
    "entry_price",
    "stop_loss",
    "targets",
    "confidence",
    "state",
})


class VersionTracker:
    """Трекер версий Opportunity.

    Usage:
        tracker = VersionTracker()
        v1 = tracker.snapshot(opp_id="opp_123", state=..., ...)
        v2 = tracker.snapshot(opp_id="opp_123", state=..., ...)
        # v2 будет иметь version=2, prev_version=1
        history = tracker.get_history("opp_123")
    """

    def __init__(self) -> None:
        self._versions: dict[str, list[OpportunityVersion]] = {}

    def snapshot(
        self,
        opportunity_id: str,
        state: OpportunityState,
        direction: str,
        entry_price: float,
        stop_loss: float | None = None,
        targets: list[float] | None = None,
        confidence: float = 0.0,
        reason: str = "",
        changes: dict[str, Any] | None = None,
        meta: dict[str, Any] | None = None,
    ) -> OpportunityVersion:
        """Создать снимок версии.

        Args:
            opportunity_id: ID Opportunity.
            state:          Текущее состояние.
            direction:      Направление.
            entry_price:    Цена входа.
            stop_loss:      Стоп-лосс.
            targets:        Целевые уровни.
            confidence:     Уверенность.
            reason:         Причина изменения.
            changes:        Изменённые поля.
            meta:           Метаданные.

        Returns:
            OpportunityVersion.
        """
        history = self._versions.setdefault(opportunity_id, [])
        prev_version = history[-1].version if history else None

        version = OpportunityVersion(
            opportunity_id=opportunity_id,
            version=len(history) + 1,
            state=state,
            direction=direction,
            entry_price=entry_price,
            stop_loss=stop_loss,
            targets=targets or [],
            confidence=confidence,
            reason=reason,
            prev_version=prev_version,
            changes=changes or {},
            meta=meta or {},
        )

        history.append(version)
        logger.debug("Version %s#%d: %s", opportunity_id[:8], version.version, reason)
        return version

    def get_version(
        self,
        opportunity_id: str,
        version: int,
    ) -> OpportunityVersion | None:
        """Получить конкретную версию.

        Args:
            opportunity_id: ID Opportunity.
            version:        Номер версии (1-indexed).

        Returns:
            OpportunityVersion или None.
        """
        history = self._versions.get(opportunity_id, [])
        if 1 <= version <= len(history):
            return history[version - 1]
        return None

    def get_history(
        self,
        opportunity_id: str,
    ) -> list[OpportunityVersion]:
        """Получить всю историю версий.

        Args:
            opportunity_id: ID Opportunity.

        Returns:
            Список версий в хронологическом порядке.
        """
        return list(self._versions.get(opportunity_id, []))

    def get_latest(
        self,
        opportunity_id: str,
    ) -> OpportunityVersion | None:
        """Получить последнюю версию.

        Args:
            opportunity_id: ID Opportunity.

        Returns:
            Последняя версия или None.
        """
        history = self._versions.get(opportunity_id, [])
        return history[-1] if history else None

    def diff(
        self,
        opportunity_id: str,
        v1: int,
        v2: int,
    ) -> dict[str, tuple[Any, Any]]:
        """Сравнить две версии.

        Args:
            opportunity_id: ID Opportunity.
            v1:             Номер версии A.
            v2:             Номер версии B.

        Returns:
            Dict {field: (old_value, new_value)}.
        """
        ver_a = self.get_version(opportunity_id, v1)
        ver_b = self.get_version(opportunity_id, v2)
        if not ver_a or not ver_b:
            return {}

        diffs: dict[str, tuple[Any, Any]] = {}
        for field in _VERSION_TRIGGERS:
            old = getattr(ver_a, field, None)
            new = getattr(ver_b, field, None)
            if old != new:
                diffs[field] = (old, new)

        return diffs

    def clear(self, opportunity_id: str | None = None) -> None:
        """Очистить историю.

        Args:
            opportunity_id: ID (None = всё).
        """
        if opportunity_id:
            self._versions.pop(opportunity_id, None)
        else:
            self._versions.clear()

    @property
    def total_versions(self) -> int:
        return sum(len(v) for v in self._versions.values())

    @property
    def tracked_opportunities(self) -> int:
        return len(self._versions)
