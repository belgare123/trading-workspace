"""
Discovery Engine — поиск стратегий по множественным источникам.

Источники:
  - plugins/*             (локальная файловая система)
  - user_plugins/*        (пользовательские стратегии)
  - enterprise_plugins/*  (корпоративные)
  - marketplace/*         (Marketplace кэш)
  - github://...          (GitHub — заглушка)
  - git://...             (Git — заглушка)
  - zip://...             (ZIP — заглушка)

Discovery возвращает PluginDiscovery — лёгкий датакласс без загрузки Python.
"""

from __future__ import annotations

import enum
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from core.strategy.descriptor import ManifestLoader, PluginDependency, StrategyDescriptor

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  SourceType — типы источников
# ═══════════════════════════════════════════════════════════════════


class SourceType(str, enum.Enum):
    """Тип источника стратегий.

    LOCAL       — локальная файловая система.
    MARKETPLACE — кэшированные файлы Marketplace.
    GITHUB      — GitHub repository (через API / git clone).
    GIT         — произвольный git-репозиторий.
    ZIP         — архив.
    """

    LOCAL = "local"
    MARKETPLACE = "marketplace"
    GITHUB = "github"
    GIT = "git"
    ZIP = "zip"


# ═══════════════════════════════════════════════════════════════════
#  DiscoverySource — конфигурация источника
# ═══════════════════════════════════════════════════════════════════


@dataclass
class DiscoverySource:
    """Источник стратегий.

    Attributes:
        type:      Тип источника.
        path:      Путь (файловая система) или URI (github://user/repo).
        label:     Человеко-читаемая метка (для Dashboard).
        enabled:   True — сканировать.
        priority:  Приоритет (выше = раньше в результатах).
        ttl:       TTL кэша discovery (сек). 0 = не кэшировать.
    """

    type: SourceType
    path: str
    label: str = ""
    enabled: bool = True
    priority: int = 0
    ttl: float = 60.0

    def __post_init__(self) -> None:
        if not self.label:
            self.label = f"{self.type.value}:{Path(self.path).name}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type.value,
            "path": self.path,
            "label": self.label,
            "enabled": self.enabled,
            "priority": self.priority,
            "ttl": self.ttl,
        }

    @classmethod
    def default_sources(cls) -> list[DiscoverySource]:
        """Создать список источников по умолчанию."""
        return [
            cls(
                type=SourceType.LOCAL,
                path="plugins",
                label="Plugins",
                enabled=True,
                priority=10,
            ),
            cls(
                type=SourceType.LOCAL,
                path="user_plugins",
                label="User Plugins",
                enabled=True,
                priority=20,
            ),
            cls(
                type=SourceType.LOCAL,
                path="enterprise_plugins",
                label="Enterprise Plugins",
                enabled=True,
                priority=30,
            ),
            cls(
                type=SourceType.MARKETPLACE,
                path="marketplace",
                label="Marketplace",
                enabled=True,
                priority=40,
            ),
        ]


