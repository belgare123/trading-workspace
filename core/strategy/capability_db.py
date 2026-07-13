"""
Capability Database — реестр возможностей с метаданными.

Каждый признак (capability) — не просто строка "ema", а объект с:
  - Provider — кто вычисляет
  - Dependencies — от чего зависит
  - TTL — время жизни кэша
  - Cost — вычислительная стоимость
  - Cache — можно ли кэшировать

Feature Graph (Phase 7) будет строить DAG вычислений на основе
этого реестра.
"""

from __future__ import annotations

import enum
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  CapabilityCost — вычислительная стоимость
# ═══════════════════════════════════════════════════════════════════


class CapabilityCost(int, enum.Enum):
    """Вычислительная стоимость capability.

    Используется Capacity-планировщиком для ограничения
    количества тяжёлых признаков в одном анализе.
    """

    LIGHT = 1  # Простой индикатор (EMA, RSI, SMA)
    MEDIUM = 2  # Агрегация (Volume Profile, VWAP, ATR)
    HEAVY = 5  # Дорогой (OrderBook, KLines → patterns)
    EXTREME = 10  # AI/ML (sentiment, whale detection)

    @classmethod
    def from_string(cls, s: str) -> CapabilityCost:
        mapping = {
            "light": cls.LIGHT,
            "medium": cls.MEDIUM,
            "heavy": cls.HEAVY,
            "extreme": cls.EXTREME,
        }
        return mapping.get(s.strip().lower(), cls.MEDIUM)


# ═══════════════════════════════════════════════════════════════════
#  CapabilityInfo — полное мета-описание capability
# ═══════════════════════════════════════════════════════════════════


@dataclass
class CapabilityInfo:
    """Мета-описание capability с operational metadata.

    Attributes:
        name:          Уникальное имя (как в manifest.yaml).
        description:   Человеко-читаемое описание.
        provider:      Кто вычисляет (\"core\", \"plugin:ta\", \"plugin:ai\").
        dependencies:  Имена capability, от которых зависит.
        ttl:           Время жизни кэша (сек). 0 = не кэшировать.
        cost:          Вычислительная стоимость.
        cache:         True — результат можно кэшировать.
        timeout:       Максимальное время вычисления (сек).
        version:       Версия реализации.
        deprecated:    True — помечена к удалению.
        replaces:      Имя deprecated-аналога (если заменяет).
        group:         Группа (\"technical\", \"volume\", \"ai\").
    """

    name: str
    description: str = ""
    provider: str = "core"
    dependencies: list[str] = field(default_factory=list)
    ttl: float = 60.0
    cost: CapabilityCost = CapabilityCost.LIGHT
    cache: bool = True
    timeout: float = 5.0
    version: str = "1.0"
    deprecated: bool = False
    replaces: str | None = None
    group: str = "technical"

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "provider": self.provider,
            "dependencies": list(self.dependencies),
            "ttl": self.ttl,
            "cost": self.cost.value,
            "cache": self.cache,
            "timeout": self.timeout,
            "version": self.version,
            "deprecated": self.deprecated,
            "replaces": self.replaces,
            "group": self.group,
        }

    def __repr__(self) -> str:
        return (
            f"CapabilityInfo({self.name!r}, "
            f"cost={self.cost.name}, "
            f"ttl={self.ttl}s, "
            f"deps={len(self.dependencies)})"
        )


# ═══════════════════════════════════════════════════════════════════
#  Built-in registry
# ═══════════════════════════════════════════════════════════════════

