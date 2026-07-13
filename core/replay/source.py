"""
9.1 Data Source Abstraction — MarketSource.

Абстракция источника рыночных данных.
Весь стек (Feature Graph, Strategies, Decision, Lifecycle)
не должен знать Live это или Replay.

MarketSource
    ├── LiveSource (реальная биржа)
    └── ReplaySource (исторические данные)
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Callable

from core.replay.models import ReplayEvent, ReplayStreamType

logger = logging.getLogger(__name__)


class MarketSource(ABC):
    """Абстрактный источник рыночных данных.

    Стратегии получают одинаковые события независимо от источника.
    """

    @abstractmethod
    def start(self) -> None:
        """Запустить источник."""

    @abstractmethod
    def stop(self) -> None:
        """Остановить источник."""

    @property
    @abstractmethod
    def is_live(self) -> bool:
        """True для live-режима, False для replay."""

    @property
    @abstractmethod
    def current_timestamp(self) -> float:
        """Текущее время источника."""

    @abstractmethod
    def subscribe(self, stream: str, symbol: str, callback: Callable[[ReplayEvent], None]) -> None:
        """Подписаться на поток событий."""

    @abstractmethod
    def unsubscribe(self, stream: str, symbol: str, callback: Callable[[ReplayEvent], None]) -> None:
        """Отписаться от потока."""

    @abstractmethod
    def emit(self, event: ReplayEvent) -> None:
        """Отправить событие подписчикам."""


class LiveSource(MarketSource):
    """Live-источник — подключение к бирже (заглушка для интеграции)."""

    def __init__(self) -> None:
        self._subscriptions: dict[str, list[Callable[[ReplayEvent], None]]] = {}
        self._running = False
        self._timestamp: float = 0.0

    @property
    def is_live(self) -> bool:
        return True

    @property
    def current_timestamp(self) -> float:
        return self._timestamp

    def start(self) -> None:
        self._running = True
        logger.info("LiveSource started")

    def stop(self) -> None:
        self._running = False
        logger.info("LiveSource stopped")

    def subscribe(self, stream: str, symbol: str, callback: Callable[[ReplayEvent], None]) -> None:
        key = f"{stream}:{symbol}"
        self._subscriptions.setdefault(key, []).append(callback)
        logger.debug("LiveSource subscribed to %s", key)

    def unsubscribe(self, stream: str, symbol: str, callback: Callable[[ReplayEvent], None]) -> None:
        key = f"{stream}:{symbol}"
        subs = self._subscriptions.get(key, [])
        if callback in subs:
            subs.remove(callback)
            logger.debug("LiveSource unsubscribed from %s", key)

    def emit(self, event: ReplayEvent) -> None:
        self._timestamp = event.timestamp
        stream_val = event.stream.value if isinstance(event.stream, ReplayStreamType) else event.stream
        key = f"{stream_val}:{event.symbol}"
        for cb in self._subscriptions.get(key, []):
            cb(event)
        # Также подписчики на wildcard
        for cb in self._subscriptions.get("*:*", []):
            cb(event)


class ReplaySource(MarketSource):
    """Replay-источник — воспроизводит события из .market-пакета."""

    def __init__(
        self,
        events: list[ReplayEvent],
        speed: float = 1.0,
    ) -> None:
        self._events = sorted(events, key=lambda e: e.timestamp)
        self._index = 0
        self._speed = speed
        self._running = False
        self._subscriptions: dict[str, list[Callable[[ReplayEvent], None]]] = {}
        self._current_time: float = 0.0
        self._real_start: float = 0.0

    @property
    def is_live(self) -> bool:
        return False

    @property
    def current_timestamp(self) -> float:
        return self._current_time

    @property
    def is_finished(self) -> bool:
        return self._index >= len(self._events)

    @property
    def progress(self) -> float:
        if not self._events:
            return 1.0
        return self._index / len(self._events)

    def start(self) -> None:
        self._running = True
        self._real_start = time.time()
        logger.info("ReplaySource started (%d events)", len(self._events))

    def stop(self) -> None:
        self._running = False
        logger.info("ReplaySource stopped at event %d/%d", self._index, len(self._events))

    def set_speed(self, speed: float) -> None:
        self._speed = max(0.25, min(speed, 100.0))
        logger.debug("ReplaySource speed set to %gx", self._speed)

    def seek(self, timestamp: float) -> None:
        """Переместиться к ближайшему событию >= timestamp."""
        for i, e in enumerate(self._events):
            if e.timestamp >= timestamp:
                self._index = i
                self._current_time = timestamp
                logger.info("ReplaySource seek to %s (event %d)", timestamp, i)
                return
        self._index = len(self._events)

    def tick(self) -> list[ReplayEvent]:
        """Выдать события для текущего тика (по скорости).

        Returns:
            Список событий, которые должны быть обработаны сейчас.
        """
        if not self._running or self.is_finished:
            return []

        # Сколько реального времени прошло
        elapsed_real = time.time() - self._real_start
        # Сколько replay-времени должно пройти
        elapsed_replay = elapsed_real * self._speed

        target_time = (self._events[0].timestamp if self._events else 0) + elapsed_replay
        self._current_time = target_time

        events_now: list[ReplayEvent] = []
        while self._index < len(self._events):
            event = self._events[self._index]
            if event.timestamp <= target_time:
                events_now.append(event)
                self._index += 1
            else:
                break

        for event in events_now:
            self.emit(event)

        return events_now

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
