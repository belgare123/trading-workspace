"""
MetricsCollector — автоматические метрики для каждого сервиса.

Каждый сервис автоматически получает:
- uptime_seconds — время работы
- error_count — количество ошибок
- restart_count — количество перезапусков
- last_health_latency_ms — задержка последнего health check
- memory_approx — примерное потребление памяти (если доступно)

Метрики агрегируются в ServiceRuntime.stats().
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ServiceMetrics:
    """Метрики одного сервиса.

    Attributes:
        name:                Имя сервиса.
        start_count:         Сколько раз был запущен.
        error_count:         Сколько раз упал с ошибкой.
        restart_count:       Сколько раз был перезапущен.
        last_start:          Время последнего запуска (unix ts).
        last_error:          Время последней ошибки.
        last_error_msg:      Текст последней ошибки.
        uptime_seconds:      Суммарное время работы (сек).
        health_check_count:  Сколько раз проверяли health.
        last_health_latency: Задержка последнего health check (ms).
        health_failures:     Сколько раз health check падал.
    """

    name: str
    start_count: int = 0
    error_count: int = 0
    restart_count: int = 0
    uptime_seconds: float = 0.0
    last_health_latency_ms: float = 0.0
    health_failures: int = 0
    last_start: float = 0.0
    last_error: float = 0.0
    last_error_msg: str = ""
    health_check_count: int = 0

    def to_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "start_count": self.start_count,
            "uptime_seconds": self.uptime_seconds,
            "error_count": self.error_count,
            "restart_count": self.restart_count,
            "last_health_latency_ms": self.last_health_latency_ms,
            "health_failures": self.health_failures,
        }

    def __repr__(self) -> str:
        return (
            f"ServiceMetrics({self.name}"
            f", uptime={self.uptime_seconds:.1f}s"
            f", errors={self.error_count}"
            f")"
        )


class MetricsCollector:
    """Сборщик метрик для всех сервисов.

    Каждый сервис автоматически получает:
    - uptime_seconds
    - error_count
    - restart_count
    - last_health_latency_ms
    - health_failures
    """

    def __init__(self):
        self._metrics: dict[str, ServiceMetrics] = {}

    def register(self, name: str) -> ServiceMetrics:
        """Зарегистрировать метрики для сервиса."""
        if name not in self._metrics:
            self._metrics[name] = ServiceMetrics(name=name)
        return self._metrics[name]

    def record_start(self, name: str) -> None:
        """Зафиксировать запуск сервиса."""
        m = self._ensure(name)
        m.last_start = time.time()
        m.start_count += 1

    def record_stop(self, name: str) -> None:
        """Зафиксировать остановку сервиса."""
        m = self._ensure(name)
        if m.last_start > 0:
            m.uptime_seconds += time.time() - m.last_start

    def record_error(self, name: str, error: Exception | str) -> None:
        """Зафиксировать ошибку сервиса."""
        m = self._ensure(name)
        m.error_count += 1
        m.last_error = time.time()
        m.last_error_msg = str(error)

    def record_restart(self, name: str) -> None:
        """Зафиксировать перезапуск сервиса."""
        m = self._ensure(name)
        m.restart_count += 1

    def record_health(
        self,
        name: str,
        latency_ms: float,
        success: bool,
    ) -> None:
        """Зафиксировать результат health check."""
        m = self._ensure(name)
        m.last_health_latency_ms = latency_ms
        m.health_check_count += 1
        if not success:
            m.health_failures += 1

    def get(self, name: str) -> ServiceMetrics | None:
        return self._metrics.get(name)

    def all(self) -> dict[str, ServiceMetrics]:
        return dict(self._metrics)

    def _ensure(self, name: str) -> ServiceMetrics:
        if name not in self._metrics:
            self._metrics[name] = ServiceMetrics(name=name)
        return self._metrics[name]

    def __repr__(self) -> str:
        return f"MetricsCollector({len(self._metrics)} services)"
