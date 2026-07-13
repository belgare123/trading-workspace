"""Strategy Registry — регистрация, поиск и управление плагинами.

Объединяет PluginRegistry (хранение записей) и DiscoveryEngine (поиск),
предоставляя единый API для register / unregister / lookup / enable / disable.

Пример:
    registry = StrategyRegistry(discovery=my_discovery, plugin_reg=my_registry)
    records = await registry.discover_plugins()
    registry.enable_plugin("momentum")
"""

from __future__ import annotations

import logging
from typing import Any

from core.strategy.descriptor import StrategyDescriptor
from core.strategy.discovery import DiscoveryEngine, DiscoverySource, SourceType
from core.strategy.dependency import DependencyResolver, ResolveReport
from core.strategy.plugin_registry import PluginRecord, PluginRegistry, PluginRegistryError


logger = logging.getLogger(__name__)


class StrategyRegistry:
    """Реестр стратегий — комбинация Discovery + PluginRegistry.

    Responsibilities:
        - discover_plugins() — поиск через DiscoveryEngine + регистрация
        - enable/disable — управление состоянием плагинов
        - list / get — lookup записей
        - dependency resolution — проверка зависимостей

    Composition:
        self._discovery  — поиск стратегий по источникам
        self._registry   — хранение PluginRecord
    """

    def __init__(
        self,
        discovery: DiscoveryEngine | None = None,
        plugin_registry: PluginRegistry | None = None,
        strategies_dir: str = "strategies",
        registry_path: str | None = None,
    ) -> None:
        self._logger = logging.getLogger("strategy.registry")

        # ── Discovery Engine ──
        if discovery is not None:
            self._discovery = discovery
        else:
            self._discovery = DiscoveryEngine()
            self._discovery.add_source(
                DiscoverySource(
                    type=SourceType.LOCAL,
                    path=strategies_dir,
                    label="strategies",
                    priority=10,
                )
            )

        # ── Plugin Registry ──
        if plugin_registry is not None:
            self._registry = plugin_registry
        else:
            self._registry = PluginRegistry(registry_path=registry_path)

    # ── Properties ──

    @property
    def discovery_engine(self) -> DiscoveryEngine:
        """Discovery Engine (Phase 6)."""
        return self._discovery

    @property
    def plugin_registry(self) -> PluginRegistry:
        """Plugin Registry (Phase 6)."""
        return self._registry

    # ── Discovery + Registration ──

    async def discover_plugins(self) -> list[PluginRecord]:
        """Обнаружить плагины через Discovery Engine и зарегистрировать.

        Returns:
            Список зарегистрированных PluginRecord.
        """
        discovered = await self._discovery.discover()
        records: list[PluginRecord] = []
        for plugin in discovered:
            record = self._registry.register(plugin)
            records.append(record)
        return records

    # ── Enable / Disable ──

    def enable_plugin(self, name: str) -> PluginRecord:
        """Включить плагин.

        Args:
            name: Имя плагина.

        Returns:
            PluginRecord.
        """
        return self._registry.set_enabled(name, True)

    def disable_plugin(self, name: str, reason: str | None = None) -> PluginRecord:
        """Отключить плагин.

        Args:
            name: Имя плагина.
            reason: Причина отключения.

        Returns:
            PluginRecord.
        """
        return self._registry.set_enabled(name, False, reason=reason)

    # ── Lookup ──

    def list_plugins(self) -> list[PluginRecord]:
        """Список всех зарегистрированных плагинов."""
        return self._registry.list()

    def list_enabled(self) -> list[PluginRecord]:
        """Список включённых плагинов."""
        return self._registry.get_enabled_plugins()

    def list_disabled(self) -> list[PluginRecord]:
        """Список отключённых плагинов."""
        return self._registry.get_disabled_plugins()

    def get_plugin(self, name: str) -> PluginRecord | None:
        """Получить запись плагина по имени."""
        return self._registry.get(name)

    def save_registry(self) -> None:
        """Сохранить registry.json."""
        self._registry.save()

    # ── Dependency Resolution ──

    @property
    def dependency_resolver(self) -> DependencyResolver:
        """DependencyResolver для стратегий."""
        return self._registry.dependency_resolver

    def resolve_dependencies(
        self,
        check_versions: bool = True,
        strict: bool = False,
    ) -> ResolveReport:
        """Разрешить зависимости для всех зарегистрированных плагинов.

        Args:
            check_versions: Проверять версионные ограничения.
            strict:         Опциональные missing deps как ошибка.

        Returns:
            ResolveReport.
        """
        return self._registry.resolve_dependencies(
            check_versions=check_versions,
            strict=strict,
        )

    def resolve_plugin(
        self,
        name: str,
        check_versions: bool = True,
        strict: bool = False,
    ) -> ResolveReport:
        """Разрешить зависимости для одного плагина.

        Args:
            name:           Имя плагина.
            check_versions: Проверять версионные ограничения.
            strict:         Опциональные missing deps как ошибка.

        Returns:
            ResolveReport.
        """
        return self._registry.resolve_plugin(
            name,
            check_versions=check_versions,
            strict=strict,
        )

    def startup_order(self) -> list[str]:
        """Топологический порядок запуска плагинов.

        Returns:
            Список имён плагинов в порядке запуска.

        Raises:
            PluginRegistryError: Если есть циклические зависимости.
        """
        return self._registry.startup_order()

    def check_dependencies(self, name: str) -> tuple[bool, list[str]]:
        """Проверить, удовлетворены ли зависимости плагина.

        Args:
            name: Имя плагина.

        Returns:
            (ok, reasons).
        """
        return self._registry.check_dependencies(name)
