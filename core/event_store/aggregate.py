"""
Aggregate Streams — полноценный Event Sourcing слой.

Позволяет загружать агрегаты, добавлять события с оптимистичным
контролем версий, создавать/восстанавливать снимки.

Архитектура:
    AggregateStream    — контейнер событий одного агрегата
    AggregateSnapshot  — снимок состояния агрегата
    AggregateRepository — загрузка/запись/снимки через EventStore
    ConcurrencyError   — ошибка при conflict версий

Пример::

    repo = AggregateRepository(store)
    agg  = await repo.load("opportunity", "BTCUSDT")
    print(agg.version(), agg.latest())
    agg.export_json()

    await repo.append(store.new_event(...), expected_version=5)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from core.event_store.models import StoredEvent
from core.event_store.store import EventStore

logger = logging.getLogger(__name__)


# ── Исключения ──


class ConcurrencyError(Exception):
    """Конфликт версий при optimistic concurrency append.

    Возникает, когда expected_version не совпадает с текущей
    версией агрегата.
    """

    def __init__(
        self,
        aggregate_type: str,
        aggregate_id: str,
        expected: int,
        current: int,
    ) -> None:
        self.aggregate_type = aggregate_type
        self.aggregate_id = aggregate_id
        self.expected = expected
        self.current = current
        super().__init__(
            f"Aggregate {aggregate_type}/{aggregate_id}: "
            f"expected version {expected}, current {current}"
        )


# ── AggregateSnapshot ──


@dataclass
class AggregateSnapshot:
    """Снимок состояния агрегата.

    Позволяет восстановить агрегат без проигрывания всех событий
    с начала времён.
    """

    aggregate_type: str
    aggregate_id: str
    version: int
    state: dict[str, Any] = field(default_factory=dict)
    timestamp: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_event(cls, event: StoredEvent) -> AggregateSnapshot:
        """Создать начальный снимок из события."""
        return cls(
            aggregate_type=event.aggregate,
            aggregate_id=event.aggregate_id,
            version=event.aggregate_version,
            state=_default_state(event),
            timestamp=event.timestamp,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "aggregate_type": self.aggregate_type,
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "state": self.state,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AggregateSnapshot:
        return cls(
            aggregate_type=data["aggregate_type"],
            aggregate_id=data["aggregate_id"],
            version=data["version"],
            state=data.get("state", {}),
            timestamp=data.get("timestamp", 0.0),
            metadata=data.get("metadata", {}),
        )


def _default_state(event: StoredEvent) -> dict[str, Any]:
    """Базовое состояние из события."""
    try:
        payload = json.loads(event.payload.decode("utf-8")) if event.payload else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        payload = {}
    return {
        "aggregate": event.aggregate,
        "aggregate_id": event.aggregate_id,
        "topic": event.topic,
        "source": event.source,
        "payload": payload,
    }


# ── AggregateStream ──


class AggregateStream:
    """Поток событий одного агрегата.

    Позволяет навигировать по истории, получать снимки,
    и экспортировать агрегат для Dashboard/Inspector.

    Пример::

        agg = await repo.load("opportunity", "BTCUSDT")
        agg.version()       # 42
        agg.latest()        # последнее событие
        agg.history()       # все события
        agg.export_json()   # экспорт
    """

    def __init__(
        self,
        aggregate_type: str,
        aggregate_id: str,
        events: list[StoredEvent] | None = None,
        snapshot: AggregateSnapshot | None = None,
    ) -> None:
        self.aggregate_type = aggregate_type
        self.aggregate_id = aggregate_id
        self._events: list[StoredEvent] = list(events or [])
        self._snapshot = snapshot

    # ── Свойства ──

    @property
    def version(self) -> int:
        """Текущая версия агрегата (0 если нет событий)."""
        return self.latest().aggregate_version if self._events else 0

    @property
    def event_count(self) -> int:
        """Количество событий в агрегате."""
        return len(self._events)

    # ── Доступ к событиям ──

    def events(self) -> list[StoredEvent]:
        """Все события агрегата, от начала."""
        return list(self._events)

    def latest(self) -> StoredEvent | None:
        """Последнее событие (текущее состояние)."""
        return self._events[-1] if self._events else None

    def history(self) -> list[StoredEvent]:
        """Полная история (алиас events())."""
        return self.events()

    def since(self, from_version: int) -> list[StoredEvent]:
        """События начиная с версии."""
        return [ev for ev in self._events if ev.aggregate_version >= from_version]

    def at_version(self, version: int) -> StoredEvent | None:
        """Событие на конкретной версии."""
        for ev in self._events:
            if ev.aggregate_version == version:
                return ev
        return None

    def replay(self) -> list[StoredEvent]:
        """Воспроизведение (алиас events для совместимости с Replay)."""
        return self.events()

    # ── Снимки ──

    @property
    def has_snapshot(self) -> bool:
        """Есть ли снимок состояния."""
        return self._snapshot is not None

    @property
    def snapshot_version(self) -> int:
        """Версия снимка (0 если нет)."""
        return self._snapshot.version if self._snapshot else 0

    def snapshot(self) -> AggregateSnapshot | None:
        """Получить снимок."""
        return self._snapshot

    def make_snapshot(self) -> AggregateSnapshot:
        """Создать снимок текущего состояния."""
        if not self._events:
            raise ValueError("Cannot snapshot an aggregate with no events")
        latest_ev = self._events[-1]
        snap = AggregateSnapshot.from_event(latest_ev)
        snap.version = self.version
        snap.timestamp = latest_ev.timestamp
        self._snapshot = snap
        return snap

    # ── Diff ──

    def diff(self, v1: int, v2: int) -> dict[str, Any]:
        """Разница между двумя версиями агрегата.

        Returns:
            dict с версиями и событиями между ними.
        """
        left = self.at_version(v1)
        right = self.at_version(v2)
        between = [
            ev for ev in self._events
            if v1 < ev.aggregate_version <= v2
        ]
        return {
            "from_version": v1,
            "to_version": v2,
            "from_event": left.to_dict() if left else None,
            "to_event": right.to_dict() if right else None,
            "events_between": [ev.to_dict() for ev in between],
            "count": len(between),
        }

    # ── Экспорт ──

    def to_dict(self) -> dict[str, Any]:
        """Сериализация агрегата."""
        return {
            "aggregate_type": self.aggregate_type,
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "event_count": self.event_count,
            "snapshot_version": self.snapshot_version if self._snapshot else None,
            "latest_topic": self.latest().topic if self.latest() else None,
            "latest_timestamp": self.latest().timestamp if self.latest() else None,
        }

    def export_json(self, indent: int = 2) -> str:
        """Экспорт в JSON для Dashboard/Inspector."""
        data = {
            "aggregate_type": self.aggregate_type,
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "event_count": self.event_count,
            "snapshot": self._snapshot.to_dict() if self._snapshot else None,
            "events": [ev.to_dict() for ev in self._events],
        }
        return json.dumps(data, indent=indent, default=str)

    def __repr__(self) -> str:
        return (
            f"AggregateStream(type={self.aggregate_type!r}, "
            f"id={self.aggregate_id!r}, version={self.version}, "
            f"events={self.event_count})"
        )


# ── AggregateRepository ──


class AggregateRepository:
    """Репозиторий для работы с агрегатами.

    Предоставляет полный API Event Sourcing:
    загрузка, запись с OC, снимки, восстановление.

    Использует EventStore под капотом, но добавляет
    агрегатную логику поверх.
    """

    def __init__(self, store: EventStore) -> None:
        self._store = store

    # ── Загрузка ──

    async def load(
        self,
        aggregate_type: str,
        aggregate_id: str,
        from_version: int = 0,
    ) -> AggregateStream:
        """Загрузить агрегат.

        Args:
            aggregate_type: Тип агрегата (opportunity, trade, ...).
            aggregate_id:   ID агрегата.
            from_version:   С какой версии загружать (0 = всё).

        Returns:
            ``AggregateStream`` с событиями и снимком (если есть).
        """
        from core.event_store.repository import EventQuery

        events = await self._store.read(
            EventQuery(
                aggregate=aggregate_type,
                aggregate_id=aggregate_id,
                from_version=from_version,
                limit=5000,
            )
        )
        return AggregateStream(
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            events=events,
        )

    # ── Запись —─

    async def append(
        self,
        event: StoredEvent,
        expected_version: int | None = None,
    ) -> StoredEvent:
        """Добавить событие с оптимистичным контролем версий.

        Args:
            event:            Событие для записи.
            expected_version: Ожидаемая версия агрегата.
                              None = без проверки (обычный publish).

        Returns:
            Сохранённое событие.

        Raises:
            ConcurrencyError: Если expected_version != current version.
        """
        if expected_version is not None:
            current = await self._store.latest_version(event.aggregate_id)
            if current != expected_version:
                raise ConcurrencyError(
                    aggregate_type=event.aggregate,
                    aggregate_id=event.aggregate_id,
                    expected=expected_version,
                    current=current,
                )
        return await self._store.publish(event)

    # ── Снимки ──

    async def save_snapshot(
        self,
        snapshot: AggregateSnapshot,
    ) -> None:
        """Сохранить снимок.

        Снимки хранятся в отдельной таблице event_store_snapshots.
        """
        conn = self._store.repo._ensure_conn()
        conn.execute(
            """CREATE TABLE IF NOT EXISTS event_store_snapshots (
                aggregate_type TEXT NOT NULL,
                aggregate_id   TEXT NOT NULL,
                version        INTEGER NOT NULL,
                state          TEXT NOT NULL,
                timestamp      REAL NOT NULL,
                metadata       TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (aggregate_type, aggregate_id)
            )"""
        )
        conn.execute(
            """INSERT OR REPLACE INTO event_store_snapshots
               (aggregate_type, aggregate_id, version, state, timestamp, metadata)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                snapshot.aggregate_type,
                snapshot.aggregate_id,
                snapshot.version,
                json.dumps(snapshot.state, default=str),
                snapshot.timestamp,
                json.dumps(snapshot.metadata, default=str),
            ),
        )

    async def load_snapshot(
        self,
        aggregate_type: str,
        aggregate_id: str,
    ) -> AggregateSnapshot | None:
        """Загрузить снимок агрегата.

        Returns:
            ``AggregateSnapshot`` или None.
        """
        conn = self._store.repo._ensure_conn()
        conn.execute(
            """CREATE TABLE IF NOT EXISTS event_store_snapshots (
                aggregate_type TEXT NOT NULL,
                aggregate_id   TEXT NOT NULL,
                version        INTEGER NOT NULL,
                state          TEXT NOT NULL,
                timestamp      REAL NOT NULL,
                metadata       TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (aggregate_type, aggregate_id)
            )"""
        )
        cur = conn.execute(
            """SELECT * FROM event_store_snapshots
               WHERE aggregate_type = ? AND aggregate_id = ?""",
            (aggregate_type, aggregate_id),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return AggregateSnapshot(
            aggregate_type=row["aggregate_type"],
            aggregate_id=row["aggregate_id"],
            version=row["version"],
            state=json.loads(row["state"]),
            timestamp=row["timestamp"],
            metadata=json.loads(row["metadata"]),
        )

    async def delete_snapshot(
        self,
        aggregate_type: str,
        aggregate_id: str,
    ) -> bool:
        """Удалить снимок агрегата.

        Returns:
            True если снимок был удалён.
        """
        conn = self._store.repo._ensure_conn()
        cur = conn.execute(
            """DELETE FROM event_store_snapshots
               WHERE aggregate_type = ? AND aggregate_id = ?""",
            (aggregate_type, aggregate_id),
        )
        return cur.rowcount > 0

    # ── Восстановление (Snapshot + Events) ──

    async def restore(
        self,
        aggregate_type: str,
        aggregate_id: str,
    ) -> AggregateStream | None:
        """Восстановить агрегат из снимка + события после.

        Если снимка нет — загружает все события.

        Returns:
            ``AggregateStream`` или None (если нет ни снимка, ни событий).
        """
        snap = await self.load_snapshot(aggregate_type, aggregate_id)

        if snap is None:
            # Нет снимка — пробуем загрузить события
            agg = await self.load(aggregate_type, aggregate_id)
            return agg if agg.event_count > 0 else None

        # События после снимка
        from core.event_store.repository import EventQuery

        events = await self._store.read(
            EventQuery(
                aggregate=aggregate_type,
                aggregate_id=aggregate_id,
                from_version=snap.version + 1,
                limit=5000,
            )
        )
        return AggregateStream(
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            events=events,
            snapshot=snap,
        )

    # ── Версия ──

    async def version(
        self,
        aggregate_type: str,
        aggregate_id: str,
    ) -> int:
        """Текущая версия агрегата (0 если нет событий)."""
        return await self._store.latest_version(aggregate_id)


__all__ = [
    "AggregateStream",
    "AggregateSnapshot",
    "AggregateRepository",
    "ConcurrencyError",
]
