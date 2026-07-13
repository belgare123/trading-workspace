"""
ServiceRegistry — реестр сервисов с графом зависимостей.

Регистрирует сервисы с их метаданными, строит DAG,
и предоставляет безопасный порядок запуска/остановки.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from core.services.base import (
    HealthStatus,
    IService,
    RestartPolicy,
    ServiceMetadata,
)
from core.services.graph import DependencyGraph, DependencyError

logger = logging.getLogger(__name__)


@dataclass
class ServiceEntry:
    """Запись в реестре — runtime-состояние сервиса.

    Attributes:
        name:         Имя сервиса (копия из metadata)
        service:      Реализация IService
        metadata:     Метаданные (версия, приоритет, critical, зависимости)
        status:       Текущий статус здоровья
        policy:       Стратегия перезапуска при сбое
        start_count:  Сколько раз был запущен
        error_count:  Сколько раз упал с ошибкой
    """

    name: str
    service: IService
    metadata: ServiceMetadata
    status: HealthStatus = field(default_factory=HealthStatus.ok)
    policy: RestartPolicy = RestartPolicy.ON_FAILURE
    start_count: int = 0
    error_count: int = 0

    @property
    def critical(self) -> bool:
        return self.metadata.critical

    @property
    def priority(self) -> int:
        return self.metadata.priority

    @property
    def is_running(self) -> bool:
        return self.status.state == "running"

    @property
    def is_stopped(self) -> bool:
        return self.status.state in ("stopped", "unknown")

    def __repr__(self) -> str:
        return (
            f"ServiceEntry({self.name}"
            f" [{self.status.state}]"
            f", starts={self.start_count}"
            f", errors={self.error_count}"
            f")"
        )


class RegistrationError(Exception):
    """Ошибка регистрации сервиса: дубликат, конфликт и т.п."""

    pass


class ServiceRegistry:
    """Реестр сервисов с построением графа зависимостей.

    Использование:
        registry = ServiceRegistry()
        registry.register(telegram_svc, TelegramMetadata)
        registry.register(feature_svc, FeatureMetadata)
        registry.build_graph()

        for name in registry.start_order():
            await registry.get(name).service.start()
    """

    def __init__(self):
        self._entries: dict[str, ServiceEntry] = {}
        self._graph = DependencyGraph()
        self._built = False

    # ── Регистрация ──

    def register(
        self,
        service: IService,
        metadata: ServiceMetadata,
        policy: RestartPolicy = RestartPolicy.ON_FAILURE,
    ) -> ServiceEntry:
        """Зарегистрировать сервис в реестре.

        Args:
            service:  Реализация IService.
            metadata: Метаданные сервиса.
            policy:   Стратегия перезапуска.

        Returns:
            ServiceEntry — запись в реестре.

        Raises:
            RegistrationError: Если имя уже зарегистрировано.
        """
        name = metadata.name

        if name in self._entries:
            raise RegistrationError(
                f"Service '{name}' is already registered"
            )

        entry = ServiceEntry(
            name=name,
            service=service,
            metadata=metadata,
            policy=policy,
        )
        self._entries[name] = entry
        self._built = False

        logger.debug(
            "[registry] Registered %s (v%s, prio=%d, critical=%s, deps=%s)",
            name, metadata.version, metadata.priority,
            metadata.critical, metadata.dependencies,
        )
        return entry

    def unregister(self, name: str) -> None:
        """Удалить сервис из реестра."""
        if name in self._entries:
            del self._entries[name]
            self._built = False
            logger.debug("[registry] Unregistered '%s'", name)

    # ── Граф зависимостей ──

    def build_graph(self) -> DependencyGraph:
        """Построить/перестроить граф зависимостей.

        Для каждого зарегистрированного сервиса добавляет узел
        в граф с его зависимостями из ServiceMetadata.

        Returns:
            DependencyGraph — построенный граф.

        Raises:
            DependencyError: Если граф содержит циклы или ошибки.
        """
        self._graph.clear()

        for name, entry in self._entries.items():
            self._graph.add_node(name, entry.metadata.dependencies)

        # Валидация
        errors = self._graph.validate()
        if errors:
            raise DependencyError(
                "Dependency graph validation failed",
                errors=errors,
            )

        self._built = True
        logger.info(
            "[registry] Graph built: %d services, %d edges",
            len(self._entries), self._graph.edge_count,
        )
        return self._graph

    @property
    def graph(self) -> DependencyGraph:
        """Построенный граф. Если не построен — строит автоматически."""
        if not self._built:
            self.build_graph()
        return self._graph

    # ── Порядок запуска/остановки ──

    def start_order(self) -> list[str]:
        """Порядок запуска сервисов (топологический).

        Returns:
            Список имён сервисов — сначала зависимости, потом зависимые.

        Raises:
            DependencyError: Если граф не построен и содержит ошибки.
        """
        return self.graph.start_order()

    def stop_order(self) -> list[str]:
        """Порядок остановки сервисов (обратный топологическому).

        Returns:
            Список имён сервисов — сначала те, от кого не зависят,
            потом те, от кого зависят другие.

        Raises:
            DependencyError: Если граф не построен и содержит ошибки.
        """
        return self.graph.stop_order()

    # ── Доступ к записям ──

    def get(self, name: str) -> ServiceEntry | None:
        """Получить запись сервиса по имени."""
        return self._entries.get(name)

    def require(self, name: str) -> ServiceEntry:
        """Получить запись сервиса по имени (raise если нет)."""
        entry = self._entries.get(name)
        if entry is None:
            raise KeyError(f"Service '{name}' not found in registry")
        return entry

    @property
    def entries(self) -> dict[str, ServiceEntry]:
        """Все зарегистрированные сервисы (name → entry)."""
        return dict(self._entries)

    @property
    def count(self) -> int:
        return len(self._entries)

    @property
    def names(self) -> list[str]:
        return sorted(self._entries.keys())

    # ── Валидация ──

    def validate(self) -> list[str]:
        """Проверить реестр на целостность.

        Returns:
            Список ошибок. Пустой список = всё корректно.
        """
        errors: list[str] = []

        if not self._entries:
            errors.append("No services registered")
            return errors

        for name, entry in self._entries.items():
            if entry.service is None:
                errors.append(f"Service '{name}' has no implementation")

        # Проверка графа
        try:
            g = DependencyGraph()
            for name, entry in self._entries.items():
                g.add_node(name, entry.metadata.dependencies)
            errors.extend(g.validate())
        except Exception as e:
            errors.append(f"Graph validation error: {e}")

        return errors

    def dump(self) -> dict[str, Any]:
        """Информационный дамп реестра (для отладки)."""
        return {
            "count": self.count,
            "services": [
                {
                    "name": entry.name,
                    "version": entry.metadata.version,
                    "status": entry.status.state,
                    "critical": entry.critical,
                    "policy": entry.policy.value,
                    "dependencies": list(entry.metadata.dependencies),
                    "starts": entry.start_count,
                    "errors": entry.error_count,
                }
                for entry in sorted(
                    self._entries.values(),
                    key=lambda e: e.name,
                )
            ],
            "start_order": self.start_order() if self._entries else [],
            "stop_order": self.stop_order() if self._entries else [],
        }

    def __repr__(self) -> str:
        return f"ServiceRegistry({self.count} services, built={self._built})"
