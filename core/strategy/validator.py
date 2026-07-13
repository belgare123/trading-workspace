"""
Strategy Validator — полный pipeline проверок для сторонних стратегий.

Проверяет:
  1. Manifest — обязательные поля, категории, capabilities
  2. Entry Point — exists, importable, implements IStrategy
  3. Config — схема, типы, min/max, обязательные параметры
  4. Capabilities — все запрошенные известны платформе
  5. Version — api_version и min_core совместимы

Usage:
    results = StrategyValidator.validate(plugin_info)
    if any(r.severity == Severity.ERROR for r in results):
        print("Strategy rejected")
    for r in results:
        print(f"[{r.severity.value}] {r.message}")
"""

from __future__ import annotations

import abc
import importlib.util
import inspect
import logging
import os
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from core.strategy.descriptor import (
    ManifestError,
    ManifestLoader,
    StrategyCategory,
    capability_by_name,
    StrategyDescriptor,
)
from core.strategy.config_schema import ConfigSchema, validate_config_with_schema, normalize_config
from core.strategy.engine import PluginInfo, PluginLoader

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Типы результатов
# ═══════════════════════════════════════════════════════════════════


class Severity(Enum):
    """Степень серьёзности проблемы."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class ValidationResult:
    """Результат одной проверки.

    Attributes:
        stage:      Название стадии проверки (manifest, code, config, etc).
        severity:   Серьёзность.
        message:    Текстовое описание.
        detail:     Дополнительная информация (по желанию).
    """

    stage: str
    severity: Severity
    message: str
    detail: str = ""

    def __bool__(self) -> bool:
        """True если проверка успешна (нет ERROR)."""
        return self.severity != Severity.ERROR


@dataclass
class ValidationReport:
    """Полный отчёт валидации стратегии.

    Attributes:
        strategy_name: Имя стратегии.
        passed:        Количество пройденных проверок.
        warnings:      Количество предупреждений.
        errors:        Количество ошибок.
        results:       Все результаты.
    """

    strategy_name: str = ""
    passed: int = 0
    warnings: int = 0
    errors: int = 0
    results: list[ValidationResult] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        """True если нет ERROR."""
        return self.errors == 0

    @property
    def summary(self) -> str:
        """Краткая сводка."""
        return (
            f"{self.strategy_name}: "
            f"{self.passed} passed, "
            f"{self.warnings} warnings, "
            f"{self.errors} errors "
            f"→ {'OK' if self.is_valid else 'REJECTED'}"
        )

    def to_log(self) -> None:
        """Записать в лог."""
        for r in self.results:
            level = {
                Severity.INFO: logging.INFO,
                Severity.WARNING: logging.WARNING,
                Severity.ERROR: logging.ERROR,
            }[r.severity]
            logger.log(level, "[%s] %s: %s", r.stage, r.message, r.detail)

    def add(self, stage: str, severity: Severity, message: str, detail: str = "") -> None:
        """Добавить результат."""
        result = ValidationResult(
            stage=stage, severity=severity, message=message, detail=detail
        )
        self.results.append(result)
        if severity == Severity.ERROR:
            self.errors += 1
        elif severity == Severity.WARNING:
            self.warnings += 1
        else:
            self.passed += 1

    @classmethod
    def from_results(
        cls, strategy_name: str, results: list[ValidationResult]
    ) -> ValidationReport:
        """Создать отчёт из списка результатов."""
        report = cls(strategy_name=strategy_name)
        for r in results:
            report.add(r.stage, r.severity, r.message, r.detail)
        return report


# ═══════════════════════════════════════════════════════════════════
#  Проверки
# ═══════════════════════════════════════════════════════════════════


def validate_manifest(
    plugin: PluginInfo,
    report: ValidationReport,
) -> None:
    """Проверить manifest.yaml.

    - manifest.yaml существует
    - Можно распарсить
    - Обязательные поля (name)
    - category — известный enum
    - capabilities — известные имена
    """
    stage = "manifest"

    # 1. Существует ли файл
    if not os.path.exists(plugin.manifest_path):
        report.add(stage, Severity.ERROR, "Manifest file not found", plugin.manifest_path)
        return

    # 2. Парсинг
    try:
        descriptor = ManifestLoader.from_file(plugin.manifest_path)
    except ManifestError as e:
        report.add(stage, Severity.ERROR, "Invalid manifest", str(e))
        return
    except Exception as e:
        report.add(stage, Severity.ERROR, "Unexpected manifest parsing error", str(e))
        return

    # 3. Обязательные поля
    if not descriptor.name:
        report.add(stage, Severity.ERROR, "Missing required field: name")

    if not descriptor.category:
        report.add(stage, Severity.WARNING, "No category specified")
    elif descriptor.category not in StrategyCategory._value2member_map_:
        report.add(
            stage,
            Severity.WARNING,
            f"Unknown category '{descriptor.category}'",
            f"Known: {[c.value for c in StrategyCategory]}",
        )

    # 4. Capabilities — известны ли
    for cap in descriptor.capabilities:
        if not capability_by_name(cap):
            report.add(
                stage,
                Severity.WARNING,
                f"Unknown capability '{cap}'",
                "Strategy may fail at runtime if platform doesn't provide it",
            )

    report.add(stage, Severity.INFO, f"Manifest OK: {descriptor.name} v{descriptor.version}")


def validate_code(
    plugin: PluginInfo,
    report: ValidationReport,
) -> None:
    """Проверить entry point (strategy.py).

    - Файл существует
    - Импортируется без ошибок
    - Класс реализует analyze()
    """
    stage = "code"

    # 1. Файл существует
    if not plugin.module_path or not os.path.exists(plugin.module_path):
        report.add(stage, Severity.ERROR, "Entry point not found", str(plugin.module_path))
        return

    # 2. Импорт модуля
    try:
        spec = importlib.util.spec_from_file_location(
            f"_validation_{plugin.descriptor.name}", plugin.module_path
        )
        if spec is None or spec.loader is None:
            report.add(stage, Severity.ERROR, "Cannot load module spec", plugin.module_path)
            return

        mod = importlib.util.module_from_spec(spec)
        # Временно добавляем в sys.modules и импортируем
        sys.modules[spec.name] = mod
        spec.loader.exec_module(mod)
    except SyntaxError as e:
        report.add(stage, Severity.ERROR, "Syntax error in strategy code", str(e))
        return
    except ImportError as e:
        report.add(stage, Severity.ERROR, "Import error in strategy code", str(e))
        return
    except Exception as e:
        report.add(stage, Severity.ERROR, "Cannot execute strategy code", str(e))
        return
    finally:
        # Очистка
        if spec and spec.name in sys.modules:
            del sys.modules[spec.name]

    # 3. Ищем класс стратегии (не абстрактный)
    from core.strategy.base import BaseStrategy as PlatformBaseStrategy

    strategy_classes = []
    for name, obj in inspect.getmembers(mod):
        if inspect.isclass(obj):
            # Пропускаем абстрактные классы
            if inspect.isabstract(obj):
                continue
            # Пропускаем сам BaseStrategy если импортирован
            if obj is PlatformBaseStrategy:
                continue
            # Проверяем наличие метода analyze (основного контракта)
            if hasattr(obj, "analyze") and inspect.iscoroutinefunction(obj.analyze):
                strategy_classes.append((name, obj))

    if not strategy_classes:
        report.add(
            stage,
            Severity.ERROR,
            "No strategy class found",
            "Expected a class with async analyze() method",
        )
        return

    if len(strategy_classes) > 1:
        names = [c[0] for c in strategy_classes]
        report.add(
            stage,
            Severity.WARNING,
            f"Multiple strategy classes found: {', '.join(names)}",
            "Using first one",
        )

    class_name, cls = strategy_classes[0]
    report.add(stage, Severity.INFO, f"Strategy class '{class_name}' OK")


def validate_config(
    descriptor: StrategyDescriptor,
    report: ValidationReport,
    config_path: str | None = None,
) -> None:
    """Проверить config.yaml по схеме.

    - Загрузить config.yaml
    - Прогнать через схему (если есть)
    - Проверить типы, min/max, обязательные поля
    """
    stage = "config"

    config_schema = descriptor.config_schema

    if config_schema is None:
        report.add(stage, Severity.INFO, "No config schema defined — skipping config validation")
        return

    # Загружаем config.yaml
    user_config: dict[str, Any] = {}
    if config_path and os.path.exists(config_path):
        try:
            import yaml

            with open(config_path) as f:
                user_config = yaml.safe_load(f) or {}
        except Exception as e:
            report.add(stage, Severity.ERROR, "Cannot parse config.yaml", str(e))
            return
    else:
        report.add(stage, Severity.INFO, "No config.yaml found — using defaults from schema")

    # Валидация
    errors = validate_config_with_schema(user_config, config_schema, source="config")
    for err in errors:
        report.add(stage, Severity.ERROR, "Config validation failed", err)

    if not errors:
        report.add(stage, Severity.INFO, f"Config OK ({len(user_config)} params)")


def validate_capabilities(
    descriptor: StrategyDescriptor,
    report: ValidationReport,
) -> None:
    """Проверить capabilities стратегии.

    - Каждая capability известна платформе
    - Нет дубликатов
    """
    stage = "capabilities"

    seen: set[str] = set()
    for cap in descriptor.capabilities:
        if cap in seen:
            report.add(stage, Severity.WARNING, f"Duplicate capability '{cap}'")
            continue
        seen.add(cap)

        known = capability_by_name(cap)
        if not known:
            report.add(stage, Severity.WARNING, f"Unknown capability '{cap}'")
        else:
            report.add(stage, Severity.INFO, f"Capability '{cap}' OK")

    if not descriptor.capabilities:
        report.add(stage, Severity.INFO, "No capabilities declared")


def validate_version(
    descriptor: StrategyDescriptor,
    report: ValidationReport,
) -> None:
    """Проверить совместимость версий."""
    stage = "version"

    version_issue = PluginLoader.check_version_compatibility(descriptor)
    if version_issue:
        report.add(stage, Severity.ERROR, version_issue)
    else:
        report.add(
            stage,
            Severity.INFO,
            f"Version OK (api={descriptor.api_version}, min_core={descriptor.min_core})",
        )


# ═══════════════════════════════════════════════════════════════════
#  StrategyValidator — объединённый pipeline
# ═══════════════════════════════════════════════════════════════════


class StrategyValidator:
    """Полный pipeline валидации стратегии.

    Запускает все проверки последовательно и возвращает отчёт.
    """

    @classmethod
    def validate(
        cls,
        plugin: PluginInfo,
    ) -> ValidationReport:
        """Запустить полную валидацию стратегии.

        Args:
            plugin: PluginInfo стратегии.

        Returns:
            ValidationReport с результатами всех проверок.
        """
        name = plugin.descriptor.name if plugin.descriptor else plugin.strategy_dir
        report = ValidationReport(strategy_name=name)

        # 1. Manifest
        validate_manifest(plugin, report)

        # Если manifest не прошёл — дальше проверять нечего
        if report.errors > 0:
            return report

        descriptor = plugin.descriptor

        # 2. Version
        validate_version(descriptor, report)

        # 3. Code
        validate_code(plugin, report)

        # 4. Config
        config_dir = os.path.dirname(plugin.manifest_path) if plugin.manifest_path else None
        config_path = os.path.join(config_dir, "config.yaml") if config_dir else None
        validate_config(descriptor, report, config_path)

        # 5. Capabilities
        validate_capabilities(descriptor, report)

        return report

    @classmethod
    def validate_all(
        cls,
        plugins: list[PluginInfo],
    ) -> dict[str, ValidationReport]:
        """Валидировать все стратегии.

        Args:
            plugins: Список PluginInfo.

        Returns:
            Словарь {имя_стратегии: ValidationReport}.
        """
        return {p.descriptor.name: cls.validate(p) for p in plugins}


__all__ = [
    "Severity",
    "ValidationResult",
    "ValidationReport",
    "StrategyValidator",
    "validate_manifest",
    "validate_code",
    "validate_config",
    "validate_capabilities",
    "validate_version",
]
