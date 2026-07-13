"""
Plugin API (6.8) — публичный контракт между платформой и плагинами.

Архитектура:
  - PluginAPI — фасад с типизированными методами
  - Versioned API — каждая версия интерфейса
  - Permission-gated доступ к данным
  - Call tracking для аудита и sandbox

Плагин взаимодействует с платформой ТОЛЬКО через PluginAPI.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from core.strategy.health_monitor import PluginHealth, PluginHealthMonitor, PluginHealthResult
from core.strategy.lifecycle import StrategyState

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  PluginAPIVersion — версия API
# ═══════════════════════════════════════════════════════════════════


class PluginAPIVersion(str, Enum):
    """Версия PluginAPI.

    Major — несовместимые изменения.
    Minor — обратно-совместимые добавления.
    """

    V1 = "1.0"
    V2 = "2.0"

    def __str__(self) -> str:
        return self.value


# ═══════════════════════════════════════════════════════════════════
#  APICallRecord — запись вызова API
# ═══════════════════════════════════════════════════════════════════


@dataclass
class APICallRecord:
    """Одна запись вызова API.

    Attributes:
        method:     Имя вызванного метода.
        plugin:     Имя плагина.
        duration:   Длительность в секундах.
        timestamp:  Временная метка вызова.
    """

    method: str
    plugin: str
    duration: float
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "method": self.method,
            "plugin": self.plugin,
            "duration": round(self.duration, 4),
            "timestamp": self.timestamp,
        }


# ═══════════════════════════════════════════════════════════════════
#  PermissionChecker — коллбэк для проверки разрешений
# ═══════════════════════════════════════════════════════════════════

PermissionChecker = Callable[[str, str], bool]
"""Проверка разрешения: (plugin_name, permission_name) → bool."""


# ═══════════════════════════════════════════════════════════════════
#  PluginAPI — типизированный фасад для плагинов
# ═══════════════════════════════════════════════════════════════════


class PluginAPI:
    """Публичный API для плагинов.

    Предоставляет плагину доступ к данным и действиям платформы.
    Каждый вызов проверяет permissions через PermissionChecker.
    """

    def __init__(
        self,
        plugin: str,
        api_version: PluginAPIVersion = PluginAPIVersion.V2,
        permission_checker: PermissionChecker | None = None,
        health_monitor: PluginHealthMonitor | None = None,
    ) -> None:
        self._plugin = plugin
        self._api_version = api_version
        self._check_perm = permission_checker
        self._health = health_monitor
        self._call_log: list[APICallRecord] = []

    # ── API Version ──

    @property
    def api_version(self) -> str:
        """Версия API."""
        return self._api_version.value

    @property
    def plugin_name(self) -> str:
        """Имя плагина."""
        return self._plugin

    # ── Permission Check ──

    def _require(self, permission: str, method: str) -> bool:
        """Проверить разрешение; вернуть True если разрешено."""
        if self._check_perm is None:
            return True
        allowed = self._check_perm(self._plugin, permission)
        if not allowed:
            logger.warning(
                "Plugin %s: permission denied for '%s' (method: %s)",
                self._plugin, permission, method,
            )
        return allowed

    def _track(self, method: str) -> None:
        """Записать вызов (для sandbox)."""
        self._call_log.append(APICallRecord(
            method=method,
            plugin=self._plugin,
            duration=0.0,
        ))

    @property
    def call_count(self) -> int:
        """Количество вызовов API с момента создания."""
        return len(self._call_log)

    @property
    def call_log(self) -> list[APICallRecord]:
        """Лог вызовов API."""
        return list(self._call_log)

    def clear_call_log(self) -> None:
        """Очистить лог вызовов."""
        self._call_log.clear()

    # ── Data API (permission-gated) ──

    # Эти методы будут вызваны плагином. Они делегируют в
    # нижележащий контекст (StrategyContext / FeatureAPI / MarketAPI).

    def can_read_market_data(self) -> bool:
        """Проверить доступ к рыночным данным."""
        return self._require("market_data", "can_read_market_data")

    def can_send_signals(self) -> bool:
        """Проверить возможность отправлять сигналы."""
        return self._require("signals", "can_send_signals")

    def can_trade(self) -> bool:
        """Проверить возможность торговать."""
        return self._require("trades", "can_trade")

    def can_read_filesystem(self) -> bool:
        """Проверить доступ к чтению ФС."""
        return self._require("filesystem:read", "can_read_filesystem")

    def can_write_filesystem(self) -> bool:
        """Проверить доступ к записи в ФС."""
        return self._require("filesystem:write", "can_write_filesystem")

    def can_network(self) -> bool:
        """Проверить доступ к сети."""
        return self._require("network", "can_network")

    # ── Health ──

    def report_health(
        self,
        status: PluginHealth,
        detail: str = "",
    ) -> PluginHealthResult | None:
        """Сообщить о своём здоровье.

        Args:
            status: HEALTHY, DEGRADED или UNHEALTHY.
            detail: Детали (опционально).

        Returns:
            PluginHealthResult если health_monitor подключён.
        """
        self._track("report_health")
        if self._health is None:
            return None
        # Используем report_status (синхронный метод для self-report)
        return self._health.report_status(self._plugin, status, detail)

    # ── Audit ──

    def summary(self) -> dict[str, Any]:
        """Краткий отчёт о состоянии API для этого плагина."""
        return {
            "plugin": self._plugin,
            "api_version": self.api_version,
            "call_count": self.call_count,
            "permissions": {
                "market_data": self.can_read_market_data(),
                "signals": self.can_send_signals(),
                "trades": self.can_trade(),
                "filesystem:read": self.can_read_filesystem(),
                "filesystem:write": self.can_write_filesystem(),
                "network": self.can_network(),
            },
        }

    def __repr__(self) -> str:
        return (
            f"PluginAPI({self._plugin}, "
            f"v{self._api_version.value}, "
            f"calls={self.call_count})"
        )


# ═══════════════════════════════════════════════════════════════════
#  PluginAPIFactory — создание API для плагинов
# ═══════════════════════════════════════════════════════════════════


class PluginAPIFactory:
    """Фабрика API для плагинов.

    Создаёт экземпляры PluginAPI с правильными permission checker'ами.
    Позволяет пересоздавать API при изменении политик.
    """

    def __init__(
        self,
        api_version: PluginAPIVersion = PluginAPIVersion.V2,
        permission_checker: PermissionChecker | None = None,
        health_monitor: PluginHealthMonitor | None = None,
    ) -> None:
        self._api_version = api_version
        self._checker = permission_checker
        self._health = health_monitor
        self._instances: dict[str, PluginAPI] = {}

    def set_permission_checker(self, checker: PermissionChecker | None) -> None:
        """Обновить permission checker."""
        self._checker = checker
        # Сбросить кэш — при следующем запросе создадутся новые инстансы
        self._instances.clear()

    def set_health_monitor(self, monitor: PluginHealthMonitor | None) -> None:
        """Обновить health monitor."""
        self._health = monitor
        self._instances.clear()

    def for_plugin(self, plugin: str) -> PluginAPI:
        """Получить или создать PluginAPI для плагина.

        Args:
            plugin: Имя плагина.

        Returns:
            PluginAPI.
        """
        if plugin not in self._instances:
            self._instances[plugin] = PluginAPI(
                plugin=plugin,
                api_version=self._api_version,
                permission_checker=self._checker,
                health_monitor=self._health,
            )
        return self._instances[plugin]

    def clear(self) -> None:
        """Очистить все созданные API."""
        self._instances.clear()

    @property
    def active_count(self) -> int:
        return len(self._instances)


__all__ = [
    "PluginAPIVersion",
    "PluginAPI",
    "PluginAPIFactory",
    "APICallRecord",
    "PermissionChecker",
]
