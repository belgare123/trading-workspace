"""
Health — система проверки состояния приложения и его компонентов.

Позволяет:
- Проверить готовность всех сервисов
- Получить статус каждого компонента
- Определить, готов ли компонент к работе
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

logger = logging.getLogger(__name__)


@dataclass
class HealthStatus:
    """Результат проверки здоровья компонента."""
    name: str
    status: str  # ok | degraded | error
    detail: str = ""
    meta: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    @property
    def is_healthy(self) -> bool:
        return self.status == "ok"

    @property
    def is_degraded(self) -> bool:
        return self.status == "degraded"

    @property
    def is_error(self) -> bool:
        return self.status == "error"


class HealthCheckable(Protocol):
    """Протокол для компонентов, поддерживающих проверку здоровья."""

    async def health(self) -> dict[str, Any]:
        ...


class HealthRegistry:
    """Реестр проверок здоровья.

    Позволяет регистрировать компоненты и получать
    агрегированный статус приложения.
    """

    def __init__(self):
        self._checks: dict[str, HealthCheckable | callable] = {}

    def register(self, name: str, check: HealthCheckable | callable) -> None:
        """Зарегистрировать компонент или функцию для проверки здоровья.

        Args:
            name: Имя компонента (например, "exchange", "feature_engine")
            check: Объект с методом health() или callable, возвращающий dict
        """
        self._checks[name] = check

    def unregister(self, name: str) -> None:
        self._checks.pop(name, None)

    async def check(self, name: str) -> HealthStatus:
        """Проверить здоровье конкретного компонента."""
        check = self._checks.get(name)
        if check is None:
            return HealthStatus(name=name, status="error", detail="not registered")

        try:
            if callable(check):
                result = check()
            else:
                result = await check.health()

            if isinstance(result, dict):
                status = result.get("status", "unknown")
                detail = result.get("detail", "")
                meta = result.get("meta", {})
                return HealthStatus(
                    name=name, status=status,
                    detail=detail, meta=meta
                )
            return HealthStatus(name=name, status="unknown", detail=str(result))
        except Exception as e:
            logger.exception("Health check failed for %s", name)
            return HealthStatus(name=name, status="error", detail=str(e))

    async def check_all(self) -> dict[str, HealthStatus]:
        """Проверить все зарегистрированные компоненты."""
        results = {}
        for name in list(self._checks.keys()):
            results[name] = await self.check(name)
        return results

    async def is_ready(self) -> bool:
        """Все компоненты здоровы?"""
        results = await self.check_all()
        return all(r.is_healthy for r in results.values())

    async def summary(self) -> dict[str, Any]:
        """Агрегированный статус приложения."""
        results = await self.check_all()
        ok_count = sum(1 for r in results.values() if r.is_healthy)
        degraded_count = sum(1 for r in results.values() if r.is_degraded)
        error_count = sum(1 for r in results.values() if r.is_error)

        if error_count > 0:
            app_status = "error"
        elif degraded_count > 0:
            app_status = "degraded"
        else:
            app_status = "ok"

        return {
            "status": app_status,
            "total": len(results),
            "ok": ok_count,
            "degraded": degraded_count,
            "error": error_count,
            "checks": {
                name: {
                    "status": r.status,
                    "detail": r.detail,
                }
                for name, r in results.items()
            },
        }

    def __repr__(self) -> str:
        return f"HealthRegistry({len(self._checks)} checks)"