# ═══════════════════════════════════════════════════════════════════
#  PluginDiscovery — результат поиска (без Python)
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PluginDiscovery:
    """Результат обнаружения стратегии.

    Содержит только метаданные из файловой системы / источника.
    Никакой Python-модуль не импортирован.
    """

    # ── Идентификация ──
    name: str
    version: str

    # ── Источник ──
    source: DiscoverySource
    strategy_dir: str  # абсолютный путь к директории стратегии
    manifest_path: str  # путь к manifest.yaml

    # ── Опционально ──
    module_path: str | None = None  # путь к strategy.py (если есть)
    author: str = ""
    description: str = ""
    category: str = ""
    api_version: str = ""
    min_core: str = ""
    exchanges: list[str] = field(default_factory=list)
    timeframes: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)
    enabled: bool = True
    error: str | None = None  # если discovery провалился
    plugin_type: str = "strategy"
    dependencies: list[PluginDependency] = field(default_factory=list)

    @classmethod
    def from_descriptor(
        cls,
        descriptor: StrategyDescriptor,
        source: DiscoverySource,
        strategy_dir: str,
        manifest_path: str,
        module_path: str | None = None,
        enabled: bool = True,
        error: str | None = None,
    ) -> PluginDiscovery:
        """Создать из StrategyDescriptor."""
        return cls(
            name=descriptor.name,
            version=descriptor.version,
            author=descriptor.author or "",
            description=descriptor.description or "",
            source=source,
            strategy_dir=strategy_dir,
            manifest_path=manifest_path,
            module_path=module_path,
            category=descriptor.category.value if descriptor.category else "",
            api_version=descriptor.api_version,
            min_core=descriptor.min_core,
            exchanges=list(descriptor.exchange),
            timeframes=list(descriptor.timeframes),
            capabilities=list(descriptor.capabilities),
            enabled=enabled,
            error=error,
            dependencies=list(descriptor.dependencies),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "author": self.author,
            "description": self.description,
            "source": self.source.to_dict(),
            "strategy_dir": self.strategy_dir,
            "manifest_path": self.manifest_path,
            "category": self.category,
            "api_version": self.api_version,
            "min_core": self.min_core,
            "exchanges": self.exchanges,
            "timeframes": self.timeframes,
            "capabilities": self.capabilities,
            'enabled': self.enabled,
            'error': self.error,
            'plugin_type': self.plugin_type,
            'dependencies': [d.to_dict() for d in self.dependencies],
        }

    def __repr__(self) -> str:
        return (
            f"PluginDiscovery({self.name} v{self.version}, "
            f"source={self.source.label}, "
            f"{'enabled' if self.enabled else 'disabled'})"
        )


# ═══════════════════════════════════════════════════════════════════
#  DiscoveryEngine — оркестратор поиска
# ═══════════════════════════════════════════════════════════════════


class DiscoveryError(Exception):
    """Ошибка при поиске стратегий."""

    pass


class DiscoveryEngine:
    """Поиск стратегий по нескольким источникам.

    Пример:
        engine = DiscoveryEngine()
        engine.add_source(DiscoverySource(type=SourceType.LOCAL, path="plugins"))
        engine.add_source(DiscoverySource(type=SourceType.LOCAL, path="user_plugins"))

        results = await engine.discover()
        for plugin in results:
            print(f"Found: {plugin.name} v{plugin.version}")

    Каждый источник возвращает PluginDiscovery без импорта Python.
    """

    def __init__(
        self,
        sources: list[DiscoverySource] | None = None,
    ) -> None:
        self._sources: list[DiscoverySource] = sources or []
        self._discovers: dict[SourceType, type[_SourceScanner]] = {}
        self._register_default_scanners()

    def _register_default_scanners(self) -> None:
        """Зарегистрировать встроенные сканеры."""
        self.register_scanner(SourceType.LOCAL, _LocalScanner)
        self.register_scanner(SourceType.MARKETPLACE, _LocalScanner)

    def register_scanner(
        self,
        source_type: SourceType,
        scanner_class: type[_SourceScanner],
    ) -> None:
        """Зарегистрировать сканер для типа источника."""
        self._discovers[source_type] = scanner_class

    # ── Source management ──

    def add_source(self, source: DiscoverySource) -> None:
        """Добавить источник для поиска."""
        self._sources.append(source)
        logger.debug("Added discovery source: %s (%s)", source.label, source.path)

    def remove_source(self, path: str) -> bool:
        """Удалить источник по пути.

        Returns:
            True если источник найден и удалён.
        """
        for i, s in enumerate(self._sources):
            if s.path == path:
                self._sources.pop(i)
                return True
        return False

    def get_sources(self) -> list[DiscoverySource]:
        """Получить все источники."""
        return list(self._sources)

    def clear_sources(self) -> None:
        """Очистить все источники."""
        self._sources.clear()

    @property
    def count(self) -> int:
        return len(self._sources)

    # ── Discovery ──

    async def discover(self) -> list[PluginDiscovery]:
        """Запустить поиск по всем активным источникам.

        Returns:
            Список PluginDiscovery со всех источников.
            Отсортирован по priority источника, затем по имени.
            Дубликаты по имени разрешаются в пользу higher priority.
        """
        by_name: dict[str, PluginDiscovery] = {}

        # Сортируем источники по priority (выше = раньше, т.е. weaker first)
        sorted_sources = sorted(
            [s for s in self._sources if s.enabled],
            key=lambda s: s.priority,
        )

        for source in sorted_sources:
            scanner_cls = self._discovers.get(source.type)
            if scanner_cls is None:
                logger.warning("No scanner for source type: %s", source.type)
                continue

            try:
                scanner = scanner_cls(source)
                results = await scanner.scan()
            except Exception as e:
                logger.error(
                    "Discovery failed for %s (%s): %s",
                    source.label,
                    source.path,
                    e,
                )
                continue

            for plugin in results:
                if plugin.name in by_name:
                    existing = by_name[plugin.name]
                    # Higher priority source overrides
                    if source.priority > existing.source.priority:
                        logger.debug(
                            "Overriding %s from %s (pri %d) with %s (pri %d)",
                            plugin.name,
                            existing.source.label,
                            existing.source.priority,
                            source.label,
                            source.priority,
                        )
                        by_name[plugin.name] = plugin
                else:
                    by_name[plugin.name] = plugin

        # Sort by source priority, then by name
        sorted_plugins = sorted(
            by_name.values(),
            key=lambda p: (p.source.priority, p.name),
        )

        logger.info(
            "Discovery complete: %d plugins from %d sources",
            len(sorted_plugins),
            len(sorted_sources),
        )
        return sorted_plugins

    async def discover_source(self, source: DiscoverySource) -> list[PluginDiscovery]:
        """Запустить поиск по одному источнику.

        Args:
            source: Источник для сканирования.

        Returns:
            Список PluginDiscovery из указанного источника.
        """
        scanner_cls = self._discovers.get(source.type)
        if scanner_cls is None:
            raise DiscoveryError(f"No scanner for source type: {source.type}")

        scanner = scanner_cls(source)
        return await scanner.scan()

    # ── State ──

    def summary(self) -> str:
        """Краткий отчёт о discovery engine."""
        lines = [
            f"DiscoveryEngine: {len(self._sources)} sources",
        ]
        for s in self._sources:
            status = "✓" if s.enabled else "✗"
            lines.append(f"  [{status}] {s.label:20s} {s.type.value:12s} {s.path}")
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
#  _SourceScanner — базовый класс сканера
# ═══════════════════════════════════════════════════════════════════