# Словарь встроенных capability с полными метаданными.
# Используется CapabilityRegistry для инициализации.
_BUILTIN_CAPABILITY_DB: dict[str, dict[str, Any]] = {
    "candles": {
        "description": "OHLCV свечи",
        "provider": "core",
        "ttl": 5.0,
        "cost": "light",
        "cache": True,
        "timeout": 2.0,
        "group": "data",
        "dependencies": [],
    },
    "ema": {
        "description": "Exponential Moving Average",
        "provider": "core",
        "ttl": 5.0,
        "cost": "light",
        "cache": True,
        "timeout": 1.0,
        "group": "technical",
        "dependencies": ["candles"],
    },
    "sma": {
        "description": "Simple Moving Average",
        "provider": "core",
        "ttl": 5.0,
        "cost": "light",
        "cache": True,
        "timeout": 1.0,
        "group": "technical",
        "dependencies": ["candles"],
    },
    "rsi": {
        "description": "Relative Strength Index",
        "provider": "core",
        "ttl": 5.0,
        "cost": "light",
        "cache": True,
        "timeout": 1.0,
        "group": "technical",
        "dependencies": ["candles"],
    },
    "atr": {
        "description": "Average True Range",
        "provider": "core",
        "ttl": 5.0,
        "cost": "light",
        "cache": True,
        "timeout": 1.0,
        "group": "technical",
        "dependencies": ["candles"],
    },
    "macd": {
        "description": "Moving Average Convergence Divergence",
        "provider": "core",
        "ttl": 5.0,
        "cost": "light",
        "cache": True,
        "timeout": 1.0,
        "group": "technical",
        "dependencies": ["candles"],
    },
    "bollinger": {
        "description": "Bollinger Bands",
        "provider": "core",
        "ttl": 5.0,
        "cost": "medium",
        "cache": True,
        "timeout": 1.0,
        "group": "technical",
        "dependencies": ["sma", "candles"],
    },
    "volume": {
        "description": "Анализ объёмов",
        "provider": "core",
        "ttl": 5.0,
        "cost": "light",
        "cache": True,
        "timeout": 2.0,
        "group": "volume",
        "dependencies": ["candles"],
    },
    "orderbook": {
        "description": "Стакан заявок",
        "provider": "core",
        "ttl": 0.5,
        "cost": "heavy",
        "cache": False,
        "timeout": 1.0,
        "group": "market",
        "dependencies": [],
    },
    "trades": {
        "description": "Последние сделки (tape)",
        "provider": "core",
        "ttl": 0.5,
        "cost": "medium",
        "cache": False,
        "timeout": 1.0,
        "group": "market",
        "dependencies": [],
    },
    "whales": {
        "description": "Обнаружение китов",
        "provider": "plugin:ai",
        "ttl": 30.0,
        "cost": "heavy",
        "cache": True,
        "timeout": 10.0,
        "group": "ai",
        "dependencies": ["trades"],
    },
    "sentiment": {
        "description": "Sentiment score",
        "provider": "plugin:ai",
        "ttl": 120.0,
        "cost": "extreme",
        "cache": True,
        "timeout": 30.0,
        "group": "ai",
        "dependencies": [],
    },
    "funding": {
        "description": "Funding rate",
        "provider": "core",
        "ttl": 60.0,
        "cost": "light",
        "cache": True,
        "timeout": 2.0,
        "group": "market",
        "dependencies": [],
    },
    "oi": {
        "description": "Open interest",
        "provider": "core",
        "ttl": 10.0,
        "cost": "medium",
        "cache": True,
        "timeout": 5.0,
        "group": "market",
        "dependencies": [],
    },
    "liquidations": {
        "description": "Ликвидации",
        "provider": "core",
        "ttl": 2.0,
        "cost": "medium",
        "cache": True,
        "timeout": 3.0,
        "group": "market",
        "dependencies": [],
    },
}


# ═══════════════════════════════════════════════════════════════════
#  CapabilityRegistry — реестр capability с operational metadata
# ═══════════════════════════════════════════════════════════════════


class DependencyError(Exception):
    """Ошибка разрешения зависимостей capability."""

    pass


