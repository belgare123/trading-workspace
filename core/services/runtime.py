"""
ServiceRuntime — оркестратор жизненного цикла всех сервисов.

Application больше не знает о каждом компоненте — он просто говорит:
    await runtime.start_all()
    await runtime.stop_all()

Runtime использует ServiceRegistry для порядка запуска/остановки (DAG),
BackgroundTaskManager для фоновых задач, MetricsCollector для метрик
и EventHooks для хуков жизненного цикла.

Graceful Shutdown:
    Telegram → Decision → Strategy → Context → Feature → Exchange
    (определяется DAG stop_order)
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from core.services.base import (
    HealthStatus,
    IService,
    RestartPolicy,
    ServiceMetadata,
)
from core.services.hooks import EventHooks
from core.services.metrics import MetricsCollector
from core.services.registry import ServiceEntry, ServiceRegistry
from core.services.tasks import BackgroundTask, BackgroundTaskManager, TaskHandle

logger = logging.getLogger(__name__)


class ServiceRuntimeError(Exception):
    """Критическая ошибка runtime (failed critical service)."""

    pass


class ServiceRuntime:
    """Оркестратор жизненного цикла сервисов.

    Предоставляет единый API для запуска, остановки, перезапуска,
    проверки здоровья и сбора статистики всех сервисов.

    Интегрирует EventHooks для хуков жизненного цикла и Graceful Shutdown
    с таймаутами и force-kill fallback.

    Использование:
        runtime = ServiceRuntime(registry)
        await runtime.start_all()
        ...
        health = await runtime.health()
        stats = runtime.stats()
        ...
        await runtime.stop_all()
    """

    # Таймаут на stop() одного сервиса (сек)
    _STOP_TIMEOUT: float = 10.0
    # Таймаут на shutdown() одного сервиса (сек)
    _SHUTDOWN_TIMEOUT: float = 5.0
    # Максимум перезапусков одного сервиса при старте
    _MAX_START_RETRIES: int = 1

    def __init__(
        self,
        registry: ServiceRegistry,
        task_manager: BackgroundTaskManager | None = None,
        metrics: MetricsCollector | None = None,
        hooks: EventHooks | None = None,
    ):
        self._registry = registry
        self._tasks = task_manager or BackgroundTaskManager()
        self._metrics = metrics or MetricsCollector()
        self._hooks = hooks or EventHooks()
        self._started_at: float | None = None
        self._running = False
        self._shutdown_requested = False

        # Хранилище фоновых задач по сервисам
        self._service_tasks: dict[str, list[TaskHandle]] = {}

    # ── Жизненный цикл ──

    async def start_all(self) -> None:
        """Запустить все сервисы в порядке зависимостей (DAG).

        Для каждого сервиса:
        1. before_start hook
        2. initialize() — подготовка
        3. start() — запуск
        4. after_start hook
        5. Регистрация фоновых задач (если сервис их декларирует)
        6. Сбор метрик

        Raises:
            ServiceRuntimeError: Если критический сервис не запустился.
        """
        if self._running:
            logger.warning("[runtime] Already running, skipping start_all")
            return

        start_order = self._registry.start_order()
        logger.info(
            "[runtime] Starting %d services: %s",
            len(start_order), start_order,
        )

        for name in start_order:
            entry = self._registry.get(name)
            if entry is None:
                logger.warning("[runtime] Service '%s' not in registry, skipping", name)
                continue

            await self._start_one(entry)

        self._started_at = time.time()
        self._running = True
        logger.info("[runtime] All %d services started (%s)", len(start_order), start_order)

    # Максимум перезапусков одного сервиса при старте
    _MAX_START_RETRIES: int = 1

    async def _start_one(self, entry: ServiceEntry, attempt: int = 1) -> None:
        """Запустить один сервис с учётом RestartPolicy.

        Args:
            entry:  Запись сервиса.
            attempt: Номер попытки (для ретраев).
        """
        name = entry.name
        self._metrics.register(name)
        self._metrics.record_start(name)

        try:
            # 0. before_start hook
            await self._hooks.fire_before_start(name)

            # 1. Initialize
            logger.debug("[runtime] initializing '%s'", name)
            await entry.service.initialize()

            # 2. Start
            logger.debug("[runtime] starting '%s'", name)
            await entry.service.start()

            # 3. after_start hook
            await self._hooks.fire_after_start(name)

            # 4. Background tasks (если сервис имеет IServiceWithTasks)
            await self._start_service_tasks(entry)

            # 5. Успех
            entry.status = HealthStatus.ok()
            entry.start_count += 1
            logger.info("[runtime] '%s' started", name)

        except Exception as e:
            entry.status = HealthStatus.error(str(e))
            entry.error_count += 1
            self._metrics.record_error(name, e)
            await self._hooks.fire_on_error(name, e)
            logger.error("[runtime] '%s' failed to start: %s", name, e)

            # Retry по RestartPolicy (макс. _MAX_START_RETRIES попыток)
            can_retry = attempt < self._MAX_START_RETRIES
            should_retry = entry.policy in (
                RestartPolicy.ALWAYS, RestartPolicy.ON_FAILURE
            )
            if can_retry and should_retry:
                logger.info(
                    "[runtime] retrying '%s' (attempt %d/%d, policy=%s)",
                    name, attempt + 1, self._MAX_START_RETRIES,
                    entry.policy.value,
                )
                self._metrics.record_restart(name)
                await self._start_one(entry, attempt=attempt + 1)
                return

            # Critical service → stop everything
            if entry.metadata.critical:
                await self._hooks.fire_on_critical(name, e)
                await self._emergency_stop(name, e)
                raise ServiceRuntimeError(
                    f"Critical service '{name}' failed to start: {e}"
                ) from e

            # Non-critical, policy=NEVER or exhausted retries → skip
            logger.warning(
                "[runtime] '%s' skipped (policy=%s, attempts=%d)",
                name, entry.policy.value, attempt,
            )

    async def _start_service_tasks(self, entry: ServiceEntry) -> None:
        """Запустить фоновые задачи сервиса, если он их декларирует."""
        service = entry.service
        # IServiceWithTasks — опциональный протокол с background_tasks
        if hasattr(service, "background_tasks") and callable(
            getattr(service, "background_tasks", None)
        ):
            try:
                tasks = service.background_tasks()  # type: ignore[attr-defined]
                task_handles = []
                for i, coro in enumerate(tasks):
                    handle = self._tasks.register(
                        service_name=entry.name,
                        task_name=f"bg_{i}",
                        coro=coro,
                    )
                    self._tasks.start(handle)
                    task_handles.append(handle)
                    logger.debug(
                        "[runtime] started background task '%s' for '%s'",
                        handle.name, entry.name,
                    )
                self._service_tasks[entry.name] = task_handles
            except Exception as e:
                logger.warning(
                    "[runtime] error starting tasks for '%s': %s",
                    entry.name, e,
                )

    async def stop_all(self) -> None:
        """Остановить все сервисы в обратном порядке зависимостей.

        Graceful shutdown:
        1. before_stop hook
        2. Остановить фоновые задачи
        3. stop() сервиса (с таймаутом)
        4. shutdown() сервиса (с таймаутом)
        5. after_stop hook
        6. Собрать метрики uptime
        """
        if not self._running:
            logger.warning("[runtime] Not running, skipping stop_all")
            return

        self._shutdown_requested = True
        stop_order = self._registry.stop_order()
        logger.info(
            "[runtime] Stopping %d services: %s",
            len(stop_order), stop_order,
        )

        # 1. Остановить все фоновые задачи
        await self._tasks.stop_all()

        # 2. Остановить сервисы в обратном порядке (graceful shutdown)
        for name in stop_order:
            entry = self._registry.get(name)
            if entry is None:
                continue

            try:
                # before_stop hook
                await self._hooks.fire_before_stop(name)

                logger.debug("[runtime] stopping '%s'", name)

                # stop() с таймаутом
                try:
                    await asyncio.wait_for(
                        entry.service.stop(),
                        timeout=self._STOP_TIMEOUT,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "[runtime] '%s' stop() timed out after %ss, force-killing",
                        name, self._STOP_TIMEOUT,
                    )

                # shutdown() с таймаутом
                try:
                    await asyncio.wait_for(
                        entry.service.shutdown(),
                        timeout=self._SHUTDOWN_TIMEOUT,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "[runtime] '%s' shutdown() timed out after %ss",
                        name, self._SHUTDOWN_TIMEOUT,
                    )

                entry.status = HealthStatus.stopped()
                self._metrics.record_stop(name)

                # after_stop hook
                await self._hooks.fire_after_stop(name)

                logger.info("[runtime] '%s' stopped", name)
            except Exception as e:
                entry.status = HealthStatus.error(str(e))
                self._metrics.record_error(name, e)
                await self._hooks.fire_on_error(name, e)
                logger.error("[runtime] error stopping '%s': %s", name, e)

        self._running = False
        self._shutdown_requested = False
        logger.info("[runtime] All services stopped")

    # ── Перезапуск ──

    async def restart(self, name: str) -> None:
        """Перезапустить один сервис (stop → start).

        Raises:
            KeyError: Если сервис не найден.
        """
        entry = self._registry.require(name)

        # Stop
        await self._hooks.fire_before_stop(name)
        await self._tasks.stop_all(service_name=name)
        try:
            await entry.service.stop()
            await entry.service.shutdown()
            self._metrics.record_stop(name)
        except Exception as e:
            logger.error("[runtime] error stopping '%s' for restart: %s", name, e)
        await self._hooks.fire_after_stop(name)

        # Reset status
        entry.status = HealthStatus.ok()
        self._metrics.record_restart(name)

        # Start
        await self._start_one(entry)

    async def restart_all(self) -> None:
        """Перезапустить все сервисы."""
        logger.info("[runtime] Restarting all services")
        await self.stop_all()
        await self.start_all()

    # ── Health ──

    async def health(self) -> dict[str, dict[str, object]]:
        """Собрать health-check всех сервисов.

        Returns:
            dict[name -> health_dict]
        """
        result: dict[str, dict[str, object]] = {}
        for name in self._registry.names:
            entry = self._registry.get(name)
            if entry is None:
                continue

            start = time.time()
            try:
                h = await entry.service.health()
                latency = (time.time() - start) * 1000
                entry.status = HealthStatus.ok()
                self._metrics.record_health(name, latency, success=True)
                result[name] = {
                    "state": "running",
                    "latency_ms": round(latency, 2),
                    **{k: v for k, v in h.items() if k != "state"},
                }
            except Exception as e:
                latency = (time.time() - start) * 1000
                entry.status = HealthStatus.error(str(e))
                self._metrics.record_health(name, latency, success=False)
                result[name] = {
                    "state": "error",
                    "error": str(e),
                    "latency_ms": round(latency, 2),
                }

        # Общий статус
        all_running = all(
            v.get("state") == "running" for v in result.values()
        )
        result["_overall"] = {
            "state": "running" if all_running else "degraded",
            "service_count": len(result) - 1,
            "uptime": round(time.time() - self._started_at, 1) if self._started_at else 0,
        }
        return result

    # ── Stats ──

    def stats(self) -> dict[str, object]:
        """Собрать статистику runtime.

        Returns:
            dict с глобальной статистикой и метриками сервисов.
        """
        metrics_list = [
            m.to_dict() for m in self._metrics.all().values()
        ]

        return {
            "running": self._running,
            "uptime": round(time.time() - self._started_at, 1) if self._started_at else 0,
            "service_count": self._registry.count,
            "task_count": self._tasks.count,
            "task_running": self._tasks.running_count,
            "services": metrics_list,
            "start_order": self._registry.start_order(),
            "stop_order": self._registry.stop_order(),
        }

    # ── Shutdown (аварийный) ──

    async def _emergency_stop(self, failed_name: str, error: Exception) -> None:
        """Аварийная остановка при падении критического сервиса."""
        logger.critical(
            "[runtime] EMERGENCY STOP: '%s' failed: %s", failed_name, error,
        )
        await self._hooks.fire_on_critical(failed_name, error)
        await self._tasks.stop_all()
        for name in self._registry.names:
            entry = self._registry.get(name)
            if entry is None or entry.name == failed_name:
                continue
            try:
                await asyncio.wait_for(
                    entry.service.stop(),
                    timeout=self._STOP_TIMEOUT,
                )
                await asyncio.wait_for(
                    entry.service.shutdown(),
                    timeout=self._SHUTDOWN_TIMEOUT,
                )
            except Exception:
                pass

    # ── Properties ──

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def registry(self) -> ServiceRegistry:
        return self._registry

    @property
    def tasks(self) -> BackgroundTaskManager:
        return self._tasks

    @property
    def metrics_collector(self) -> MetricsCollector:
        return self._metrics

    @property
    def hooks(self) -> EventHooks:
        return self._hooks

    @property
    def started_at(self) -> float | None:
        return self._started_at

    def __repr__(self) -> str:
        return (
            f"ServiceRuntime({self._registry.count} services"
            f", running={self._running}"
            f")"
        )
