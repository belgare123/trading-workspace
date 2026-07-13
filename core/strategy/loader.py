"""Plugin Loader — сканирование, импорт и валидация стратегий.

PluginLoader сканирует strategies/*/manifest.yaml и импортирует Python-модули.

Пример:
    loader = PluginLoader("strategies")
    plugins = await loader.discover()
    for info in plugins:
        strategy_class = loader.import_strategy(info)
        strategy = strategy_class()
"""

from __future__ import annotations

import importlib
import inspect
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from core.api import CORE_API_VERSION
from core.strategy.base import BaseStrategy
from core.strategy.descriptor import ManifestLoader, StrategyDescriptor

if TYPE_CHECKING:
    from core.strategy.plugin_registry import PluginRecord


# ═══════════════════════════════════════════════════════════════════
#  PluginInfo — информация об обнаруженном плагине
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PluginInfo:
    """Информация об обнаруженном плагине стратегии.

    Attributes:
        descriptor:    Descriptor из manifest.yaml.
        manifest_path: Путь к manifest.yaml.
        strategy_dir:  Путь к директории стратегии.
        module_path:   Путь к Python-модулю (strategy.py).
    """

    descriptor: StrategyDescriptor
    manifest_path: str
    strategy_dir: str
    module_path: str | None = None

    @classmethod
    def from_plugin_record(cls, record: PluginRecord) -> PluginInfo:
        """Создать PluginInfo из PluginRecord (единый Discovery)."""
        discovery = record.discovery
        descriptor = ManifestLoader.from_file(discovery.manifest_path)
        return cls(
            descriptor=descriptor,
            manifest_path=discovery.manifest_path,
            strategy_dir=discovery.strategy_dir,
            module_path=discovery.module_path,
        )


# ═══════════════════════════════════════════════════════════════════
#  PluginLoader — сканирование, загрузка, валидация
# ═══════════════════════════════════════════════════════════════════