class CapabilityRegistry:
    """Реестр всех доступных capability с полными метаданными.

    Это Source of Truth для FeatureGraph (Phase 7):
    - Какие capability существуют
    - От чего они зависят
    - Сколько стоят
    - Можно ли кэшировать

    Используется Strategy Engine для:
    - Проверки, что все необходимые признаки доступны
    - Построения оптимального порядка вычислений
    - Capacity-планирования (не больше N тяжёлых признаков за раз)
    """

    def __init__(self) -> None:
        self._capabilities: dict[str, CapabilityInfo] = {}
        self._providers: dict[str, list[str]] = {}  # provider → [capability names]
        self._frozen: bool = False

    # ── Registration ──

    def register(self, info: CapabilityInfo) -> None:
        """Зарегистрировать capability.

        Args:
            info: Мета-описание.

        Raises:
            ValueError: Если name уже зарегистрирован.
        """
        if self._frozen:
            raise RuntimeError("Registry is frozen, cannot register new capabilities")

        if info.name in self._capabilities:
            raise ValueError(
                f"Capability '{info.name}' is already registered "
                f"(provider={self._capabilities[info.name].provider})"
            )

        # Валидация зависимостей (только прямые, не DAG)
        for dep in info.dependencies:
            if dep == info.name:
                raise DependencyError(
                    f"Capability '{info.name}' depends on itself"
                )

        self._capabilities[info.name] = info
        self._providers.setdefault(info.provider, []).append(info.name)
        logger.debug(
            "Registered capability %s (provider=%s, cost=%s, ttl=%s)",
            info.name,
            info.provider,
            info.cost.name,
            info.ttl,
        )

    def register_builtins(self) -> int:
        """Зарегистрировать все встроенные capability.

        Returns:
            Количество зарегистрированных capability.
        """
        count = 0
        for name, raw in _BUILTIN_CAPABILITY_DB.items():
            if name in self._capabilities:
                continue
            try:
                info = CapabilityInfo(
                    name=name,
                    description=raw.get("description", ""),
                    provider=raw.get("provider", "core"),
                    dependencies=list(raw.get("dependencies", [])),
                    ttl=float(raw.get("ttl", 60.0)),
                    cost=CapabilityCost.from_string(raw.get("cost", "light")),
                    cache=bool(raw.get("cache", True)),
                    timeout=float(raw.get("timeout", 5.0)),
                    version=raw.get("version", "1.0"),
                    group=raw.get("group", "technical"),
                )
                self.register(info)
                count += 1
            except (ValueError, DependencyError) as e:
                logger.warning("Failed to register built-in '%s': %s", name, e)
        return count

    def freeze(self) -> None:
        """Заморозить реестр (после инициализации).

        Вызывается при старте приложения, после загрузки всех плагинов.
        """
        self._frozen = True

    # ── Lookup ──

    def get(self, name: str) -> CapabilityInfo | None:
        """Получить мета-описание capability по имени."""
        return self._capabilities.get(name)

    def __contains__(self, name: str) -> bool:
        return name in self._capabilities

    def __len__(self) -> int:
        return len(self._capabilities)

    def __iter__(self):
        return iter(self._capabilities)

    def all(self) -> list[CapabilityInfo]:
        """Список всех зарегистрированных capability."""
        return list(self._capabilities.values())

    def by_provider(self, provider: str) -> list[CapabilityInfo]:
        """Получить все capability конкретного провайдера."""
        names = self._providers.get(provider, [])
        return [self._capabilities[n] for n in names]

    def by_group(self, group: str) -> list[CapabilityInfo]:
        """Получить все capability из группы."""
        return [c for c in self._capabilities.values() if c.group == group]

    def by_cost(self, max_cost: CapabilityCost) -> list[CapabilityInfo]:
        """Получить все capability не дороже max_cost."""
        return [c for c in self._capabilities.values() if c.cost.value <= max_cost.value]

    def find(self, pattern: str) -> list[CapabilityInfo]:
        """Поиск capability по имени (частичное совпадение)."""
        pattern_lower = pattern.lower()
        return [
            c for c in self._capabilities.values()
            if pattern_lower in c.name.lower()
            or pattern_lower in c.description.lower()
        ]

    # ── Resolution ──

    def resolve(self, names: list[str]) -> list[CapabilityInfo]:
        """Разрешить список capability с проверкой зависимостей.

        Возвращает топологически отсортированный список (зависимости раньше
        зависимых). Используется FeatureGraph для построения DAG.

        Args:
            names: Список имён capability.

        Returns:
            Топологически отсортированный список CapabilityInfo.

        Raises:
            DependencyError: Если зависимость не найдена или есть цикл.
        """
        # Шаг 1: собрать все необходимые capability (включая транзитивные зависимости)
        needed: list[str] = []
        seen: set[str] = set()

        def add_with_deps(name: str) -> None:
            if name in seen:
                return
            info = self._capabilities.get(name)
            if info is None:
                raise DependencyError(
                    f"Capability '{name}' is not registered"
                )
            for dep in info.dependencies:
                add_with_deps(dep)
            seen.add(name)
            needed.append(name)

        for name in names:
            add_with_deps(name)

        # Шаг 2: топологическая сортировка (Kahn)
        result: list[CapabilityInfo] = []
        in_degree: dict[str, int] = {n: 0 for n in needed}
        adj: dict[str, list[str]] = {n: [] for n in needed}

        for name in needed:
            info = self._capabilities[name]
            for dep in info.dependencies:
                if dep in adj:
                    adj[dep].append(name)
                    in_degree[name] = in_degree.get(name, 0) + 1

        # Kahn
        queue = [n for n, d in in_degree.items() if d == 0]
        sorted_names: list[str] = []

        while queue:
            node = queue.pop(0)
            sorted_names.append(node)
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(sorted_names) != len(needed):
            cyclic = set(needed) - set(sorted_names)
            raise DependencyError(
                f"Circular dependency detected: {cyclic}"
            )

        result = [self._capabilities[n] for n in sorted_names]
        return result

    def validate_strategy(self, capabilities: list[str]) -> list[str]:
        """Проверить, что стратегия может использовать свои capability.

        Args:
            capabilities: Список capability из manifest стратегии.

        Returns:
            Список проблем (пустой = OK).
        """
        issues: list[str] = []
        for name in capabilities:
            info = self._capabilities.get(name)
            if info is None:
                issues.append(f"Unknown capability: {name}")
                continue
            if info.deprecated:
                replacement = info.replaces or "none"
                issues.append(f"Deprecated capability: {name} → use {replacement}")
            for dep in info.dependencies:
                if dep not in self._capabilities:
                    issues.append(
                        f"Capability '{name}' requires '{dep}' "
                        f"which is not registered"
                    )
        return issues

    # ── Health ──

    def health_check(self) -> dict[str, Any]:
        """Получить состояние реестра для Dashboard.

        Returns:
            dict: total, by_provider, by_group, issue_count.
        """
        issues = 0
        for info in self._capabilities.values():
            for dep in info.dependencies:
                if dep not in self._capabilities:
                    issues += 1

        return {
            "total": len(self._capabilities),
            "providers": {
                p: len(names) for p, names in self._providers.items()
            },
            "groups": {
                g: len(self.by_group(g))
                for g in {c.group for c in self._capabilities.values()}
            },
            "frozen": self._frozen,
            "missing_dependencies": issues,
        }

    def summary(self) -> str:
        """Краткий отчёт."""
        lines = [
            f"CapabilityRegistry: {len(self._capabilities)} registered",
        ]
        for p in sorted(self._providers):
            names = self._providers[p]
            lines.append(f"  [{p}] {len(names)}: {', '.join(sorted(names))}")
        if self._frozen:
            lines.append("  [frozen]")
        return "\n".join(lines)

    def __repr__(self) -> str:
        return (
            f"CapabilityRegistry({len(self._capabilities)} caps, "
            f"{len(self._providers)} providers, "
            f"{'frozen' if self._frozen else 'mutable'})"
        )
