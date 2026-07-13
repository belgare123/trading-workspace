"""
EventHooks — система хуков жизненного цикла сервисов.

Позволяет подписываться на события:
  - before_start / after_start — до/после запуска сервиса
  - before_stop  / after_stop  — до/после остановки сервиса
  - on_error     — ошибка при старте/стопе
  - on_critical  — критический сбой (весь Runtime останавливается)

Хуки — корутины вида:
    async def hook(service_name: str, **kwargs) -> None:
        ...

Использование:
    hooks = EventHooks()
    hooks.on("before_start", my_validator)
    hooks.on("after_stop",  my_notifier)
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any, Awaitable, Callable, List, Optional

logger = logging.getLogger(__name__)

# Тип хендлера: корутина, принимающая имя сервиса + **kwargs
HookHandler = Callable[..., Awaitable[None]]


class EventHooks:
    """Децентрализованная система хуков для сервисного Runtime.

    Позволяет компонентам (FeatureEngine, Telegram, Dashboard)
    подписываться на события жизненного цикла без прямой связи.
    """

    # Имена стандартных событий
    BEFORE_START: str = "before_start"
    AFTER_START: str = "after_start"
    BEFORE_STOP: str = "before_stop"
    AFTER_STOP: str = "after_stop"
    ON_ERROR: str = "on_error"
    ON_CRITICAL: str = "on_critical"

    _VALID_EVENTS: set[str] = {
        BEFORE_START,
        AFTER_START,
        BEFORE_STOP,
        AFTER_STOP,
        ON_ERROR,
        ON_CRITICAL,
    }

    def __init__(self) -> None:
        # event_name → [handler, ...]
        self._handlers: dict[str, list[HookHandler]] = defaultdict(list)
        # per-service override: service_name → event → [handler, ...]
        self._service_handlers: dict[str, dict[str, list[HookHandler]]] = (
            defaultdict(lambda: defaultdict(list))
        )

    # ── Регистрация ──────────────────────────────────

    def on(
        self,
        event: str,
        handler: HookHandler,
        service_name: Optional[str] = None,
    ) -> None:
        """Подписаться на событие.

        Args:
            event:        Имя события (BEFORE_START, AFTER_STOP, …).
            handler:      Асинхронная функция.
            service_name: Если задано — хук сработает только для этого сервиса.
        """
        if event not in self._VALID_EVENTS:
            raise ValueError(
                f"Unknown event '{event}'. Valid: {sorted(self._VALID_EVENTS)}"
            )

        if service_name:
            self._service_handlers[service_name][event].append(handler)
        else:
            self._handlers[event].append(handler)

        logger.debug(
            "[hooks] registered handler for '%s'%s",
            event,
            f" (service={service_name})" if service_name else "",
        )

    def off(
        self,
        event: str,
        handler: HookHandler,
        service_name: Optional[str] = None,
    ) -> None:
        """Отписаться от события."""
        target = (
            self._service_handlers[service_name].get(event, [])
            if service_name
            else self._handlers[event]
        )
        if handler in target:
            target.remove(handler)

    # ── Исполнение ──────────────────────────────────

    async def fire(
        self,
        event: str,
        service_name: str,
        **kwargs: Any,
    ) -> None:
        """Запустить все хендлеры для события.

        Args:
            event:        Имя события.
            service_name: Имя сервиса-инициатора.
            **kwargs:     Доп. аргументы (error, attempt, …).
        """
        # Глобальные хендлеры
        global_handlers = list(self._handlers.get(event, []))
        # Per-service хендлеры
        svc_handlers = list(
            self._service_handlers.get(service_name, {}).get(event, [])
        )

        all_handlers = global_handlers + svc_handlers

        for handler in all_handlers:
            try:
                await handler(service_name=service_name, **kwargs)
            except Exception as e:
                logger.warning(
                    "[hooks] handler %s failed on '%s' event '%s': %s",
                    handler.__name__,
                    service_name,
                    event,
                    e,
                )

    # ── Хелперы для Runtime ──────────────────────────────────

    async def fire_before_start(self, service_name: str) -> None:
        await self.fire(self.BEFORE_START, service_name)

    async def fire_after_start(self, service_name: str) -> None:
        await self.fire(self.AFTER_START, service_name)

    async def fire_before_stop(self, service_name: str) -> None:
        await self.fire(self.BEFORE_STOP, service_name)

    async def fire_after_stop(self, service_name: str) -> None:
        await self.fire(self.AFTER_STOP, service_name)

    async def fire_on_error(
        self, service_name: str, error: BaseException
    ) -> None:
        await self.fire(self.ON_ERROR, service_name, error=error)

    async def fire_on_critical(
        self, service_name: str, error: BaseException
    ) -> None:
        await self.fire(self.ON_CRITICAL, service_name, error=error)

    # ── Утилиты ──────────────────────────────────

    @property
    def registered_events(self) -> dict[str, int]:
        """Количество хендлеров по событиям (для отладки)."""
        result: dict[str, int] = {}
        for event, handlers in self._handlers.items():
            result[event] = len(handlers)
        for sname, svc_events in self._service_handlers.items():
            for event, handlers in svc_events.items():
                key = f"{sname}.{event}"
                result[key] = len(handlers)
        return result

    def clear(self) -> None:
        """Сбросить все подписки."""
        self._handlers.clear()
        self._service_handlers.clear()
