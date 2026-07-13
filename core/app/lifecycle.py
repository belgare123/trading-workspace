"""
Lifecycle — жизненный цикл приложения.

Определяет стадии приложения и переходы между ними.
Каждый сервис получает события on_bootstrap, on_start, on_stop
через Application.
"""

from __future__ import annotations

import asyncio
import logging
from enum import Enum, auto
from typing import Any

logger = logging.getLogger(__name__)


class LifecycleStage(Enum):
    """Стадии жизненного цикла приложения."""
    INIT = auto()           # После создания Application
    BOOTSTRAP = auto()       # Регистрация компонентов
    BOOTSTRAPPED = auto()    # Все компоненты зарегистрированы
    START = auto()           # Запуск сервисов
    RUNNING = auto()         # Приложение работает
    STOPPING = auto()        # Остановка начата
    STOPPED = auto()         # Приложение остановлено
    ERROR = auto()           # Фатальная ошибка

    def can_transition_to(self, target: LifecycleStage) -> bool:
        """Проверяет, допустим ли переход."""
        valid = {
            LifecycleStage.INIT: {LifecycleStage.BOOTSTRAP, LifecycleStage.ERROR},
            LifecycleStage.BOOTSTRAP: {LifecycleStage.BOOTSTRAPPED, LifecycleStage.ERROR},
            LifecycleStage.BOOTSTRAPPED: {LifecycleStage.START, LifecycleStage.STOPPED, LifecycleStage.ERROR},
            LifecycleStage.START: {LifecycleStage.RUNNING, LifecycleStage.ERROR},
            LifecycleStage.RUNNING: {LifecycleStage.STOPPING, LifecycleStage.ERROR},
            LifecycleStage.STOPPING: {LifecycleStage.STOPPED, LifecycleStage.ERROR},
            LifecycleStage.STOPPED: set(),
            LifecycleStage.ERROR: set(),
        }
        return target in valid.get(self, set())


class Lifecycle:
    """Менеджер жизненного цикла.

    Хранит текущую стадию и обрабатывает переходы.
    """

    def __init__(self):
        self._stage: LifecycleStage = LifecycleStage.INIT
        self._listeners: dict[str, list[Any]] = {
            "on_bootstrap": [],
            "on_start": [],
            "on_stop": [],
            "on_error": [],
        }

    # ── Состояние ──

    @property
    def stage(self) -> LifecycleStage:
        return self._stage

    @property
    def is_running(self) -> bool:
        return self._stage == LifecycleStage.RUNNING

    @property
    def is_stopped(self) -> bool:
        return self._stage in (LifecycleStage.STOPPED, LifecycleStage.ERROR)

    # ── Переходы ──

    async def transition_to(self, target: LifecycleStage) -> None:
        """Перейти в новую стадию с валидацией."""
        if not self._stage.can_transition_to(target):
            raise RuntimeError(
                f"Illegal transition: {self._stage.name} → {target.name}"
            )
        logger.debug("[lifecycle] %s → %s", self._stage.name, target.name)
        self._stage = target

    # ── Подписка на события ──

    def on(self, event: str, callback: Any) -> None:
        """Подписаться на событие жизненного цикла.

        Args:
            event: on_bootstrap | on_start | on_stop | on_error
            callback: async функция (container) или (container, error)
        """
        if event not in self._listeners:
            raise ValueError(f"Unknown lifecycle event: {event}")
        self._listeners[event].append(callback)

    def remove(self, event: str, callback: Any) -> None:
        """Отписаться от события."""
        if event in self._listeners and callback in self._listeners[event]:
            self._listeners[event].remove(callback)

    async def emit(self, event: str, *args: Any) -> None:
        """Вызвать всех подписчиков события."""
        if event not in self._listeners:
            return
        for cb in self._listeners[event]:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(*args)
                else:
                    cb(*args)
            except Exception:
                logger.exception("[lifecycle] Event %s handler failed", event)

    # ── Хелперы ──

    async def bootstrap(self) -> None:
        """Запустить фазу BOOTSTRAP."""
        await self.transition_to(LifecycleStage.BOOTSTRAP)
        # Подписчики вызываются Application, не здесь

    async def start(self) -> None:
        """Запустить фазу START."""
        await self.transition_to(LifecycleStage.START)

    async def running(self) -> None:
        """Перевести в RUNNING."""
        await self.transition_to(LifecycleStage.RUNNING)

    async def stop(self) -> None:
        """Запустить остановку."""
        if self._stage in (LifecycleStage.STOPPED, LifecycleStage.ERROR):
            return
        await self.transition_to(LifecycleStage.STOPPING)

    async def stopped(self) -> None:
        """Перевести в STOPPED."""
        await self.transition_to(LifecycleStage.STOPPED)

    async def error(self) -> None:
        """Перевести в ERROR."""
        self._stage = LifecycleStage.ERROR

    def __repr__(self) -> str:
        return f"Lifecycle({self._stage.name})"
