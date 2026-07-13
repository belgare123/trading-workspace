"""
ReplayEventStoreSource — источник данных для Replay поверх EventStoreReader.

Заменяет ReplaySource (.market-пакеты) на чтение из EventStore.
EventStoreReader → Replay Timeline.

Архитектура:
    EventStoreReader.read(stream="market", ...)
        │
        ▼
    ReplayEventStoreSource.tick()
        │
        ▼
    Timeline → Strategies → Decision → Lifecycle → Quality
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

from core.event_store import EventQuery, EventStoreReader, StoredEvent
from core.replay.models import ReplayEvent, ReplayStreamType
from core.replay.source import MarketSource

logger = logging.getLogger(__name__)


# ── Converter: StoredEvent → ReplayEvent ──


def stored_to_replay(stored: StoredEvent) -> ReplayEvent | None:
    """Конвертировать StoredEvent в ReplayEvent.

    Пробует извлечь ReplayEvent из payload.
    Если payload не содержит данных Replay — возвращает None.
    """
    try:
        raw = json.loads(stored.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None

    replay_raw = raw.get("data", {})

    # Определить stream
    stream = raw.get("stream", "")
    if not stream and stored.topic:
        # Из topic: "candle.BTCUSDT" → stream="candle"
        parts = stored.topic.split(".")
        if len(parts) >= 1:
            stream = parts[0]

    if not stream:
        return None

    # Определить symbol
    symbol = raw.get("symbol", "") or replay_raw.get("symbol", "") or stored.aggregate_id.split("#")[-1] if "#" in stored.aggregate_id else ""

    return ReplayEvent(
        id=stored.event_id,
        timestamp=stored.timestamp,
        stream=stream,
        symbol=symbol,
        data=replay_raw if isinstance(replay_raw, dict) else raw,
    )


# ── ReplayEventStoreSource ──


class ReplayEventStoreSource(MarketSource):
    """Источник данных для Replay, читающий события из EventStore.

    Вместо .market-пакетов использует EventStoreReader.
    Поддерживает:
      - stream-based чтение (``stream="market"``)
      - time-based чтение (``since``)
      - ленивую итерацию батчами

    Usage::

        reader = EventStoreReader(store)
        source = ReplayEventStoreSource(
            reader=reader,
            stream="market",
            since=1718000000.0,
        )
        source.start()
        events = source.tick()  # возвращает ReplayEvent[]
    """

    def __init__(
        self,
        reader: EventStoreReader,
        stream: str = "market",
        since: float | None = None,
        until: float | None = None,
        batch_size: int = 500,
    ) -> None:
        self._reader = reader
        self._stream = stream
        self._since = since
        self._until = until
        self._batch_size = batch_size

        self._running = False
        self._cursor: int | None = None  # последняя aggregate_version
        self._buffer: list[ReplayEvent] = []
        self._buffer_idx = 0
        self._subscriptions: dict[str, list[Callable[[ReplayEvent], None]]] = {}
        self._current_time: float = since or 0.0

    # ── MarketSource implementation ──

    @property
    def is_live(self) -> bool:
        return False

    @property
    def current_timestamp(self) -> float:
        return self._current_time

    @property
    def progress(self) -> float:
        """Приблизительный прогресс (0..1)."""
        if self._cursor is None:
            return 0.0
        # Если нет until — прогресс неопределён
        return 0.0

    @property
    def is_finished(self) -> bool:
        return self._running and not self._buffer and self._cursor is not None and self._buffer_done

    _buffer_done: bool = False

    def start(self) -> None:
        self._running = True
        logger.info(
            "ReplayEventStoreSource started (stream=%s, since=%s)",
            self._stream, self._since,
        )

    def stop(self) -> None:
        self._running = False
        logger.info("ReplayEventStoreSource stopped")

    # ── Reading ──

    async def _load_next_batch(self) -> list[ReplayEvent]:
        """Загрузить следующий батч из EventStore.

        Returns:
            Список ReplayEvent (может быть пустым, если данных нет).
        """
        import asyncio

        query = EventQuery(
            aggregate=self._stream,
            from_version=self._cursor,
            limit=self._batch_size,
            order="asc",
        )
        if self._since:
            query.from_timestamp = self._since
            self._since = None  # только для первого запроса
        if self._until:
            query.to_timestamp = self._until

        stored_events = await self._reader._store.read(query)

        replay_events: list[ReplayEvent] = []
        for se in stored_events:
            replay = stored_to_replay(se)
            if replay is not None:
                replay_events.append(replay)

        if stored_events:
            self._cursor = stored_events[-1].aggregate_version + 1
        else:
            self._buffer_done = True

        return replay_events

    def tick(self) -> list[ReplayEvent]:
        """Выдать события для текущего тика.

        Синхронная обёртка над асинхронным _load_next_batch.
        Если буфер пуст — загружает следующий батч.
        """
        if not self._running:
            return []

        # Если буфер пуст — загрузить следующий батч
        if self._buffer_idx >= len(self._buffer):
            import asyncio

            # В синхронном контексте — запускаем асинхронно
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            new_events = loop.run_until_complete(self._load_next_batch())
            if not new_events:
                return []
            self._buffer = new_events
            self._buffer_idx = 0

        # Выдать одно событие (или несколько, если batch_size=1)
        events = []
        while self._buffer_idx < len(self._buffer):
            event = self._buffer[self._buffer_idx]
            self._buffer_idx += 1
            self._current_time = event.timestamp
            events.append(event)
            self.emit(event)

        return events

    # ── Subscriptions ──

    def subscribe(self, stream: str, symbol: str, callback: Callable[[ReplayEvent], None]) -> None:
        key = f"{stream}:{symbol}"
        self._subscriptions.setdefault(key, []).append(callback)

    def unsubscribe(self, stream: str, symbol: str, callback: Callable[[ReplayEvent], None]) -> None:
        key = f"{stream}:{symbol}"
        subs = self._subscriptions.get(key, [])
        if callback in subs:
            subs.remove(callback)

    def emit(self, event: ReplayEvent) -> None:
        stream_val = event.stream.value if isinstance(event.stream, ReplayStreamType) else event.stream
        key = f"{stream_val}:{event.symbol}"
        for cb in self._subscriptions.get(key, []):
            cb(event)
        for cb in self._subscriptions.get("*:*", []):
            cb(event)
