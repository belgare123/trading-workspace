"""
9.2 Replay Timeline — временная шкала событий.

Replay — это не цикл for candle.
Это временная шкала: события идут в том порядке, как были.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from core.replay.models import ReplayEvent, ReplayPackage

logger = logging.getLogger(__name__)


@dataclass
class TimelineState:
    """Текущее состояние таймлайна."""
    current_index: int = 0
    current_timestamp: float = 0.0
    is_paused: bool = False
    is_finished: bool = False
    speed: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "current_index": self.current_index,
            "current_timestamp": self.current_timestamp,
            "is_paused": self.is_paused,
            "is_finished": self.is_finished,
            "speed": self.speed,
            "progress_pct": round(self.progress * 100, 1) if self.current_index > 0 else 0.0,
        }

    @property
    def progress(self) -> float:
        if self.total <= 0:
            return 1.0
        return self.current_index / self.total

    total: int = 0


EventHandler = Callable[[ReplayEvent], None]


class Timeline:
    """Управление временной шкалой replay-событий."""

    def __init__(self, events: list[ReplayEvent] | None = None) -> None:
        self._events: list[ReplayEvent] = []
        self._handlers: dict[str, list[EventHandler]] = {}
        self.state = TimelineState()

        if events:
            self.load(events)

    def load(self, events: list[ReplayEvent]) -> None:
        """Загрузить события и отсортировать по времени."""
        self._events = sorted(events, key=lambda e: e.timestamp)
        self.state = TimelineState(total=len(self._events))
        logger.debug("Timeline loaded %d events", len(self._events))

    def load_package(self, package: ReplayPackage) -> None:
        """Загрузить события из .market-пакета."""
        self.load(package.events)
        logger.info(
            "Timeline loaded package '%s': %d events, %.1fs duration",
            package.manifest.name, len(self._events), package.duration,
        )

    def subscribe(self, stream: str, handler: EventHandler) -> None:
        """Подписаться на события потока (wildcard '*' разрешён)."""
        self._handlers.setdefault(stream, []).append(handler)

    def unsubscribe(self, stream: str, handler: EventHandler) -> None:
        """Отписаться от потока."""
        handlers = self._handlers.get(stream, [])
        if handler in handlers:
            handlers.remove(handler)

    @property
    def current_event(self) -> ReplayEvent | None:
        if 0 <= self.state.current_index < len(self._events):
            return self._events[self.state.current_index]
        return None

    def tick(self, speed: float | None = None) -> list[ReplayEvent]:
        """Выдать события для текущего тика.

        Args:
            speed: Множитель скорости (None = сохранить текущую).

        Returns:
            Список событий для этого тика.
        """
        if self.state.is_paused or self.state.is_finished:
            return []

        if speed is not None:
            self.state.speed = speed

        # В одном тике выдаём все события,
        # timestamp которых ≤ текущего + один шаг
        events_now: list[ReplayEvent] = []
        while self.state.current_index < len(self._events):
            event = self._events[self.state.current_index]
            events_now.append(event)
            self.state.current_timestamp = event.timestamp
            self.state.current_index += 1

        if self.state.current_index >= len(self._events):
            self.state.is_finished = True
            logger.info("Timeline finished after %d events", self.state.current_index)

        # Уведомить подписчиков
        for event in events_now:
            stream_key = event.stream.value if hasattr(event.stream, 'value') else str(event.stream)
            for handler in self._handlers.get(stream_key, []):
                handler(event)
            for handler in self._handlers.get("*", []):
                handler(event)

        return events_now

    def tick_one(self) -> ReplayEvent | None:
        """Выдать ровно одно следующее событие (для отладки)."""
        if self.state.is_paused or self.state.is_finished:
            return None

        event = self._events[self.state.current_index]
        self.state.current_timestamp = event.timestamp
        self.state.current_index += 1

        if self.state.current_index >= len(self._events):
            self.state.is_finished = True

        stream_key = event.stream.value if hasattr(event.stream, 'value') else str(event.stream)
        for handler in self._handlers.get(stream_key, []):
            handler(event)
        for handler in self._handlers.get("*", []):
            handler(event)

        return event

    def seek(self, timestamp: float) -> int:
        """Переместиться к событию с указанным timestamp.

        Args:
            timestamp: Целевое время.

        Returns:
            Индекс найденного события.
        """
        for i, event in enumerate(self._events):
            if event.timestamp >= timestamp:
                self.state.current_index = i
                self.state.current_timestamp = event.timestamp
                logger.info("Timeline seek to event %d at %.3f", i, event.timestamp)
                return i
        self.state.current_index = len(self._events)
        self.state.is_finished = True
        logger.info("Timeline seek beyond end")
        return len(self._events)

    def reset(self) -> None:
        """Сбросить таймлайн в начало."""
        self.state = TimelineState(total=len(self._events))
        logger.debug("Timeline reset")

    @property
    def events(self) -> list[ReplayEvent]:
        return self._events
