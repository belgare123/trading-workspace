"""
Plugin Registry — реестр плагинов с управлением жизненным циклом.

Отвечает за:
  - Регистрацию плагинов из Discovery Engine
  - Управление состоянием (enable/disable)
  - Трекинг lifecycle каждого плагина
  - Сохранение registry.json

Не занимается:
  - Импортом Python-модулей (это PluginLoader)
  - Запуском/остановкой (это StrategyEngine)
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from core.strategy.dependency import (
    DependencyError,
    DependencyResolver,
    ResolveReport,
)
from core.strategy.discovery import DiscoverySource, PluginDiscovery
from core.strategy.feature_graph import (
    FeatureConflict,
    FeatureConflictError,
    FeatureDeclaration,
    FeatureGraph,
    FeatureGraphError,
    FeatureMissingError,
    FeatureResolution,
)
from core.strategy.health_monitor import PluginHealthMonitor, PluginHealthSnapshot
from core.strategy.lifecycle import InvalidTransitionError, StatusTransition, StrategyState
from core.strategy.permissions import Permission, PermissionPolicy, PermissionSet, PluginPermissions
from core.strategy.plugin_api import PluginAPI, PluginAPIFactory
from core.strategy.repository import PluginRepository

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  PluginRecord — полная запись о плагине в реестре
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PluginRecord:
    """Запись о плагине в PluginRegistry.

    Содержит:
      - Метаданные из PluginDiscovery
      - Текущее состояние lifecycle
      - Причина отказа (если FAILED)
      - Разрешён (enabled) или нет
      - Временные метки
    """

    # ── Идентификация ──
    name: str
    version: str

    # ── Discovery info ──
    discovery: PluginDiscovery

    # ── Lifecycle ──
    state: StrategyState = StrategyState.DISCOVERED
    fail_reason: str | None = None

    # ── Enable/Disable ──
    enabled: bool = True
    disabled_reason: str | None = None

    # ── Timestamps ──
    discovered_at: float = 0.0
    installed_at: float = 0.0
    started_at: float | None = None
    stopped_at: float | None = None
    failed_at: float | None = None

    def __post_init__(self) -> None:
        if self.discovered_at == 0.0:
            import time
            self.discovered_at = time.time()

    @property
    def can_start(self) -> bool:
        """Можно запустить стратегию."""
        if not self.enabled:
            return False
        return self.state in (
            StrategyState.INSTALLED,
            StrategyState.INITIALIZED,
            StrategyState.STOPPED,
        )

    @property
    def can_stop(self) -> bool:
        """Можно остановить."""
        return self.state.is_active

    @property
    def can_remove(self) -> bool:
        """Можно удалить из реестра."""
        return self.state in (
            StrategyState.STOPPED,
            StrategyState.FAILED,
            StrategyState.INSTALLED,
        )

    @property
    def is_disabled(self) -> bool:
        """Плагин отключён (не будет запущен)."""
        return not self.enabled

    @property
    def uptime(self) -> float:
        """Время работы в секундах (с момента RUNNING)."""
        if self.started_at is None:
            return 0.0
        import time
        if self.stopped_at is not None:
            return self.stopped_at - self.started_at
        return time.time() - self.started_at

    def transition(self, to_state: StrategyState) -> None:
        """Безопасный переход состояния.

        Args:
            to_state: Целевое состояние.

        Raises:
            InvalidTransitionError: Если переход невалиден.
        """
        StatusTransition.validate(self.name, self.state, to_state)
        old = self.state
        self.state = to_state

        # Обновляем временные метки
        import time
        now = time.time()
        if to_state == StrategyState.INSTALLED:
            self.installed_at = now
        elif to_state == StrategyState.RUNNING:
            self.started_at = now
            self.stopped_at = None
        elif to_state in (StrategyState.STOPPED, StrategyState.FAILED):
            self.stopped_at = now
        if to_state == StrategyState.FAILED:
            self.failed_at = now

        logger.info(
            "Plugin '%s': %s → %s",
            self.name,
            old.value,
            to_state.value,
        )

    def to_dict(self) -> dict[str, Any]:
        """Сериализация для Dashboard / registry.json."""
        return {
            "name": self.name,
            "version": self.version,
            "state": self.state.value,
            "enabled": self.enabled,
            "disabled_reason": self.disabled_reason,
            "fail_reason": self.fail_reason,
            "can_start": self.can_start,
            "can_stop": self.can_stop,
            "can_remove": self.can_remove,
            "uptime": round(self.uptime, 1),
            "timestamps": {
                "discovered": self.discovered_at,
                "installed": self.installed_at,
                "started": self.started_at,
                "stopped": self.stopped_at,
                "failed": self.failed_at,
            },
            "discovery": self.discovery.to_dict(),
        }

    def __repr__(self) -> str:
        status = "enabled" if self.enabled else "disabled"
        return (
            f"PluginRecord({self.name} v{self.version}, "
            f"{self.state.value}, {status})"
        )


# ═══════════════════════════════════════════════════════════════════
#  PluginRegistry — реестр + lifecycle manager
# ═══════════════════════════════════════════════════════════════════


class PluginRegistryError(Exception):
    """Ошибка реестра плагинов."""

    pass


class PluginRegistry:
    """Реестр плагинов с управлением жизненным циклом.

    Пример:
        registry = PluginRegistry(registry_path='plugins/registry.json')

        # Регистрация из Discovery
        for plugin in await engine.discover():
            registry.register(plugin)

        # Enable/Disable
        registry.set_enabled('Momentum', False)
        registry.set_enabled('ICT', True)

        # State transitions
        registry.install('Momentum')
        registry.start('Momentum')
        registry.stop('Momentum')

        # Сохранение
        registry.save()
    """

    def __init__(
        self,
        registry_path: str | None = None,
        resolver: DependencyResolver | None = None,
        feature_graph: FeatureGraph | None = None,
        health_monitor: PluginHealthMonitor | None = None,
        repository: PluginRepository | None = None,
        permission_policy: PermissionPolicy | None = None,
    ) -> None:
        self._plugins: dict[str, PluginRecord] = {}
        self._registry_path = registry_path
        self._enabled_config: dict[str, bool] = {}
        self._resolver = resolver or DependencyResolver()
        self._feature_graph = feature_graph or FeatureGraph()
        self._health_monitor = health_monitor or PluginHealthMonitor()
        self._repository = repository or PluginRepository()
        self._permissions: dict[str, PluginPermissions] = {}
        self._permission_policy = permission_policy or PermissionPolicy()
        self._api_factory = PluginAPIFactory(
            permission_checker=self._check_permission,
            health_monitor=self._health_monitor,
        )

        # Загружаем enable/disable конфиг
        if registry_path:
            self._load_config()

    # ── Registration ──

    def register(self, discovery: PluginDiscovery) -> PluginRecord:
        """Зарегистрировать обнаруженный плагин.

        Если плагин уже существует — обновляет метаданные,
        но сохраняет состояние lifecycle и enable/disable.

        Args:
            discovery: Результат Discovery Engine.

        Returns:
            PluginRecord (новый или обновлённый).

        Raises:
            PluginRegistryError: Если плагин в терминальном состоянии.
        """
        name = discovery.name

        if name in self._plugins:
            existing = self._plugins[name]
            if existing.state.is_terminal:
                raise PluginRegistryError(
                    f"Cannot re-register '{name}': it's in terminal state "
                    f"({existing.state.value}). Remove it first."
                )
            # Обновляем метаданные, сохраняем lifecycle
            existing.discovery = discovery
            existing.version = discovery.version
            # Применяем enable/disable из конфига
            existing.enabled = self._enabled_config.get(name, discovery.enabled)
            logger.debug("Updated plugin record: %s v%s", name, discovery.version)
            return existing

        # Применяем enable/disable из конфига
        enabled = self._enabled_config.get(name, discovery.enabled)

        record = PluginRecord(
            name=name,
            version=discovery.version,
            discovery=discovery,
            state=StrategyState.DISCOVERED,
            enabled=enabled,
        )
        self._plugins[name] = record

        # Добавляем в resolver
        self._feed_resolver(record)
        # Добавляем в feature graph
        self._feed_feature_graph(record)
        # Добавляем в health monitor
        self._health_monitor.register(record.name)
        # Разрешаем permissions
        self._resolve_plugin_permissions(record)

        logger.info("Registered plugin: %s v%s (%s)", name, discovery.version,
                     "enabled" if enabled else "disabled")
        return record

    def unregister(self, name: str) -> None:
        """Удалить плагин из реестра.

        Args:
            name: Имя плагина.

        Raises:
            PluginRegistryError: Если плагин не найден или активен.
        """
        if name not in self._plugins:
            raise PluginRegistryError(f"Plugin '{name}' not found")

        record = self._plugins[name]
        if record.state.is_active:
            raise PluginRegistryError(
                f"Cannot remove '{name}': it's still running. Stop it first."
            )

        if record.state not in (StrategyState.STOPPED, StrategyState.FAILED,
                                 StrategyState.INSTALLED):
            raise PluginRegistryError(
                f"Cannot remove '{name}' from state {record.state.value}. "
                f"Stop or shutdown first."
            )

        # Terminal transition
        record.transition(StrategyState.REMOVED)
        del self._plugins[name]
        # Удаляем из feature graph
        self._feature_graph.remove_plugin(name)
        # Удаляем из health monitor
        self._health_monitor.unregister(name)
        # Удаляем permissions
        self._permissions.pop(name, None)
        logger.info("Removed plugin: %s", name)

    # ── State transitions ──

    def transition(self, name: str, to_state: StrategyState) -> PluginRecord:
        """Перевести плагин в указанное состояние.

        Args:
            name: Имя плагина.
            to_state: Целевое состояние.

        Returns:
            PluginRecord после перехода.
        """
        record = self._get_active(name)
        record.transition(to_state)
        return record

    def install(self, name: str) -> PluginRecord:
        """VALIDATED → INSTALLED."""
        return self.transition(name, StrategyState.INSTALLED)

    def initialize(self, name: str) -> PluginRecord:
        """INSTALLED → INITIALIZED."""
        return self.transition(name, StrategyState.INITIALIZED)

    def start(self, name: str) -> PluginRecord:
        """INITIALIZED/STOPPED → RUNNING."""
        return self.transition(name, StrategyState.RUNNING)

    def pause(self, name: str) -> PluginRecord:
        """RUNNING → PAUSED."""
        return self.transition(name, StrategyState.PAUSED)

    def resume(self, name: str) -> PluginRecord:
        """PAUSED → RUNNING."""
        return self.transition(name, StrategyState.RUNNING)

    def stop(self, name: str) -> PluginRecord:
        """RUNNING/PAUSED → STOPPED."""
        return self.transition(name, StrategyState.STOPPED)

    def fail(self, name: str, reason: str) -> PluginRecord:
        """Любое состояние → FAILED."""
        record = self._get(name)
        record.fail_reason = reason
        record.transition(StrategyState.FAILED)
        return record

    # ── Enable / Disable ──

    def set_enabled(self, name: str, enabled: bool, reason: str | None = None) -> PluginRecord:
        """Включить/отключить плагин без удаления.

        Disabled-плагин:
          - Остаётся в реестре
          - Не стартует при auto_start
          - Может быть переведён в STOPPED если был RUNNING

        Args:
            name:    Имя плагина.
            enabled: True — включить, False — отключить.
            reason:  Причина отключения (опционально).

        Returns:
            PluginRecord с обновлённым статусом.
        """
        record = self._get(name)
        record.enabled = enabled
        record.disabled_reason = reason

        # Сохраняем в конфиг
        self._enabled_config[name] = enabled

        if enabled:
            logger.info("Enabled plugin: %s", name)
        else:
            logger.info("Disabled plugin: %s (reason: %s)", name, reason or "manual")

        return record

    def is_enabled(self, name: str) -> bool:
        """Проверить, включён ли плагин."""
        record = self._get(name)
        return record.enabled

    def get_enabled_plugins(self) -> list[PluginRecord]:
        """Получить все включённые плагины."""
        return [p for p in self._plugins.values() if p.enabled]

    def get_disabled_plugins(self) -> list[PluginRecord]:
        """Получить все отключённые плагины."""
        return [p for p in self._plugins.values() if not p.enabled]

    # ── Query ──

    def get(self, name: str) -> PluginRecord | None:
        """Получить запись плагина по имени."""
        return self._plugins.get(name)

    def _get(self, name: str) -> PluginRecord:
        """Получить запись с проверкой существования."""
        record = self._plugins.get(name)
        if record is None:
            raise PluginRegistryError(f"Plugin '{name}' not found in registry")
        return record

    def _get_active(self, name: str) -> PluginRecord:
        """Получить запись с проверкой, что плагин не в terminal state."""
        record = self._get(name)
        if record.state.is_terminal:
            raise PluginRegistryError(
                f"Plugin '{name}' is in terminal state ({record.state.value})"
            )
        return record

    def list(self) -> list[PluginRecord]:
        """Список всех зарегистрированных плагинов."""
        return list(self._plugins.values())

    def by_state(self, state: StrategyState) -> list[PluginRecord]:
        """Получить плагины в определённом состоянии."""
        return [p for p in self._plugins.values() if p.state == state]

    def by_source(self, source_label: str) -> list[PluginRecord]:
        """Получить плагины из определённого источника."""
        return [
            p for p in self._plugins.values()
            if p.discovery.source.label == source_label
        ]

    @property
    def count(self) -> int:
        return len(self._plugins)

    @property
    def active_count(self) -> int:
        """Количество активных плагинов (RUNNING или PAUSED)."""
        return sum(1 for p in self._plugins.values() if p.state.is_active)

    # ── Dependency Resolution ──

    @property
    def dependency_resolver(self) -> DependencyResolver:
        """DependencyResolver для этого реестра."""
        return self._resolver

    # ── Feature Graph ──

    @property
    def feature_graph(self) -> FeatureGraph:
        """FeatureGraph для этого реестра."""
        return self._feature_graph

    # ── Health Monitor ──

    @property
    def health_monitor(self) -> PluginHealthMonitor:
        """PluginHealthMonitor для этого реестра."""
        return self._health_monitor

    # ── Repository ──

    @property
    def repository(self) -> PluginRepository:
        """PluginRepository для этого реестра."""
        return self._repository

    # ── Permissions ──

    @property
    def permission_policy(self) -> PermissionPolicy:
        """PermissionPolicy для этого реестра."""
        return self._permission_policy

    @permission_policy.setter
    def permission_policy(self, policy: PermissionPolicy) -> None:
        """Сменить политику и переразрешить permissions всех плагинов."""
        self._permission_policy = policy
        self._api_factory.set_permission_checker(self._check_permission)
        self._recompute_all_permissions()

    @property
    def plugin_permissions(self) -> dict[str, PluginPermissions]:
        """Текущие permissions всех плагинов (только для чтения)."""
        return dict(self._permissions)

    def get_plugin_permissions(self, name: str) -> PluginPermissions | None:
        """Получить permissions конкретного плагина.

        Args:
            name: Имя плагина.

        Returns:
            PluginPermissions или None, если не найден.
        """
        return self._permissions.get(name)

    def grant_permission(self, name: str, *permissions: Permission) -> None:
        """Выдать плагину дополнительные разрешения.

        Args:
            name:        Имя плагина.
            permissions: Разрешения для выдачи.
        """
        perms = self._permissions.get(name)
        if perms is None:
            raise PluginRegistryError(
                f"Cannot grant permissions: plugin '{name}' not registered"
            )
        perms.grant(*permissions)
        logger.info("Granted %s to plugin %s", permissions, name)

    def revoke_permission(self, name: str, *permissions: Permission) -> None:
        """Отозвать разрешения у плагина.

        Args:
            name:        Имя плагина.
            permissions: Разрешения для отзыва.
        """
        perms = self._permissions.get(name)
        if perms is None:
            raise PluginRegistryError(
                f"Cannot revoke permissions: plugin '{name}' not registered"
            )
        perms.revoke(*permissions)
        logger.info("Revoked %s from plugin %s", permissions, name)

    # ── Plugin API ──

    @property
    def api_factory(self) -> PluginAPIFactory:
        """PluginAPIFactory для создания API для плагинов."""
        return self._api_factory

    def get_api(self, name: str) -> PluginAPI:
        """Получить PluginAPI для плагина.

        Args:
            name: Имя плагина.

        Returns:
            PluginAPI.
        """
        return self._api_factory.for_plugin(name)

    # ── Permission resolution ──

    def _resolve_plugin_permissions(self, record: PluginRecord) -> None:
        """Разрешить permissions для плагина.

        Извлекает запрошенные permissions из manifest,
        пропускает через политику и сохраняет результат.
        """
        discovery = record.discovery
        manifest = discovery.manifest

        # Запрошенные permissions из manifest.descriptor.profile.permissions
        requested = PermissionSet.none()
        if manifest and manifest.descriptor and manifest.descriptor.profile:
            raw = getattr(manifest.descriptor.profile, 'permissions', [])
            if raw:
                requested = PermissionSet.from_list(raw)

        # Разрешаем через политику
        resolved = self._permission_policy.resolve(record.name, requested)
        self._permissions[record.name] = resolved

    def _recompute_all_permissions(self) -> None:
        """Переразрешить permissions для всех плагинов."""
        for record in self._plugins.values():
            self._resolve_plugin_permissions(record)

    def _check_permission(self, plugin: str, permission_name: str) -> bool:
        """Проверка разрешения (коллбэк для PluginAPI).

        Args:
            plugin:         Имя плагина.
            permission_name: Имя разрешения.

        Returns:
            True если разрешено.
        """
        perms = self._permissions.get(plugin)
        if perms is None:
            return False
        try:
            perm = Permission(permission_name)
            return perms.can(perm)
        except ValueError:
            return False

    def _feed_feature_graph(self, record: PluginRecord) -> None:
        """Добавить плагин в FeatureGraph."""
        discovery = record.discovery
        manifest = discovery.manifest

        # Фичи из manifest.descriptor.capabilities → provides
        provides: set[str] = set()
        if manifest and manifest.descriptor:
            provides = {
                cap.name if hasattr(cap, 'name') else str(cap)
                for cap in (manifest.descriptor.capabilities or [])
            }

        # Фичи из manifest.dependencies → requires
        requires: set[str] = set()
        if discovery.dependencies:
            requires = {d.name for d in discovery.dependencies}

        self._feature_graph.declare_plugin(
            record.name,
            provides=provides or None,
            requires=requires or None,
        )

    def resolve_features(
        self,
        required: set[str] | None = None,
        prefer: dict[str, str] | None = None,
    ) -> FeatureResolution:
        """Разрешить фичи для всех зарегистрированных плагинов.

        Args:
            required: Набор обязательных фич (если None — все известные).
            prefer:   Предпочтения при конфликте {feature: plugin_name}.

        Returns:
            FeatureResolution.
        """
        # Перестраиваем граф из текущего состояния реестра
        self._feature_graph.clear()
        for record in self._plugins.values():
            self._feed_feature_graph(record)

        return self._feature_graph.resolve(
            required=required,
            prefer=prefer,
        )

    def _feed_resolver(self, record: PluginRecord) -> None:
        """Добавить плагин в DependencyResolver."""
        deps = [
            (d.name, d.version, d.optional)
            for d in record.discovery.dependencies
        ]
        self._resolver.add_plugin(record.name, record.version, deps)

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
            ResolveReport с результатом.
        """
        # Перестраиваем resolver из текущего состояния реестра
        self._resolver.clear()
        for record in self._plugins.values():
            self._feed_resolver(record)

        return self._resolver.resolve(
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
        record = self._get(name)

        self._resolver.clear()
        # Добавляем все плагины (нужны для resolution зависимостей)
        for rec in self._plugins.values():
            self._feed_resolver(rec)

        # Проверяем только один
        return self._resolver.resolve(
            check_versions=check_versions,
            strict=strict,
        )

    def startup_order(self) -> list[str]:
        """Топологический порядок запуска.

        Returns:
            Список имён плагинов в порядке запуска (зависимости первыми).

        Raises:
            PluginRegistryError: Если есть циклические зависимости.
        """
        report = self.resolve_dependencies()
        if not report.success:
            errors_str = "; ".join(str(e) for e in report.errors)
            raise PluginRegistryError(
                f"Cannot determine startup order: {errors_str}"
            )
        return report.start_order

    def check_dependencies(
        self,
        name: str,
    ) -> tuple[bool, list[str]]:
        """Проверить, удовлетворены ли зависимости плагина.

        Args:
            name: Имя плагина.

        Returns:
            (ok, reasons) — ok=True если все зависимости удовлетворены.
        """
        report = self.resolve_plugin(name)
        if report.success:
            return True, []

        reasons = [str(e) for e in report.errors]
        return False, reasons

    # ── Persistence ──

    def _load_config(self) -> None:
        """Загрузить конфиг enable/disable из registry.json."""
        if not self._registry_path:
            return
        path = Path(self._registry_path)
        if not path.exists():
            return
        try:
            with open(path) as f:
                data = json.load(f)
            self._enabled_config = data.get("enabled", {})
            logger.debug(
                "Loaded registry config: %d entries",
                len(self._enabled_config),
            )
        except Exception as e:
            logger.warning("Cannot load registry config: %s", e)

    def save(self) -> None:
        """Сохранить registry.json с enable/disable конфигом."""
        if not self._registry_path:
            return
        path = Path(self._registry_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "version": "1.0",
            "updated_at": datetime.utcnow().isoformat(),
            "plugin_count": self.count,
            "enabled": self._enabled_config,
        }
        try:
            with open(path, "w") as f:
                json.dump(data, f, indent=2)
            logger.debug("Saved registry config to %s", path)
        except Exception as e:
            logger.error("Cannot save registry config: %s", e)

    def summary(self) -> str:
        """Краткий отчёт о состоянии реестра."""
        lines = [
            f"PluginRegistry: {self.count} plugins, "
            f"{self.active_count} active",
        ]
        for record in sorted(self._plugins.values(), key=lambda r: r.name):
            status = "✓" if record.enabled else "✗"
            lines.append(
                f"  [{status}] {record.name:20s} {record.state.value:12s}"
                f" v{record.version}"
            )
        return "\n".join(lines)
