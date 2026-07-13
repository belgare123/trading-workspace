"""
BackgroundTaskManager — управление фоновыми задачами сервисов.

Позволяет сервисам декларировать фоновые корутины (ticker, cleanup, metrics),
а Runtime управляет их жизненным циклом: запуск при старте сервиса,
остановка при остановке сервиса.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Awaitable, Callable

logger = logging.getLogger(__name__)

BackgroundTask = Callable[[], Awaitable[None]]


@dataclass
class TaskHandle:
    """Управляющий дескриптор фоновой задачи.

    Attributes:
        name:       Полное имя (service_name.task_name).
        service:    Имя сервиса-владельца.
        coro:       Функция-корутина.
        task:       asyncio.Task (после запуска).
        created_at: Время создания.
    """

    name: str
    service: str
    coro: BackgroundTask
    task: asyncio.Task | None = None
    created_at: float = 0.0
    _cancel_requested: bool = False

    @property
    def is_running(self) -> bool:
        return self.task is not None and not self.task.done()

    @property
    def is_done(self) -> bool:
        return self.task is not None and self.task.done()

    def cancel(self) -> None:
        """Запросить отмену asyncio.Task."""
        self._cancel_requested = True
        if self.task is not None and not self.task.done():
            self.task.cancel()

    def __repr__(self) -> str:
        return (
            f"TaskHandle({self.name}"
            f", running={self.is_running}"
            f")"
        )


class BackgroundTaskManager:
    """Менеджер фоновых задач сервисов.

    Каждый сервис может декларировать фоновые задачи (ticker, cleanup, metrics).
    Runtime запускает их при старте сервиса и останавливает при остановке.
    """

    def __init__(self):
        self._tasks: dict[str, TaskHandle] = {}

    def register(
        self,
        service_name: str,
        task_name: str,
        coro: BackgroundTask,
    ) -> TaskHandle:
        """Зарегистрировать фоновую задачу для сервиса.

        Args:
            service_name: Имя сервиса-владельца.
            task_name:    Имя задачи (уникальное в рамках сервиса).
            coro:         Асинхронная функция без аргументов.

        Returns:
            TaskHandle — дескриптор задачи.
        """
        full_name = f"{service_name}.{task_name}"
        handle = TaskHandle(
            name=full_name,
            service=service_name,
            coro=coro,
        )
        self._tasks[full_name] = handle
        return handle

    def start(self, handle: TaskHandle) -> TaskHandle:
        """Запустить фоновую задачу.

        Args:
            handle: Дескриптор задачи (из register).

        Returns:
            TaskHandle с запущенным asyncio.Task.
        """
        if handle.task is not None and not handle.task.done():
            logger.warning("[tasks] Task '%s' already running", handle.name)
            return handle

        handle.created_at = time.time()
        handle._cancel_requested = False
        handle.task = asyncio.create_task(
            self._run_task(handle),
            name=handle.name,
        )
        return handle

    async def _run_task(self, handle: TaskHandle) -> None:
        """Внутренняя обёртка с обработкой ошибок."""
        try:
            await handle.coro()
        except asyncio.CancelledError:
            logger.debug("[tasks] Task '%s' cancelled", handle.name)
        except Exception:
            logger.exception("[tasks] Task '%s' failed", handle.name)

    async def stop(self, handle: TaskHandle) -> None:
        """Остановить фоновую задачу (graceful c timeout 5s)."""
        handle.cancel()
        if handle.task is not None and not handle.task.done():
            try:
                await asyncio.wait_for(handle.task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

    async def stop_all(self, service_name: str | None = None) -> None:
        """Остановить все задачи (или задачи конкретного сервиса).

        Args:
            service_name: Если указан — только задачи этого сервиса.
                          Если None — все.
        """
        to_stop = [
            h for h in self._tasks.values()
            if service_name is None or h.service == service_name
        ]
        for handle in to_stop:
            await self.stop(handle)

    def get(self, name: str) -> TaskHandle | None:
        return self._tasks.get(name)

    @property
    def tasks(self) -> dict[str, TaskHandle]:
        return dict(self._tasks)

    @property
    def count(self) -> int:
        return len(self._tasks)

    @property
    def running_count(self) -> int:
        return sum(1 for t in self._tasks.values() if t.is_running)

    def __repr__(self) -> str:
        return f"BackgroundTaskManager({self.count} tasks, {self.running_count} running)"