class _SourceScanner:
    """Базовый класс для сканера источника."""

    def __init__(self, source: DiscoverySource) -> None:
        self.source = source

    async def scan(self) -> list[PluginDiscovery]:
        """Сканировать источник.

        Returns:
            Список PluginDiscovery.

        Raises:
            DiscoveryError: при критической ошибке сканирования.
        """
        raise NotImplementedError


# ═══════════════════════════════════════════════════════════════════
#  _LocalScanner — сканирование локальной файловой системы
# ═══════════════════════════════════════════════════════════════════


class _LocalScanner(_SourceScanner):
    """Сканирование локальной директории на предмет стратегий.

    Ищет:
      <source.path>/*/manifest.yaml
      <source.path>/*/strategy.py
    """

    async def scan(self) -> list[PluginDiscovery]:
        results: list[PluginDiscovery] = []
        base = Path(self.source.path)

        if not base.exists():
            logger.debug("Directory not found: %s", base)
            return []

        if not base.is_dir():
            logger.warning("Not a directory: %s", base)
            return []

        for entry in sorted(base.iterdir()):
            if not entry.is_dir():
                continue

            manifest_path = entry / "manifest.yaml"
            if not manifest_path.exists():
                logger.debug("No manifest.yaml in %s", entry.name)
                continue

            # Парсим manifest.yaml (без импорта Python)
            try:
                descriptor = ManifestLoader.from_file(str(manifest_path))
            except Exception as e:
                logger.warning(
                    "Invalid manifest in %s: %s", entry.name, e
                )
                # Возвращаем ошибочный discovery для Dashboard
                results.append(
                    PluginDiscovery(
                        name=entry.name,
                        version="0.0.0",
                        source=self.source,
                        strategy_dir=str(entry),
                        manifest_path=str(manifest_path),
                        error=f"Invalid manifest: {e}",
                        enabled=False,
                    )
                )
                continue

            strategy_py = entry / "strategy.py"
            module_path = str(strategy_py) if strategy_py.exists() else None

            plugin = PluginDiscovery.from_descriptor(
                descriptor=descriptor,
                source=self.source,
                strategy_dir=str(entry),
                manifest_path=str(manifest_path),
                module_path=module_path,
            )
            results.append(plugin)

        return results