class PluginLoader:
    """Сканирование и загрузка стратегий из файловой системы.

    Ищет strategies/*/manifest.yaml, валидирует manifest,
    импортирует Python-модуль strategy.py.

    Пример:
        loader = PluginLoader("strategies")
        plugins = await loader.discover()
        for info in plugins:
            strategy_class = loader.import_strategy(info)
            strategy = strategy_class()
    """

    def __init__(self, strategies_dir: str = "strategies") -> None:
        self._strategies_dir = strategies_dir
        self._logger = logging.getLogger("strategy.plugin_loader")

    # ── Version helpers ──

    @staticmethod
    def _parse_version(ver: str) -> tuple[int, ...]:
        """Парсить строку версии в кортеж для сравнения.

        Поддерживает:
          - "2.0" → (2, 0, 0)
          - "0.12.0" → (0, 12, 0)
          - "1.0.0-alpha" → (1, 0, 0)

        Returns:
            Tuple целых чисел для сравнения.
        """
        # Отрезаем pre-release суффикс (-alpha, -beta, etc)
        clean = ver.split("-")[0]
        parts = clean.split(".")
        result: list[int] = []
        for p in parts:
            try:
                result.append(int(p))
            except ValueError:
                break
        while len(result) < 3:
            result.append(0)
        return tuple(result)

    @staticmethod
    def check_version_compatibility(
        descriptor: StrategyDescriptor,
    ) -> str | None:
        """Проверить совместимость версий стратегии с платформой.

        Args:
            descriptor: StrategyDescriptor стратегии.

        Returns:
            None если версии совместимы.
            str с описанием проблемы если несовместимы.
        """
        # 1. Проверка API версии
        api_platform = PluginLoader._parse_version(CORE_API_VERSION)
        api_strategy = PluginLoader._parse_version(descriptor.api_version)

        if api_strategy > api_platform:
            return (
                f"Strategy requires API v{descriptor.api_version}, "
                f"but platform supports only v{CORE_API_VERSION}"
            )

        # 2. Проверка min_core
        from core import __version__

        core_platform = PluginLoader._parse_version(__version__)
        core_required = PluginLoader._parse_version(descriptor.min_core)

        if core_required > core_platform:
            return (
                f"Strategy requires core >= {descriptor.min_core}, "
                f"but current core is {__version__}"
            )

        return None

    # ── Discovery (filesystem scan) ──

    async def discover(self) -> list[PluginInfo]:
        """Найти все стратегии в strategies/ директории.

        Returns:
            Список PluginInfo для каждой найденной стратегии.
            Пустой список если директория не существует.
        """
        base = Path(self._strategies_dir)
        if not base.exists():
            self._logger.info(f"Strategies dir not found: {base}")
            return []

        plugins: list[PluginInfo] = []

        for entry in sorted(base.iterdir()):
            if not entry.is_dir():
                continue

            manifest_path = entry / "manifest.yaml"
            if not manifest_path.exists():
                self._logger.debug(f"No manifest.yaml in {entry.name}")
                continue

            try:
                descriptor = ManifestLoader.from_file(str(manifest_path))
            except Exception as e:
                self._logger.warning(
                    f"Invalid manifest in {entry.name}: {e}"
                )
                continue

            # Проверка совместимости версий
            version_issue = self.check_version_compatibility(descriptor)
            if version_issue:
                self._logger.warning(
                    f"Version mismatch for {entry.name}: {version_issue}"
                )
                continue

            # Проверка config.yaml по схеме (если есть и config.yaml существует)
            if descriptor.config_schema is not None:
                config_path = entry / "config.yaml"
                if config_path.exists():
                    try:
                        import yaml

                        with open(config_path) as f:
                            user_config = yaml.safe_load(f) or {}
                        from core.strategy.config_schema import normalize_config

                        normalized = normalize_config(
                            user_config, descriptor.config_schema
                        )
                        # Проверяем расхождения
                        if normalized != user_config:
                            self._logger.info(
                                f"Config for {entry.name} normalized "
                                f"(defaults applied / types coerced)"
                            )
                    except Exception as e:
                        self._logger.warning(
                            f"Cannot validate config for {entry.name}: {e}"
                        )

            strategy_py = entry / "strategy.py"
            module_path = str(strategy_py) if strategy_py.exists() else None

            plugin = PluginInfo(
                descriptor=descriptor,
                manifest_path=str(manifest_path),
                strategy_dir=str(entry),
                module_path=module_path,
            )
            plugins.append(plugin)
            self._logger.info(
                f"Discovered: {descriptor.name} v{descriptor.version}"
                f" ({descriptor.category.value})"
            )

        self._logger.info(f"Discovered {len(plugins)} strategies")
        return plugins

    # ── Import ──

    def import_strategy(self, info: PluginInfo) -> type[BaseStrategy]:
        """Импортировать Python-модуль стратегии и найти класс.

        Args:
            info: PluginInfo из discover().

        Returns:
            Класс стратегии (наследник BaseStrategy).

        Raises:
            ImportError: если модуль не найден или не содержит стратегии.
        """
        if not info.module_path:
            raise ImportError(
                f"No strategy.py found for {info.descriptor.name}"
            )

        strategy_dir = Path(info.strategy_dir).resolve()
        module_path = Path(info.module_path).resolve()

        # Добавляем директорию стратегии в sys.path
        if str(strategy_dir.parent) not in sys.path:
            sys.path.insert(0, str(strategy_dir.parent))

        # Импортируем модуль
        module_name = f"{strategy_dir.name}.strategy"
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load module: {module_path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Ищем класс стратегии (наследник BaseStrategy)
        strategy_class = None
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if obj is BaseStrategy:
                continue
            if issubclass(obj, BaseStrategy):
                self._logger.info(
                    f"Found strategy class: {name} in {info.descriptor.name}"
                )
                strategy_class = obj
                break

        if strategy_class is None:
            raise ImportError(
                f"No BaseStrategy subclass found in {info.module_path}"
            )

        return strategy_class

    def import_strategy_class(
        self, module_path: str, class_name: str | None = None
    ) -> type[BaseStrategy]:
        """Импортировать класс стратегии по прямому пути к модулю.

        Args:
            module_path: Путь к Python-файлу.
            class_name:  Имя класса (если None — ищется первый BaseStrategy наследник).

        Returns:
            Класс стратегии.
        """
        module_path = Path(module_path).resolve()
        if not module_path.exists():
            raise ImportError(f"Module not found: {module_path}")

        # Добавляем родительскую директорию в sys.path
        parent = str(module_path.parent)
        if parent not in sys.path:
            sys.path.insert(0, parent)

        module_name = module_path.stem
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load module: {module_path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if class_name:
            cls = getattr(module, class_name, None)
            if cls is None:
                raise ImportError(f"Class {class_name} not found in {module_path}")
            if not issubclass(cls, BaseStrategy):
                raise TypeError(f"{class_name} is not a BaseStrategy subclass")
            return cls

        # Ищем первый наследник BaseStrategy
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if obj is not BaseStrategy and issubclass(obj, BaseStrategy):
                self._logger.info(f"Found strategy class: {name}")
                return obj

        raise ImportError(f"No BaseStrategy subclass found in {module_path}")
