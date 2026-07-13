"""
8.7 Opportunity Journal — хронология жизни торговой идеи.

Append-only лог событий для Replay Engine.
Полная хронология: Created → Entry → Target1 → Stop moved → Closed.
"""

from __future__ import annotations

import logging
from typing import Any

from core.lifecycle.models import JournalEntry

logger = logging.getLogger(__name__)


class OpportunityJournal:
    """Журнал жизненного цикла Opportunity.

    Append-only: записи только добавляются, не удаляются.
    Позволяет воспроизвести полную хронологию.

    Usage:
        journal = OpportunityJournal()
        journal.record("created", opportunity_id="opp_123", data={"entry": 64500})
        journal.record("entry", opportunity_id="opp_123", data={"price": 64500})
        journal.record("target1", opportunity_id="opp_123", data={"price": 65000})
        timeline = journal.get_timeline("opp_123")
    """

    def __init__(self) -> None:
        self._entries: list[JournalEntry] = []

    def record(
        self,
        event_type: str,
        opportunity_id: str,
        data: dict[str, Any] | None = None,
    ) -> JournalEntry:
        """Записать событие в журнал.

        Args:
            event_type:     Тип события (напр. "created", "entry", "target1").
            opportunity_id: ID Opportunity.
            data:           Дополнительные данные.

        Returns:
            Созданная запись JournalEntry.
        """
        entry = JournalEntry(
            opportunity_id=opportunity_id,
            event_type=event_type,
            data=data or {},
        )
        self._entries.append(entry)
        logger.debug(
            "Journal[%s] %s: %s",
            opportunity_id[:8],
            event_type,
            data,
        )
        return entry

    def get_timeline(
        self,
        opportunity_id: str,
    ) -> list[JournalEntry]:
        """Получить хронологию для Opportunity.

        Args:
            opportunity_id: ID Opportunity.

        Returns:
            Список записей в хронологическом порядке.
        """
        return [
            e for e in self._entries
            if e.opportunity_id == opportunity_id
        ]

    def get_all(self) -> list[JournalEntry]:
        """Получить все записи."""
        return list(self._entries)

    def clear(self) -> None:
        self._entries.clear()

    @property
    def count(self) -> int:
        return len(self._entries)

    def export(self) -> list[dict[str, Any]]:
        """Экспортировать все записи в список dict.

        Returns:
            Список словарей для сериализации.
        """
        return [e.to_dict() for e in self._entries]
