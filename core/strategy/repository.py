"""
Plugin Repository (6.10) — репозиторий плагинов.

Управляет:
  - Источниками (local, git, github, zip)
  - Поиском плагинов по источникам
  - Скачиванием и установкой
  - Версионированием
  - Кэшем метаданных

Архитектура:

  PluginRepository
    ├── RepositorySource  (local/git/github/zip)
    ├── RepositoryPlugin  (метаданные)
    ├── download(url) → локальный путь
    └── install(name, version, dest) → PluginDiscovery

  Интеграция с DiscoveryEngine:
    repository.discover() → list[PluginDiscovery]
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import tempfile
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Enums & Constants
# ═══════════════════════════════════════════════════════════════════


class SourceType(Enum):
    """Тип источника плагинов."""

    LOCAL = "local"       # локальная директория
    GIT = "git"           # git-репозиторий
    GITHUB = "github"     # GitHub-репозиторий (специальный сниппет)
    ZIP = "zip"           # ZIP-архив по URL
    DIRECTORY = "directory"  # директория с плагинами (уже распакованными)


# Время жизни кэша метаданных (сек)
_DEFAULT_CACHE_TTL = 3600  # 1 час


# ═══════════════════════════════════════════════════════════════════
#  Data models
# ═══════════════════════════════════════════════════════════════════


@dataclass
class RepositorySource:
    """Источник плагинов.

    Attributes:
        name:       Уникальное имя источника (например "community", "official").
        source_type: Тип источника.
        url:        URL или путь к источнику.
        priority:   Приоритет (выше = важнее, при конфликте версий).
        enabled:    Активен ли источник.
        description: Описание (опционально).
        cache_ttl:  Время жизни кэша метаданных (сек).
    """

    name: str
    source_type: SourceType
    url: str
    priority: int = 0
    enabled: bool = True
    description: str = ""
    cache_ttl: float = _DEFAULT_CACHE_TTL

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "source_type": self.source_type.value,
            "url": self.url,
            "priority": self.priority,
            "enabled": self.enabled,
            "description": self.description,
        }

    @classmethod
    def local(
        cls,
        name: str,
        path: str,
        priority: int = 0,
        description: str = "",
    ) -> RepositorySource:
        """Создать локальный источник."""
        return cls(
            name=name,
            source_type=SourceType.LOCAL,
            url=path,
            priority=priority,
            description=description or f"Local directory: {path}",
        )

    @classmethod
    def remote(
        cls,
        name: str,
        url: str,
        source_type: SourceType = SourceType.GIT,
        priority: int = 1,
        description: str = "",
    ) -> RepositorySource:
        """Создать удалённый источник."""
        return cls(
            name=name,
            source_type=source_type,
            url=url,
            priority=priority,
            description=description or f"Remote source: {url}",
        )

    def __hash__(self) -> int:
        return hash(self.name)


@dataclass
class RepositoryPlugin:
    """Метаданные плагина в репозитории.

    Attributes:
        name:         Имя плагина.
        version:      Версия.
        source:       Источник (RepositorySource).
        description:  Описание.
        download_url: URL для скачивания.
        manifest:     Содержимое manifest.yaml (если доступно).
        checksum:     SHA256 архива (если доступен).
        updated_at:   Время обновления метаданных.
    """

    name: str
    version: str
    source: RepositorySource
    description: str = ""
    download_url: str = ""
    manifest: dict[str, Any] = field(default_factory=dict)
    checksum: str = ""
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "source": self.source.name,
            "description": self.description,
            "download_url": self.download_url,
            "checksum": self.checksum,
            "updated_at": self.updated_at,
        }


# ═══════════════════════════════════════════════════════════════════
#  PluginRepository
# ═══════════════════════════════════════════════════════════════════


class PluginRepository:
    """Репозиторий плагинов.

    Управляет источниками и предоставляет единый интерфейс
    для поиска, скачивания и установки плагинов.

    Usage:
        repo = PluginRepository(cache_dir="plugins/cache")
        repo.add_source(RepositorySource.local("builtin", "strategies/"))
        repo.add_source(RepositorySource.remote("community",
            "https://github.com/user/plugins.git"))

        # Поиск
        plugins = repo.search("Momentum")

        # Установка
        await repo.install("Momentum", "1.0.0", dest="plugins/installed")
    """

    def __init__(
        self,
        cache_dir: str | None = None,
    ) -> None:
        self._sources: dict[str, RepositorySource] = {}
        self._cache_dir = cache_dir

        # Кэш метаданных {source_name → [RepositoryPlugin]}
        self._plugin_cache: dict[str, list[RepositoryPlugin]] = {}
        self._cache_timestamps: dict[str, float] = {}

        # Создаём кэш-директорию
        if self._cache_dir:
            os.makedirs(self._cache_dir, exist_ok=True)

    # ── Sources ──

    def add_source(self, source: RepositorySource) -> None:
        """Добавить источник плагинов."""
        if source.name in self._sources:
            logger.debug("Updating source: %s", source.name)
        self._sources[source.name] = source
        logger.info("Added repository source: %s (%s)", source.name, source.url)

    def remove_source(self, name: str) -> None:
        """Удалить источник."""
        self._sources.pop(name, None)
        self._plugin_cache.pop(name, None)
        self._cache_timestamps.pop(name, None)

    def get_source(self, name: str) -> RepositorySource | None:
        """Получить источник по имени."""
        return self._sources.get(name)

    def list_sources(self) -> list[RepositorySource]:
        """Список всех источников (отсортированных по приоритету)."""
        return sorted(
            self._sources.values(),
            key=lambda s: (-s.priority, s.name),
        )

    def list_enabled_sources(self) -> list[RepositorySource]:
        """Только активные источники."""
        return [s for s in self.list_sources() if s.enabled]

    # ── Discovery — поиск плагинов на источниках ──

    def list_available(
        self,
        source_name: str | None = None,
        refresh: bool = False,
    ) -> list[RepositoryPlugin]:
        """Список доступных плагинов.

        Args:
            source_name: Фильтр по источнику (None = все).
            refresh:     Принудительно обновить кэш.

        Returns:
            Список RepositoryPlugin.
        """
        sources = (
            [self._sources[source_name]]
            if source_name and source_name in self._sources
            else self.list_enabled_sources()
        )

        result: list[RepositoryPlugin] = []
        for source in sources:
            result.extend(self._discover_source(source, refresh=refresh))

        return result

    def search(
        self,
        query: str,
        source_name: str | None = None,
        refresh: bool = False,
    ) -> list[RepositoryPlugin]:
        """Поиск плагинов по имени/описанию.

        Args:
            query:       Строка поиска (регистронезависимая).
            source_name: Фильтр по источнику.
            refresh:     Принудительно обновить кэш.

        Returns:
            Список совпавших RepositoryPlugin.
        """
        query_lower = query.lower()
        plugins = self.list_available(source_name=source_name, refresh=refresh)
        return [
            p for p in plugins
            if query_lower in p.name.lower()
            or query_lower in p.description.lower()
        ]

    def get_plugin(
        self,
        name: str,
        version: str | None = None,
    ) -> RepositoryPlugin | None:
        """Найти плагин по имени (и опционально версии).

        Args:
            name:    Имя плагина.
            version: Конкретная версия (None = последняя).

        Returns:
            RepositoryPlugin или None.
        """
        candidates: list[RepositoryPlugin] = []
        for source in self.list_enabled_sources():
            for plugin in self._discover_source(source):
                if plugin.name == name:
                    candidates.append(plugin)

        if not candidates:
            return None

        if version:
            for p in candidates:
                if p.version == version:
                    return p
            return None

        # Последняя версия по сортировке
        candidates.sort(key=lambda p: p.version, reverse=True)
        return candidates[0]

    def list_versions(self, name: str) -> list[RepositoryPlugin]:
        """Все версии плагина из всех источников."""
        versions: list[RepositoryPlugin] = []
        seen: set[str] = set()
        for source in self.list_enabled_sources():
            for plugin in self._discover_source(source):
                if plugin.name == name:
                    key = (plugin.name, plugin.version, plugin.source.name)
                    if key not in seen:
                        seen.add(key)
                        versions.append(plugin)
        return sorted(versions, key=lambda p: p.version, reverse=True)

    # ── Install ──

    async def install(
        self,
        name: str,
        version: str | None = None,
        dest: str | None = None,
    ) -> str:
        """Скачать и установить плагин.

        Args:
            name:    Имя плагина.
            version: Версия (None = последняя).
            dest:    Целевая директория (None = cache_dir/installed/).

        Returns:
            Путь к установленному плагину.

        Raises:
            FileNotFoundError: Если плагин не найден.
            RuntimeError:      Если не удалось скачать/распаковать.
        """
        plugin = self.get_plugin(name, version)
        if not plugin:
            raise FileNotFoundError(
                f"Plugin '{name}' v{version or 'latest'} not found in any source"
            )

        dest_path = dest or os.path.join(
            self._cache_dir or "plugins",
            "installed",
            name,
            plugin.version,
        )

        if os.path.exists(dest_path):
            logger.info("Plugin already installed: %s v%s at %s", name, plugin.version, dest_path)
            return dest_path

        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        source = plugin.source
        if source.source_type == SourceType.LOCAL:
            self._install_local(plugin, source, dest_path)
        elif source.source_type in (SourceType.GIT, SourceType.GITHUB):
            await self._install_git(plugin, source, dest_path)
        elif source.source_type == SourceType.ZIP:
            await self._install_zip(plugin, dest_path)
        else:
            raise RuntimeError(f"Unsupported source type: {source.source_type}")

        logger.info("Installed plugin: %s v%s → %s", name, plugin.version, dest_path)
        return dest_path

    def _install_local(
        self,
        plugin: RepositoryPlugin,
        source: RepositorySource,
        dest_path: str,
    ) -> None:
        """Установить из локальной директории (копирование)."""
        src_path = os.path.join(source.url, plugin.name)
        if os.path.isdir(src_path):
            shutil.copytree(src_path, dest_path, dirs_exist_ok=True)
        else:
            shutil.copy2(src_path, dest_path)

    async def _install_git(
        self,
        plugin: RepositoryPlugin,
        source: RepositorySource,
        dest_path: str,
    ) -> None:
        """Установить из git-репозитория (через git clone).
        
        В реальности использует git команды; для тестов — заглушка.
        """
        repo_url = source.url
        tmp_dir = tempfile.mkdtemp()
        try:
            # В production: subprocess git clone
            logger.debug("Would clone %s to %s", repo_url, tmp_dir)
            # Пока — создаём заглушку
            os.makedirs(os.path.join(tmp_dir, ".."), exist_ok=True)
            if not os.path.exists(tmp_dir):
                os.makedirs(tmp_dir)

            # Копируем в dest
            shutil.copytree(tmp_dir, dest_path, dirs_exist_ok=True)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    async def _install_zip(
        self,
        plugin: RepositoryPlugin,
        dest_path: str,
    ) -> None:
        """Установить из ZIP-архива.

        В production: скачать URL, распаковать.
        Для тестов — заглушка.
        """
        download_url = plugin.download_url or plugin.source.url
        logger.debug("Would download %s and extract to %s", download_url, dest_path)
        os.makedirs(dest_path, exist_ok=True)

    # ── Cache management ──

    def clear_cache(self) -> None:
        """Очистить кэш метаданных."""
        self._plugin_cache.clear()
        self._cache_timestamps.clear()
        logger.debug("Repository cache cleared")

    def clear_download_cache(self) -> None:
        """Очистить кэш скачанных архивов."""
        if not self._cache_dir:
            return
        dl_cache = os.path.join(self._cache_dir, "downloads")
        if os.path.isdir(dl_cache):
            shutil.rmtree(dl_cache, ignore_errors=True)
            os.makedirs(dl_cache, exist_ok=True)

    # ── Internal: discovery per source ──

    def _discover_source(
        self,
        source: RepositorySource,
        refresh: bool = False,
    ) -> list[RepositoryPlugin]:
        """Обнаружить плагины в одном источнике.

        Использует кэш, если он актуален.
        """
        # Проверяем кэш
        if not refresh:
            cached = self._plugin_cache.get(source.name)
            ts = self._cache_timestamps.get(source.name, 0)
            if cached is not None and (time.time() - ts) < source.cache_ttl:
                return cached

        if source.source_type == SourceType.LOCAL:
            plugins = self._scan_local(source)
        elif source.source_type in (SourceType.GIT, SourceType.GITHUB, SourceType.ZIP):
            # Для удалённых источников — возвращаем заглушку
            # В production: fetch manifest.json/catalog
            plugins = self._scan_remote(source)
        else:
            plugins = []

        # Обновляем кэш
        self._plugin_cache[source.name] = plugins
        self._cache_timestamps[source.name] = time.time()
        return plugins

    def _scan_local(self, source: RepositorySource) -> list[RepositoryPlugin]:
        """Сканировать локальную директорию с плагинами.

        Ищет поддиректории с manifest.yaml.
        """
        plugins: list[RepositoryPlugin] = []
        base = Path(source.url)

        if not base.is_dir():
            logger.warning("Local source directory not found: %s", source.url)
            return plugins

        for item in sorted(base.iterdir()):
            if not item.is_dir():
                continue

            manifest_path = item / "manifest.yaml"
            if not manifest_path.exists():
                continue

            try:
                manifest = self._parse_manifest(manifest_path)
                plugin = RepositoryPlugin(
                    name=manifest.get("id", manifest.get("name", item.name)),
                    version=manifest.get("version", "0.0.0"),
                    source=source,
                    description=manifest.get("description", ""),
                    manifest=manifest,
                    download_url=item.as_uri(),
                )
                plugins.append(plugin)
            except Exception as e:
                logger.debug("Skipping %s: %s", item.name, e)

        return plugins

    def _scan_remote(self, source: RepositorySource) -> list[RepositoryPlugin]:
        """Сканировать удалённый источник.

        Возвращает пустой список для заглушки.
        В production: запросить catalog.json или просканировать репозиторий.
        """
        # В текущей реализации — пусто (удалённые источники
        # будут добавлены позже через реестр Marketplace)
        return []

    # ── Helpers ──

    @staticmethod
    def _parse_manifest(path: Path) -> dict[str, Any]:
        """Парсинг manifest.yaml.

        Returns:
            Словарь с содержимым manifest-файла.
        """
        content = path.read_text(encoding="utf-8")
        import yaml
        return yaml.safe_load(content) or {}

    @staticmethod
    def _checksum_file(path: str) -> str:
        """SHA256 файла."""
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    # ── Persistence (sources) ──

    def save_sources(self, path: str) -> None:
        """Сохранить конфигурацию источников."""
        data = {
            "version": "1.0",
            "sources": [s.to_dict() for s in self._sources.values()],
        }
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        logger.debug("Saved repository sources to %s", path)

    def load_sources(self, path: str) -> None:
        """Загрузить конфигурацию источников."""
        if not os.path.exists(path):
            return
        with open(path) as f:
            data = json.load(f)
        for s_data in data.get("sources", []):
            s_data["source_type"] = SourceType(s_data["source_type"])
            source = RepositorySource(**s_data)
            self._sources[source.name] = source
        logger.debug("Loaded %d repository sources from %s", len(data.get("sources", [])), path)

    def summary(self) -> str:
        """Краткий отчёт."""
        sources = self.list_sources()
        available = self.list_available()
        lines = [
            f"PluginRepository: {len(sources)} sources, "
            f"{len(available)} plugins available",
        ]
        for src in sources:
            count = len(self._plugin_cache.get(src.name, []))
            status = "✓" if src.enabled else "✗"
            lines.append(
                f"  [{status}] {src.name:20s} {src.source_type.value:10s}"
                f" priority={src.priority} ({count} plugins)"
            )
        return "\n".join(lines)
