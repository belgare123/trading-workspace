"""
Replay Events Bus — шина событий для Market Replay Framework.

Подписчики: Timeline → Source → Strategies → Decision → Lifecycle → Quality
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from core.replay.models import ReplayEvent, ReplaySnapshot, ReplayContext

logger = logging.getLogger(__name__)

# Типы событий Replay Bus
REPLAY_STARTED = "replay.started"
REPLAY_STOPPED = "replay.stopped"
REPLAY_PAUSED = "replay.paused"
REPLAY_RESUMED = "replay.resumed"
REPLAY_SEEK = "replay.seek"
REPLAY_EVENT = "replay.event"
REPLAY_COMPLETED = "replay.completed"
REPLAY_ERROR = "replay.error"
REPLAY_SNAPSHOT = "replay.snapshot"
REPLAY_PROGRESS = "replay.progress"
REPLAY_BREAKPOINT = "replay.breakpoint"


EventHandler = Callable[[str, dict[str, Any]], None]


class ReplayBus:
    """Шина событий для Market Replay Framework.

    Отдельная шина — не связана с EventBus из Decision Engine.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = {}
        self._history: list[tuple[str, dict[str, Any]]] = []

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Подписаться на тип события."""
        self._handlers.setdefault(event_type, []).append(handler)

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Отписаться от типа события."""
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    def emit(self, event_type: str, data: dict[str, Any] | None = None) -> None:
        """Отправить событие."""
        payload = data or {}
        for handler in self._handlers.get(event_type, []):
            try:
                handler(event_type, payload)
            except Exception as e:
                logger.error("ReplayBus handler error: %s", e)

        # Логируем последние 100 событий
        self._history.append((event_type, payload))
        if len(self._history) > 100:
            self._history.pop(0)

    @property
    def history(self) -> list[tuple[str, dict[str, Any]]]:
        return list(self._history)

    def clear_history(self) -> None:
        self._history.clear()

    def emit_event(self, event: ReplayEvent) -> None:
        """Удобный метод: отправить ReplayEvent в шину."""
        self.emit(REPLAY_EVENT, {"event": event.to_dict()})

    def emit_snapshot(self, snapshot: ReplaySnapshot) -> None:
        """Удобный метод: отправить Snapshot в шину."""
        self.emit(REPLAY_SNAPSHOT, {"snapshot": snapshot.to_dict()})

    def emit_progress(self, context: ReplayContext) -> None:
        """Удобный метод: отправить прогресс в шину."""
        self.emit(REPLAY_PROGRESS, {
            "current_index": context.current_index,
            "current_timestamp": context.current_timestamp,
            "total": len(context.package.events) if context.package else 0,
            "speed": context.current_speed,
        })
