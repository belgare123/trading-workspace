"""
Plugin Permissions (6.7) — система разрешений для плагинов.

Архитектура:
  - Permission — перечисление (стандартные разрешения)
  - PermissionSet — неизменяемый набор разрешений с быстрой проверкой
  - PermissionPolicy — default-deny политика
  - PluginPermissions — привязка разрешений к плагину

Default-deny: плагин не имеет ни одного разрешения, пока оно не выдано.
Интеграция в PluginRegistry:
  - register() — извлекает запрошенные permissions из manifest
  - check_permission() — быстрая проверка перед операцией
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Permission — разрешённое действие
# ═══════════════════════════════════════════════════════════════════


class Permission(str, Enum):
    """Разрешения для плагинов.

    Каждое разрешение открывает доступ к определённому типу операций.
    Default-deny: отсутствие разрешения = запрет.
    """

    MARKET_DATA = "market_data"
    SIGNALS = "signals"
    TRADES = "trades"
    FILESYSTEM_READ = "filesystem:read"
    FILESYSTEM_WRITE = "filesystem:write"
    NETWORK = "network"
    PLUGIN_MANAGEMENT = "plugin:management"
    ALL = "all"

    def __str__(self) -> str:
        return self.value


# ═══════════════════════════════════════════════════════════════════
#  PermissionSet — неизменяемый набор разрешений
# ═══════════════════════════════════════════════════════════════════


class PermissionSet:
    """Неизменяемый набор разрешений.

    Использует битовую маску для быстрой проверки O(1).
    ALL включает все известные разрешения.

    Examples:
        ps = PermissionSet(Permission.MARKET_DATA, Permission.SIGNALS)
        ps.has(Permission.MARKET_DATA)  # True
        ps.has(Permission.TRADES)       # False
    """

    _ALL_PERMISSIONS = list(Permission)

    def __init__(self, *permissions: Permission) -> None:
        self._mask = 0
        for p in permissions:
            self._add_to_mask(p)

    def _add_to_mask(self, perm: Permission) -> None:
        if perm == Permission.ALL:
            self._mask = (1 << len(self._ALL_PERMISSIONS)) - 1
        else:
            try:
                idx = self._ALL_PERMISSIONS.index(perm)
                self._mask |= 1 << idx
            except ValueError:
                pass

    @classmethod
    def all(cls) -> PermissionSet:
        """Разрешить всё."""
        return cls(Permission.ALL)

    @classmethod
    def none(cls) -> PermissionSet:
        """Ничего не разрешать (default-deny)."""
        return cls()

    @classmethod
    def from_list(cls, permissions: list[str]) -> PermissionSet:
        """Создать из списка строк (из manifest.yaml).

        Args:
            permissions: Список имён разрешений.

        Returns:
            PermissionSet.
        """
        result = cls()
        for raw in permissions:
            raw_stripped = raw.strip()
            for perm in Permission:
                if perm.value == raw_stripped or perm.name == raw_stripped:
                    result._add_to_mask(perm)
                    break
        return result

    def has(self, permission: Permission) -> bool:
        """Проверить, есть ли разрешение.

        Args:
            permission: Проверяемое разрешение.

        Returns:
            True если разрешено.
        """
        if self._mask == 0:
            return False
        if self._ALL_PERMISSIONS.index(Permission.ALL) < 64:
            if self._mask & (1 << self._ALL_PERMISSIONS.index(Permission.ALL)):
                return True
        try:
            idx = self._ALL_PERMISSIONS.index(permission)
            return bool(self._mask & (1 << idx))
        except ValueError:
            return False

    def has_any(self, *permissions: Permission) -> bool:
        """Проверить, есть ли хотя бы одно из перечисленных разрешений."""
        return any(self.has(p) for p in permissions)

    def has_all(self, *permissions: Permission) -> bool:
        """Проверить, есть ли все перечисленные разрешения."""
        return all(self.has(p) for p in permissions)

    def union(self, other: PermissionSet) -> PermissionSet:
        """Объединение двух наборов."""
        result = PermissionSet()
        result._mask = self._mask | other._mask
        return result

    def intersection(self, other: PermissionSet) -> PermissionSet:
        """Пересечение двух наборов."""
        result = PermissionSet()
        result._mask = self._mask & other._mask
        return result

    def to_list(self) -> list[Permission]:
        """Получить список разрешений (без ALL)."""
        result: list[Permission] = []
        if self._mask == 0:
            return result
        for i, perm in enumerate(self._ALL_PERMISSIONS):
            if self._mask & (1 << i):
                if perm != Permission.ALL:
                    result.append(perm)
        return result

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, PermissionSet):
            return NotImplemented
        return self._mask == other._mask

    def __repr__(self) -> str:
        perms = ", ".join(p.value for p in self.to_list())
        return f"PermissionSet({perms})" if perms else "PermissionSet(<empty>)"


# ═══════════════════════════════════════════════════════════════════
#  PluginPermissions — разрешения для конкретного плагина
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PluginPermissions:
    """Разрешения для одного плагина.

    Attributes:
        plugin:     Имя плагина.
        requested:  Какие разрешения запрошены (из manifest).
        granted:    Какие разрешения реально выданы (политикой).
    """

    plugin: str
    requested: PermissionSet = field(default_factory=PermissionSet.none)
    granted: PermissionSet = field(default_factory=PermissionSet.none)

    def can(self, permission: Permission) -> bool:
        """Проверить, разрешено ли действие.

        Args:
            permission: Проверяемое разрешение.

        Returns:
            True если разрешено.
        """
        return self.granted.has(permission)

    def grant(self, *permissions: Permission) -> None:
        """Выдать дополнительные разрешения."""
        new_set = self.granted.union(PermissionSet(*permissions))
        self.granted = new_set

    def revoke(self, *permissions: Permission) -> None:
        """Отозвать разрешения."""
        revoke_set = PermissionSet(*permissions)
        new_mask = self.granted._mask & ~revoke_set._mask
        new_set = PermissionSet()
        new_set._mask = new_mask
        self.granted = new_set

    def summary(self) -> dict[str, Any]:
        """Краткий отчёт."""
        return {
            "plugin": self.plugin,
            "requested": [p.value for p in self.requested.to_list()],
            "granted": [p.value for p in self.granted.to_list()],
        }

    def __repr__(self) -> str:
        return (
            f"PluginPermissions({self.plugin}: "
            f"requested={len(self.requested.to_list())}, "
            f"granted={len(self.granted.to_list())})"
        )


# ═══════════════════════════════════════════════════════════════════
#  PermissionPolicy — default-deny политика разрешений
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PermissionRule:
    """Правило для выдачи разрешений.

    Attributes:
        pattern:   Имя плагина или glob-шаблон (*, prefix*).
        grant:     Какие разрешения выдать.
    """

    pattern: str
    grant: PermissionSet


class PermissionPolicy:
    """Политика разрешений (default-deny).

    Определяет, какие разрешения выдаются плагинам при регистрации.
    Поддерживает:
      - Глобальные правила (glob-шаблоны)
      - Per-plugin override
      - Default-deny по умолчанию
      - Аудит выданных разрешений
    """

    def __init__(self, default_grant: PermissionSet | None = None) -> None:
        self._default_grant = default_grant or PermissionSet.none()
        self._rules: list[PermissionRule] = []
        self._overrides: dict[str, PermissionSet] = {}

    def add_rule(self, pattern: str, *permissions: Permission) -> None:
        """Добавить правило выдачи разрешений.

        Args:
            pattern:  Имя плагина или glob (*, prefix*).
            permissions: Разрешения для выдачи.
        """
        self._rules.append(PermissionRule(pattern, PermissionSet(*permissions)))

    def set_override(self, plugin: str, *permissions: Permission) -> None:
        """Установить per-plugin override.

        Args:
            plugin:     Имя плагина.
            permissions: Разрешения (пусто = ничего не разрешать).
        """
        self._overrides[plugin] = PermissionSet(*permissions)

    def resolve(self, plugin: str, requested: PermissionSet) -> PluginPermissions:
        """Определить, какие разрешения выдать плагину.

        Порядок разрешения:
          1. Если есть override — используем его.
          2. Если подходит правило — выдаём по правилу.
          3. Default — default_grant.

        Args:
            plugin:    Имя плагина.
            requested: Запрошенные разрешения.

        Returns:
            PluginPermissions с granted = пересечение resolved и requested.
        """
        # 1. Override
        if plugin in self._overrides:
            base = self._overrides[plugin]
        else:
            # 2. Правило
            base = self._default_grant
            for rule in self._rules:
                if self._match_pattern(rule.pattern, plugin):
                    base = base.union(rule.grant)

        # 3. Пересечение с запрошенными (не выдаём то, что не запрошено)
        granted = base.intersection(requested)

        logger.debug(
            "Permission resolved: %s → granted %d/%d permissions",
            plugin,
            len(granted.to_list()),
            len(requested.to_list()),
        )

        return PluginPermissions(
            plugin=plugin,
            requested=requested,
            granted=granted,
        )

    def check(self, plugin: str, permission: Permission,
              perms: PluginPermissions) -> bool:
        """Проверить, разрешено ли действие для плагина.

        Args:
            plugin:     Имя плагина.
            permission: Проверяемое разрешение.
            perms:      Текущие разрешения плагина.

        Returns:
            True если разрешено.
        """
        if not perms.can(permission):
            logger.warning(
                "Permission denied: %s needs '%s'",
                plugin, permission.value,
            )
            return False
        return True

    @staticmethod
    def _match_pattern(pattern: str, plugin: str) -> bool:
        """Проверить, подходит ли плагин под шаблон."""
        if pattern == "*":
            return True
        if pattern.endswith("*"):
            return plugin.startswith(pattern[:-1])
        return plugin == pattern

    def summary(self) -> list[dict[str, Any]]:
        """Краткий отчёт о политике."""
        return [
            {
                "pattern": rule.pattern,
                "grant": [p.value for p in rule.grant.to_list()],
            }
            for rule in self._rules
        ]

    def __repr__(self) -> str:
        return (
            f"PermissionPolicy(rules={len(self._rules)}, "
            f"overrides={len(self._overrides)})"
        )


__all__ = [
    "Permission",
    "PermissionSet",
    "PluginPermissions",
    "PermissionPolicy",
    "PermissionRule",
]
