"""
8.10 Opportunity Bus — отдельная шина событий для Lifecycle.

Decision Engine → OpportunityBus → Lifecycle → Replay / Quality / Dashboard / Learning

В отличие от Decision EventBus, эта шина:
  - Работает с LifecycleEvent
  - Имеет фильтры по типу события
  - Позволяет подписчикам получать только нужные события
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Callable

from core.lifecycle.events import (
    EventHandler,
    LifecycleEvent,
    LifecycleEventType,
)

logger = logging.getLogger(__name__)


class OpportunityBus:
    """Шина событий жизненного цикла (pub/sub).

    Usage:
        bus = OpportunityBus()
        bus.subscribe(LifecycleEventType.TRADE_CLOSED, my_handler)
        bus.subscribe_all(all_handler)  # все события
        bus.publish(event)
    """

    def __init__(self) -> None:
        self._handlers: dict[LifecycleEventType, list[EventHandler]] = defaultdict(list)
        self._all_handlers: list[EventHandler] = []
        self._history: list[LifecycleEvent] = []

    def subscribe(
        self,
        event_type: LifecycleEventType,
        handler: EventHandler,
    ) -> Callable[[], None]:
        """Подписаться на конкретный тип события.

        Args:
            event_type: Тип события.
            handler:    Callback(event: LifecycleEvent) → None.

        Returns:
            Функция для отписки.
        """
        self._handlers[event_type].append(handler)
        logger.debug("Subscribed to %s: %s", event_type.value, handler.__name__)

        def unsubscribe() -> None:
            self._handlers[event_type].remove(handler)
            logger.debug("Unsubscribed from %s: %s", event_type.value, handler.__name__)

        return unsubscribe

    def subscribe_all(self, handler: EventHandler) -> Callable[[], None]:
        """Подписаться на все события.

        Args:
            handler: Callback(event: LifecycleEvent) → None.

        Returns:
            Функция для отписки.
        """
        self._all_handlers.append(handler)

        def unsubscribe() -> None:
            self._all_handlers.remove(handler)

        return unsubscribe

    def publish(self, event: LifecycleEvent) -> None:
        """Опубликовать событие.

        Args:
            event: LifecycleEvent.
        """
        self._history.append(event)

        # Специфичные обработчики
        for handler in self._handlers.get(event.type, []):
            try:
                handler(event)
            except Exception as e:
                logger.error(
                    "Handler %s failed for event %s: %s",
                    handler.__name__,
                    event.type.value,
                    e,
                )

        # Глобальные обработчики
        for handler in self._all_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(
                    "All-handler %s failed for event %s: %s",
                    handler.__name__,
                    event.type.value,
                    e,
                )

    def get_history(
        self,
        event_type: LifecycleEventType | None = None,
        limit: int = 50,
    ) -> list[LifecycleEvent]:
        """Получить историю событий.

        Args:
            event_type: Фильтр по типу (None = все).
            limit:      Максимум записей.

        Returns:
            Список LifecycleEvent.
        """
        if event_type is None:
            return self._history[-limit:]
        return [e for e in self._history if e.type == event_type][-limit:]

    def clear(self) -> None:
        self._history.clear()

    @property
    def event_count(self) -> int:
        return len(self._history)
