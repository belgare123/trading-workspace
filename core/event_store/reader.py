"""
EventStoreReader — read-side API для Event Store.

Предоставляет высокоуровневые методы чтения событий:
- stream-based (по типу агрегата + версия)
- time-based (since/until)
- correlation-based (трассировка цепочек)
- aggregate-based (конкретный экземпляр)

Snapshot + Reader chain:
    snapshot(version=N) → events(N+1..current) → state
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from core.event_store.models import StoredEvent
from core.event_store.repository import EventQuery
from core.event_store.store import EventStore
from core.event_store.trace import TraceGraph, trace_by_correlation, trace_event

logger = logging.getLogger(__name__)


# ── Snapshot + Reader chain ──


@dataclass
class ReaderSnapshot:
    """Снимок, пригодный для EventStoreReader.

    Хранит версию агрегата, на которой был сделан снимок,
    и сериализованное состояние на этот момент.

    Attributes:
        aggregate:     Тип агрегата (``"opportunity"``).
        aggregate_id:  ID агрегата (``"BTCUSDT"``).
        version:       Версия агрегата на момент снимка.
        timestamp:     Время снимка.
        state:         Сериализованное состояние агрегата.
        meta:          Дополнительные данные.
    """
    aggregate: str
    aggregate_id: str
    version: int
    timestamp: float = 0.0
    state: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "aggregate": self.aggregate,
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "timestamp": self.timestamp,
            "state": self.state,
            "meta": self.meta,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReaderSnapshot:
        return cls(
            aggregate=data["aggregate"],
            aggregate_id=data.get("aggregate_id", ""),
            version=data["version"],
            timestamp=data.get("timestamp", 0.0),
            state=data.get("state", {}),
            meta=data.get("meta", {}),
        )


class SnapshotReader:
    """Snapshot + EventStoreReader chain — эффективное восстановление состояния.

    Позволяет восстановить состояние агрегата без повторного чтения
    всей истории: берётся снимок (snapshot), затем дочитываются
    только события после снимка.

    Usage::

        reader = EventStoreReader(store)
        snapreader = SnapshotReader(reader)

        # Восстановить стрим со снимка
        state = await snapreader.restore_stream(
            stream="opportunity",
            aggregate_id="BTCUSDT",
            snapshot=my_snapshot,
        )
    """

    def __init__(self, reader: EventStoreReader) -> None:
        self._reader = reader

    async def restore(
        self,
        snapshot: ReaderSnapshot,
        target_version: int | None = None,
    ) -> list[StoredEvent]:
        """Прочитать события после снимка.

        Args:
            snapshot:       Снимок состояния.
            target_version: Целевая версия (None = все до текущей).

        Returns:
            События после снимка до target_version (или до конца).
        """
        return await self._reader.read(
            stream=snapshot.aggregate,
            from_version=snapshot.version + 1,
            to_version=target_version,
            limit=5000,
        )

    async def restore_stream(
        self,
        stream: str,
        aggregate_id: str,
        snapshot: ReaderSnapshot | None = None,
    ) -> tuple[dict[str, Any], list[StoredEvent]]:
        """Восстановить стрим: снимок (если есть) + дельта-события.

        Args:
            stream:       Тип агрегата.
            aggregate_id: ID агрегата.
            snapshot:     Опциональный снимок.

        Returns:
            (state, events):
                state — восстановленное состояние (снимок + дельта).
                events — все прочитанные события (дельта).
        """
        state: dict[str, Any] = {}
        base_version = 0

        if snapshot is not None:
            state = dict(snapshot.state)
            base_version = snapshot.version

        # Дельта-события
        events = await self._reader.by_aggregate(
            aggregate=stream,
            aggregate_id=aggregate_id,
            from_version=base_version + 1 if base_version > 0 else None,
            limit=5000,
        )

        # Применить события к состоянию (опциональная функция применения)
        state["_snapshot_version"] = base_version
        state["_events_applied"] = len(events)
        state["_latest_version"] = (
            events[-1].aggregate_version if events else base_version
        )

        return state, events

    async def find_latest_snapshot(
        self,
        stream: str,
        aggregate_id: str,
    ) -> ReaderSnapshot | None:
        """Найти последний снимок для агрегата в EventStore.

        Args:
            stream:       Тип агрегата.
            aggregate_id: ID агрегата.

        Returns:
            ``ReaderSnapshot`` или None, если снимков нет.
        """
        raw = await self._reader.latest_snapshot(stream, aggregate_id)
        if raw is None:
            return None

        # payload — декодированная строка JSON из to_dict()
        payload_raw = raw.get("payload", "{}")
        if isinstance(payload_raw, str):
            import json as _json
            try:
                payload = _json.loads(payload_raw)
            except _json.JSONDecodeError:
                payload = {}
        elif isinstance(payload_raw, bytes):
            import json as _json
            try:
                payload = _json.loads(payload_raw.decode("utf-8"))
            except _json.JSONDecodeError:
                payload = {}
        else:
            payload = {}

        return ReaderSnapshot(
            aggregate=stream,
            aggregate_id=aggregate_id,
            version=raw.get("aggregate_version", 0),
            timestamp=raw.get("timestamp", 0.0),
            state=payload if isinstance(payload, dict) else {},
            meta=raw.get("metadata", {}),
        )


@dataclass
class StreamSlice:
    """Срез событий одного стрима.

    Attributes:
        stream:   Тип агрегата (``"decision"``, ``"opportunity"``…).
        version:  Версия первого события в срезе.
        limit:    Размер среза.
        events:   Список событий.
        has_more: Есть ли ещё события.
    """
    stream: str
    version: int
    limit: int
    events: list[StoredEvent] = field(default_factory=list)
    has_more: bool = False

    @property
    def next_version(self) -> int:
        """Версия следующего среза (aggregate_version последнего события + 1)."""
        if not self.events:
            return self.version
        return self.events[-1].aggregate_version + 1


class EventStoreReader:
    """Read-side фасад Event Store для аналитики, Replay и Dashboard.

    Использование::

        reader = EventStoreReader(event_store)

        # Stream-based (события агрегата от версии)
        slice = await reader.read(stream="opportunity", from_version=100)

        # Time-based
        recent = await reader.read_since(ts=1718000000.0)

        # Tail
        last_50 = await reader.tail()

        # Трассировка
        chain = await reader.by_correlation(correlation_id)

        # Конкретный агрегат
        events = await reader.by_aggregate("opportunity", "BTCUSDT")
    """

    def __init__(self, store: EventStore) -> None:
        self._store = store

    # ── Core API ──────────────────────────────────────────────────

    async def read(
        self,
        stream: str,
        from_version: int | None = None,
        to_version: int | None = None,
        limit: int = 100,
        order: str = "asc",
    ) -> list[StoredEvent]:
        """Прочитать события стрима (типа агрегата).

        Args:
            stream:       Имя агрегата (``"decision"``, ``"opportunity"``…).
            from_version: Минимальная aggregate_version (включительно).
            to_version:   Максимальная aggregate_version (включительно).
            limit:        Макс. количество событий.
            order:        ``"asc"`` — по возрастанию версии.

        Returns:
            Список событий, отсортированных по версии.
        """
        return await self._store.read(
            EventQuery(
                aggregate=stream,
                from_version=from_version,
                to_version=to_version,
                limit=limit,
                order=order,
            ),
        )

    async def iter_stream(
        self,
        stream: str,
        from_version: int | None = None,
        batch_size: int = 200,
    ) -> AsyncIterator[list[StoredEvent]]:
        """Ленивый итератор по всем событиям стрима.

        Args:
            stream:       Имя агрегата.
            from_version: Стартовая версия.
            batch_size:   Размер батча.

        Yields:
            Батчи событий по batch_size.
        """
        version = from_version or 1
        while True:
            batch = await self.read(
                stream=stream,
                from_version=version,
                limit=batch_size,
            )
            if not batch:
                break
            yield batch
            version = batch[-1].aggregate_version + 1

    # ── Time-based ────────────────────────────────────────────────

    async def read_since(
        self,
        timestamp: float,
        limit: int = 100,
    ) -> list[StoredEvent]:
        """События после timestamp (включительно).

        Args:
            timestamp: Время в секундах/milliseconds.
            limit:     Макс. количество.
        """
        return await self._store.since(timestamp, limit=limit)

    async def read_range(
        self,
        from_ts: float,
        to_ts: float,
        limit: int = 100,
    ) -> list[StoredEvent]:
        """События в интервале [from_ts, to_ts].

        Args:
            from_ts: Начало интервала.
            to_ts:   Конец интервала.
            limit:   Макс. количество.
        """
        return await self._store.read(
            EventQuery(from_timestamp=from_ts, to_timestamp=to_ts, limit=limit),
        )

    # ── Tail ──────────────────────────────────────────────────────

    async def tail(
        self,
        limit: int = 50,
        stream: str | None = None,
    ) -> list[StoredEvent]:
        """Последние N событий.

        Args:
            limit:  Сколько событий.
            stream: Фильтр по агрегату (опционально).

        Returns:
            События от новых к старым.
        """
        if stream:
            return await self._store.read(
                EventQuery(aggregate=stream, limit=limit, order="desc"),
            )
        return await self._store.tail(limit=limit)

    # ── Correlation / Causation ───────────────────────────────────

    async def by_correlation(
        self,
        correlation_id: str,
        limit: int = 200,
    ) -> list[StoredEvent]:
        """Все события одной трассировочной цепочки.

        Args:
            correlation_id: ID цепочки.
            limit:          Макс. количество.
        """
        return await self._store.by_correlation(correlation_id, limit=limit)

    async def by_causation(
        self,
        causation_id: str,
        limit: int = 50,
    ) -> list[StoredEvent]:
        """Прямые потомки события.

        Args:
            causation_id: ID родительского события.
            limit:        Макс. количество.
        """
        return await self._store.read(
            EventQuery(causation_id=causation_id, limit=limit),
        )

    async def trace(
        self,
        event_id: str,
        max_depth: int = 10,
    ) -> list[list[StoredEvent]]:
        """Рекурсивная трассировка цепочки событий.

        Начинает с event_id, затем идёт по causation_id вглубь и вширь.

        Args:
            event_id: ID стартового события.
            max_depth: Максимальная глубина.

        Returns:
            Список уровней цепочки (level 0 = корень).
        """
        chain: list[list[StoredEvent]] = []
        visited: set[str] = set()
        frontier: list[str] = [event_id]

        for _depth in range(max_depth):
            if not frontier:
                break
            level: list[StoredEvent] = []
            next_frontier: list[str] = []

            for ev_id in frontier:
                if ev_id in visited:
                    continue
                visited.add(ev_id)
                try:
                    event = await self._store.read_one(ev_id)
                    level.append(event)
                    # Найти детей по causation_id
                    children = await self.by_causation(ev_id)
                    next_frontier.extend(e.event_id for e in children)
                except Exception:
                    continue

            if level:
                chain.append(level)
            frontier = next_frontier

        return chain

    # ── Aggregate instances ───────────────────────────────────────

    async def by_aggregate(
        self,
        aggregate: str,
        aggregate_id: str,
        from_version: int | None = None,
        limit: int = 100,
    ) -> list[StoredEvent]:
        """Все события одного агрегата.

        Args:
            aggregate:     Тип агрегата (``"opportunity"``).
            aggregate_id:  ID агрегата (``"BTCUSDT"``).
            from_version:  Минимальная версия.
            limit:         Макс. количество.
        """
        return await self._store.by_aggregate(
            aggregate=aggregate,
            aggregate_id=aggregate_id,
            limit=limit,
        )

    async def latest_snapshot(
        self,
        aggregate: str,
        aggregate_id: str,
    ) -> dict[str, Any] | None:
        """Последний снимок агрегата (если есть).

        Args:
            aggregate:    Тип агрегата.
            aggregate_id: ID агрегата.

        Returns:
            ``to_dict()`` последнего события-снимка, или None.
        """
        events = await self._store.read(
            EventQuery(
                aggregate=aggregate,
                aggregate_id=aggregate_id,
                topic=f"{aggregate}.snapshot",
                limit=1,
                order="desc",
            ),
        )
        if events:
            return events[0].to_dict()
        return None

    # ── Trace API ─────────────────────────────────────────────────

    async def trace(self, correlation_id: str, max_depth: int = 20) -> TraceGraph:
        """Полный граф трассировки по correlation_id.

        Args:
            correlation_id: ID трассировочной цепочки.
            max_depth:      Максимальная глубина.

        Returns:
            ``TraceGraph`` со всеми узлами цепочки.
        """
        return await trace_by_correlation(self, correlation_id, max_depth=max_depth)

    async def trace_event(self, event_id: str, max_depth: int = 10) -> TraceGraph:
        """Граф трассировки от конкретного события.

        Args:
            event_id:  ID стартового события.
            max_depth: Максимальная глубина.

        Returns:
            ``TraceGraph`` с цепочкой от event_id.
        """
        return await trace_event(self, event_id, max_depth=max_depth)

    # ── Utility ───────────────────────────────────────────────────

    async def count(
        self,
        stream: str | None = None,
        aggregate_id: str | None = None,
    ) -> int:
        """Количество событий по фильтру.

        Args:
            stream:       Фильтр по агрегату.
            aggregate_id: Фильтр по ID агрегата.
        """
        return await self._store.count(
            EventQuery(
                aggregate=stream,
                aggregate_id=aggregate_id,
            ),
        )

    async def earliest(self, stream: str) -> StoredEvent | None:
        """Самое раннее событие в стриме."""
        events = await self._store.read(
            EventQuery(aggregate=stream, limit=1, order="asc"),
        )
        return events[0] if events else None

    async def latest(self, stream: str) -> StoredEvent | None:
        """Самое свежее событие в стриме."""
        events = await self._store.read(
            EventQuery(aggregate=stream, limit=1, order="desc"),
        )
        return events[0] if events else None
