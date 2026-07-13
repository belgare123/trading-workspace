"""
Strategy Descriptor — метаданные стратегии (manifest.yaml).

StrategyDescriptor — это pure metadata. Он не загружает Python-код, не запускает
стратегию. Он отвечает только на вопросы:
  - Как называется стратегия?
  - Кто автор?
  - Какие признаки ей нужны (capabilities)?
  - Какая версия API?
  - Какая схема конфига?
  - Какой поведенческий профиль (profile)?

Marketplace читает только Descriptor, не загружая стратегию.
Plugin Loader читает manifest.yaml → создаёт Descriptor → валидирует → регистрирует.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


# ═══════════════════════════════════════════════════════════════════
# Категории стратегий
# ═══════════════════════════════════════════════════════════════════


class StrategyCategory(str, Enum):
    """Категория стратегии.

    Определяет, как стратегия торгует — трендовая, контр-трендовая, скальпинг и т.д.
    """

    TREND = "trend"
    MOMENTUM = "momentum"
    MEAN_REVERSION = "mean_reversion"
    SCALPING = "scalping"
    BREAKOUT = "breakout"
    PATTERN = "pattern"
    MARKET_MAKING = "market_making"
    ARBITRAGE = "arbitrage"
    WHALE = "whale"
    CUSTOM = "custom"


# ═══════════════════════════════════════════════════════════════════
# Profile — поведенческий профиль стратегии (Manifest v2)
# ═══════════════════════════════════════════════════════════════════


class StrategyStyle(str, Enum):
    """Стиль торговли (profile.style)."""

    TREND_FOLLOWING = "trend_following"
    MEAN_REVERSION = "mean_reversion"
    BREAKOUT = "breakout"
    SCALPING = "scalping"


class HoldingTime(str, Enum):
    """Время удержания позиции (profile.holding_time)."""

    INTRADAY = "intraday"
    SWING = "swing"
    POSITION = "position"


class SignalFrequency(str, Enum):
    """Частота сигналов (profile.signal_frequency)."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskLevel(str, Enum):
    """Уровень риска (profile.risk_level)."""

    CONSERVATIVE = "conservative"
    MEDIUM = "medium"
    AGGRESSIVE = "aggressive"


class MarketRegime(str, Enum):
    """Режим рынка (profile.preferred_market_regime)."""

    TRENDING = "trending"
    RANGING = "ranging"
    HIGH_VOLATILITY = "high_volatility"
    LOW_VOLATILITY = "low_volatility"


@dataclass
class StrategyProfile:
    """Поведенческий профиль стратегии.

    Декларация намерений — не конфигурация, а описание того, как стратегия
    спроектирована работать.

    Attributes:
        style:                   Стиль торговли.
        holding_time:            Время удержания позиции.
        signal_frequency:        Частота сигналов.
        expected_win_rate:       Ожидаемая доля прибыльных сделок (0.0–1.0).
        expected_rr:             Ожидаемое отношение риск/прибыль.
        risk_level:              Уровень риска.
        preferred_market_regime: Предпочтительные режимы рынка.
    """

    style: StrategyStyle = StrategyStyle.TREND_FOLLOWING
    holding_time: HoldingTime = HoldingTime.INTRADAY
    signal_frequency: SignalFrequency = SignalFrequency.MEDIUM
    expected_win_rate: float = 0.0
    expected_rr: float = 0.0
    risk_level: RiskLevel = RiskLevel.MEDIUM
    preferred_market_regime: list[MarketRegime] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StrategyProfile:
        """Создать Profile из dict (yaml-секция profile:)."""
        style_raw = str(data.get("style", "trend_following")).strip()
        try:
            style = StrategyStyle(style_raw)
        except ValueError:
            style = StrategyStyle.TREND_FOLLOWING

        holding_raw = str(data.get("holding_time", "intraday")).strip()
        try:
            holding = HoldingTime(holding_raw)
        except ValueError:
            holding = HoldingTime.INTRADAY

        freq_raw = str(data.get("signal_frequency", "medium")).strip()
        try:
            freq = SignalFrequency(freq_raw)
        except ValueError:
            freq = SignalFrequency.MEDIUM

        risk_raw = str(data.get("risk_level", "medium")).strip()
        try:
            risk = RiskLevel(risk_raw)
        except ValueError:
            risk = RiskLevel.MEDIUM

        regimes_raw = data.get("preferred_market_regime", [])
        regimes: list[MarketRegime] = []
        if isinstance(regimes_raw, list):
            for r in regimes_raw:
                try:
                    regimes.append(MarketRegime(str(r).strip()))
                except ValueError:
                    pass

        return cls(
            style=style,
            holding_time=holding,
            signal_frequency=freq,
            expected_win_rate=float(data.get("expected_win_rate", 0.0)),
            expected_rr=float(data.get("expected_rr", 0.0)),
            risk_level=risk,
            preferred_market_regime=regimes,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "style": self.style.value,
            "holding_time": self.holding_time.value,
            "signal_frequency": self.signal_frequency.value,
            "expected_win_rate": self.expected_win_rate,
            "expected_rr": self.expected_rr,
            "risk_level": self.risk_level.value,
            "preferred_market_regime": [r.value for r in self.preferred_market_regime],
        }

    @property
    def is_valid(self) -> bool:
        """Проверить минимальную валидность профиля."""
        if self.expected_win_rate and (self.expected_win_rate < 0.0 or self.expected_win_rate > 1.0):
            return False
        if self.expected_rr and self.expected_rr < 0.0:
            return False
        return True

    def __repr__(self) -> str:
        return (
            f"StrategyProfile({self.style.value}, "
            f"{self.holding_time.value}, {self.risk_level.value})"
        )


# ═══════════════════════════════════════════════════════════════════
# Permissions — разрешения стратегии
# ═══════════════════════════════════════════════════════════════════


class Permission(str, Enum):
    """Разрешения, которые может запросить стратегия.

    Значения:
        MARKET_DATA:   Доступ к рыночным данным.
        SIGNALS:       Отправка сигналов.
        TRADES:        Отправка торговых поручений.
        FILESYSTEM_READ:  Чтение файлов в своей директории.
        FILESYSTEM_WRITE: Запись файлов в своей директории.
        NETWORK:       Прямые сетевые вызовы.
    """

    MARKET_DATA = "market_data"
    SIGNALS = "signals"
    TRADES = "trades"
    FILESYSTEM_READ = "filesystem:read"
    FILESYSTEM_WRITE = "filesystem:write"
    NETWORK = "network"
    ALL = "all"


# Парсинг permissions из yaml
_PERMISSION_ALIASES: dict[str, Permission] = {
    "market_data": Permission.MARKET_DATA,
    "signals": Permission.SIGNALS,
    "trades": Permission.TRADES,
    "filesystem:read": Permission.FILESYSTEM_READ,
    "filesystem:write": Permission.FILESYSTEM_WRITE,
    "network": Permission.NETWORK,
    "all": Permission.ALL,
}


def parse_permissions(raw: list[str] | None) -> list[Permission]:
    """Парсинг списка permissions из manifest.yaml.

    Args:
        raw: Список строк из yaml.

    Returns:
        Список Permission.
    """
    if not raw:
        return [Permission.MARKET_DATA, Permission.SIGNALS]  # default

    result: list[Permission] = []
    for item in raw:
        p = _PERMISSION_ALIASES.get(item.strip())
        if p is not None and p not in result:
            result.append(p)

    if Permission.ALL in result:
        return list(Permission)

    # Добавляем базовые по умолчанию, если не указаны
    if Permission.MARKET_DATA not in result:
        result.insert(0, Permission.MARKET_DATA)
    if Permission.SIGNALS not in result:
        result.append(Permission.SIGNALS)

    return result


# ═══════════════════════════════════════════════════════════════════
# PluginDependency — зависимость от другого плагина
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PluginDependency:
    """Зависимость стратегии от другого плагина.

    Attributes:
        name:     Имя плагина.
        version:  Версионное ограничение (SemVer, e.g. \">=1.0\", \"^2.0\").
        optional: True — опциональная зависимость.
    """

    name: str
    version: str = "*"
    optional: bool = False

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PluginDependency:
        return cls(
            name=str(data.get("name", "")),
            version=str(data.get("version", "*")),
            optional=bool(data.get("optional", False)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "optional": self.optional,
        }


# ═══════════════════════════════════════════════════════════════════
# Capability — признак, необходимый стратегии
# ═══════════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class Capability:
    """Один признак/возможность, которую требует стратегия от FeatureEngine.

    Attributes:
        name:        Уникальное имя. {a-z, 0-9, _} (e.g. \"ema\", \"rsi\", \"orderbook\").
        description: Человеко-читаемое описание (e.g. \"Exponential Moving Average\").
        required:    True — обязательный, False — опциональный.
    """

    name: str
    description: str = ""
    required: bool = True

    def __post_init__(self) -> None:
        if not re.match(r"^[a-z][a-z0-9_]{0,63}$", self.name):
            raise ValueError(
                f"Invalid capability name '{self.name}'. "
                f"Must be [a-z][a-z0-9_]{{0,63}}"
            )

    def __repr__(self) -> str:
        return f"Capability({self.name})"


# Стандартные capabilities
CAP_CANDLES = Capability("candles", "OHLCV candles")
CAP_EMA = Capability("ema", "Exponential Moving Average")
CAP_RSI = Capability("rsi", "Relative Strength Index")
CAP_ATR = Capability("atr", "Average True Range")
CAP_MACD = Capability("macd", "Moving Average Convergence Divergence")
CAP_BOLLINGER = Capability("bollinger", "Bollinger Bands")
CAP_VOLUME = Capability("volume", "Volume analysis")
CAP_ORDERBOOK = Capability("orderbook", "Order book depth")
CAP_TRADES = Capability("trades", "Recent trades / tape")
CAP_WHALES = Capability("whales", "Whale trade detection")
CAP_SENTIMENT = Capability("sentiment", "Sentiment score")
CAP_FUNDING = Capability("funding", "Funding rate")
CAP_OI = Capability("oi", "Open interest")
CAP_LIQUIDATIONS = Capability("liquidations", "Liquidation data")

# Built-in registry имени → Capability
_BUILTIN_CAPABILITIES: dict[str, Capability] = {
    "candles": CAP_CANDLES,
    "ema": CAP_EMA,
    "rsi": CAP_RSI,
    "atr": CAP_ATR,
    "macd": CAP_MACD,
    "bollinger": CAP_BOLLINGER,
    "volume": CAP_VOLUME,
    "orderbook": CAP_ORDERBOOK,
    "trades": CAP_TRADES,
    "whales": CAP_WHALES,
    "sentiment": CAP_SENTIMENT,
    "funding": CAP_FUNDING,
    "oi": CAP_OI,
    "liquidations": CAP_LIQUIDATIONS,
}


def capability_by_name(name: str) -> Capability | None:
    """Получить Capability по имени (из built-in registry)."""
    return _BUILTIN_CAPABILITIES.get(name)


def register_capability(cap: Capability) -> None:
    """Зарегистрировать кастомную Capability.

    Используется плагинами, которые добавляют новые признаки.
    """
    _BUILTIN_CAPABILITIES[cap.name] = cap


# ═══════════════════════════════════════════════════════════════════
# StrategyDescriptor — чистые метаданные, без кода
# ═══════════════════════════════════════════════════════════════════


@dataclass
class StrategyDescriptor:
    """Метаданные стратегии (результат парсинга manifest.yaml).

    Не содержит Python-код. Безопасен для Marketplace: можно вывести
    список стратегий без import ни одного модуля.

    Attributes (v2):
        name:           Уникальное имя стратегии (e.g. \"Momentum\").
        version:        SemVer версия (e.g. \"1.2.0\").
        author:         Имя автора (e.g. \"Vitaliy\").
        description:    Описание стратегии.
        homepage:       URL проекта.
        repository:     URL репозитория.
        license:        SPDX-идентификатор (e.g. \"MIT\").
        category:       Категория (trend, momentum, etc.).
        api_version:    Минимальная версия API платформы (e.g. \"2.0\").
        min_core:       Минимальная версия ядра (e.g. \"0.12.0\").
        capabilities:   Список необходимых признаков (e.g. [\"candles\", \"ema\"]).
        tags:           Теги для поиска и фильтрации.
        exchange:       Поддерживаемые биржи (e.g. [\"binance\", \"bybit\"]).
        markets:        Типы рынков (e.g. [\"spot\", \"futures\"]).
        timeframes:     Таймфреймы (e.g. [\"1m\", \"5m\", \"1h\"]).
        permissions:    Разрешения стратегии.
        dependencies:   Зависимости от других плагинов.
        entry_point:    Путь к strategy.py (маппится из entry).
        config_schema:  JSON-схема для config.yaml (опционально).
        profile:        Поведенческий профиль стратегии.
        path:           Абсолютный путь к директории стратегии.
    """

    name: str
    version: str = "1.0.0"
    author: str = "unknown"
    description: str = ""
    homepage: str = ""
    repository: str = ""
    license: str = ""
    category: StrategyCategory = StrategyCategory.CUSTOM
    api_version: str = "2.0"
    min_core: str = "0.0.0"
    capabilities: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    exchange: list[str] = field(default_factory=list)
    markets: list[str] = field(default_factory=list)
    timeframes: list[str] = field(default_factory=list)
    permissions: list[Permission] = field(default_factory=lambda: [Permission.MARKET_DATA, Permission.SIGNALS])
    dependencies: list[PluginDependency] = field(default_factory=list)
    entry_point: str = "strategy.py"
    config_schema: Any = None  # ConfigSchema | None — отложенный импорт
    profile: StrategyProfile | None = None
    path: str = ""

    def __post_init__(self) -> None:
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_ -]{0,63}$", self.name):
            raise ValueError(
                f"Invalid strategy name '{self.name}'. "
                f"Must start with letter, max 64 chars."
            )

    def has_capability(self, name: str) -> bool:
        """Проверить, требует ли стратегия указанный признак."""
        return name in self.capabilities

    @property
    def capability_count(self) -> int:
        return len(self.capabilities)

    @property
    def has_profile(self) -> bool:
        return self.profile is not None

    def to_dict(self) -> dict[str, object]:
        d: dict[str, object] = {
            "name": self.name,
            "version": self.version,
            "author": self.author,
            "description": self.description,
            "homepage": self.homepage,
            "repository": self.repository,
            "license": self.license,
            "category": self.category.value,
            "api_version": self.api_version,
            "min_core": self.min_core,
            "capabilities": list(self.capabilities),
            "tags": list(self.tags),
            "exchange": list(self.exchange),
            "markets": list(self.markets),
            "timeframes": list(self.timeframes),
            "permissions": [p.value for p in self.permissions],
            "entry_point": self.entry_point,
        }
        if self.dependencies:
            d["dependencies"] = [dep.to_dict() for dep in self.dependencies]
        if self.profile is not None:
            d["profile"] = self.profile.to_dict()
        return d

    def __repr__(self) -> str:
        parts = [
            f"StrategyDescriptor(name={self.name!r}",
            f"v{self.version}",
            f"{self.category.value}",
        ]
        if self.has_profile:
            parts.append(f"profile={self.profile!r}")
        parts.append(")")
        return ", ".join(parts)


# ═══════════════════════════════════════════════════════════════════
# Manifest — парсер manifest.yaml
# ═══════════════════════════════════════════════════════════════════


class ManifestError(Exception):
    """Ошибка чтения/валидации manifest.yaml."""

    pass


class ManifestSchema:
    """Определение полей manifest.yaml v2 и их типов.

    Используется для валидации перед созданием StrategyDescriptor.
    """

    REQUIRED_FIELDS: tuple[str, ...] = ("name",)
    OPTIONAL_FIELDS: tuple[str, ...] = (
        # Идентификация
        "version",
        "author",
        "description",
        "homepage",
        "repository",
        "license",
        # Совместимость
        "api",
        "api_version",
        "min_core",
        # Категоризация
        "category",
        "tags",
        # Торговые параметры
        "exchange",
        "markets",
        "timeframes",
        # Поведенческий профиль
        "profile",
        # Возможности
        "capabilities",
        "permissions",
        # Технические
        "entry_point",
        "entry",
        "config_schema",
        "dependencies",
    )

    ALLOWED_FIELDS: set[str] = set(REQUIRED_FIELDS) | set(OPTIONAL_FIELDS)

    VALID_CATEGORIES: set[str] = {c.value for c in StrategyCategory}

    @classmethod
    def validate_raw(cls, data: dict[str, object], source: str = "?") -> None:
        """Проверить сырой dict из yaml перед созданием Descriptor.

        Raises:
            ManifestError: Если данные не проходят валидацию.
        """
        # Unknown fields
        unknown = set(data) - cls.ALLOWED_FIELDS
        if unknown:
            raise ManifestError(
                f"Unknown fields in {source}: {sorted(unknown)}"
            )

        # Required fields
        for field in cls.REQUIRED_FIELDS:
            if field not in data or not data[field]:
                raise ManifestError(
                    f"Missing required field '{field}' in {source}"
                )

        # name
        name = data["name"]
        if not isinstance(name, str) or not name.strip():
            raise ManifestError(f"Invalid 'name' in {source}")

        # version (optional)
        version = data.get("version", "1.0.0")
        if not isinstance(version, str):
            raise ManifestError(f"'version' must be a string in {source}")

        # category (optional)
        category = data.get("category", "custom")
        if isinstance(category, str) and category not in cls.VALID_CATEGORIES:
            valid_str = ", ".join(sorted(cls.VALID_CATEGORIES))
            raise ManifestError(
                f"Invalid category '{category}' in {source}. "
                f"Valid: {valid_str}"
            )

        # capabilities (optional)
        caps = data.get("capabilities", [])
        if isinstance(caps, list):
            for c in caps:
                if not isinstance(c, str):
                    raise ManifestError(
                        f"Capability must be a string in {source}, got {type(c).__name__}"
                    )

        # permissions (optional)
        perms = data.get("permissions", [])
        if isinstance(perms, list):
            for p in perms:
                if not isinstance(p, str):
                    raise ManifestError(
                        f"Permission must be a string in {source}, got {type(p).__name__}"
                    )

        # exchange, markets, timeframes (optional)
        for list_field in ("exchange", "markets", "timeframes"):
            val = data.get(list_field, [])
            if isinstance(val, list):
                for item in val:
                    if not isinstance(item, str):
                        raise ManifestError(
                            f"'{list_field}' items must be strings in {source}, "
                            f"got {type(item).__name__}"
                        )

        # dependencies (optional)
        deps = data.get("dependencies", [])
        if isinstance(deps, list):
            for dep in deps:
                if isinstance(dep, dict):
                    if "name" not in dep:
                        raise ManifestError(
                            f"Dependency missing 'name' in {source}"
                        )
                    if not isinstance(dep.get("name"), str):
                        raise ManifestError(
                            f"Dependency 'name' must be a string in {source}"
                        )


class ManifestLoader:
    """Загрузчик manifest.yaml v2.

    Используется Plugin Loader для чтения и валидации manifest.yaml
    перед созданием StrategyDescriptor.
    """

    MANIFEST_FILENAME: str = "manifest.yaml"

    @classmethod
    def from_dict(
        cls,
        data: dict[str, object],
        source: str = "?",
    ) -> StrategyDescriptor:
        """Создать StrategyDescriptor из dict (yaml content).

        Поддерживает:
          - v1: entry_point
          - v2: entry (предпочтительно), homepage, repository, license,
                exchange, markets, timeframes, profile, permissions,
                dependencies

        Args:
            data:   Содержимое manifest.yaml как dict.
            source: Откуда прочитан (путь к файлу), для сообщений об ошибках.

        Returns:
            StrategyDescriptor с заполненными полями.

        Raises:
            ManifestError: Если данные невалидны.
        """
        ManifestSchema.validate_raw(data, source)

        # name
        name = str(data["name"]).strip()

        # category
        category_str = str(data.get("category", "custom")).strip()
        category: StrategyCategory
        try:
            category = StrategyCategory(category_str)
        except ValueError:
            category = StrategyCategory.CUSTOM

        # capabilities — validate against built-in registry
        raw_caps: list[str] = [
            str(c).strip().lower() for c in data.get("capabilities", [])
        ]

        # tags
        raw_tags: list[str] = [
            str(t).strip() for t in data.get("tags", [])
        ]

        # exchange, markets, timeframes (v2 fields)
        raw_exchange: list[str] = [
            str(e).strip().lower() for e in data.get("exchange", [])
        ]
        raw_markets: list[str] = [
            str(m).strip().lower() for m in data.get("markets", [])
        ]
        raw_timeframes: list[str] = [
            str(t).strip().lower() for t in data.get("timeframes", [])
        ]

        # config_schema
        raw_schema = data.get("config_schema", {})
        config_schema: Any = None
        if isinstance(raw_schema, dict) and raw_schema:
            from core.strategy.config_schema import ConfigSchema

            try:
                config_schema = ConfigSchema.from_dict(raw_schema)
            except Exception:
                pass

        # entry point — v2: entry, v1: entry_point (fallback)
        entry = str(data.get("entry", data.get("entry_point", "strategy.py"))).strip()

        # permissions (v2)
        raw_permissions: list[str] = [
            str(p).strip() for p in data.get("permissions", [])
        ]
        permissions = parse_permissions(raw_permissions)

        # dependencies (v2)
        raw_deps = data.get("dependencies", [])
        dependencies: list[PluginDependency] = []
        if isinstance(raw_deps, list):
            for dep in raw_deps:
                if isinstance(dep, dict):
                    try:
                        dependencies.append(PluginDependency.from_dict(dep))
                    except Exception:
                        pass

        # profile (v2)
        raw_profile = data.get("profile", {})
        profile: StrategyProfile | None = None
        if isinstance(raw_profile, dict) and raw_profile:
            try:
                profile = StrategyProfile.from_dict(raw_profile)
            except Exception:
                pass

        descriptor = StrategyDescriptor(
            name=name,
            version=str(data.get("version", "1.0.0")).strip(),
            author=str(data.get("author", "unknown")).strip(),
            description=str(data.get("description", "")).strip(),
            homepage=str(data.get("homepage", "")).strip(),
            repository=str(data.get("repository", "")).strip(),
            license=str(data.get("license", "")).strip(),
            category=category,
            api_version=str(data.get("api_version", data.get("api", "2.0"))).strip(),
            min_core=str(data.get("min_core", "0.0.0")).strip(),
            capabilities=raw_caps,
            tags=raw_tags,
            exchange=raw_exchange,
            markets=raw_markets,
            timeframes=raw_timeframes,
            permissions=permissions,
            dependencies=dependencies,
            entry_point=entry,
            config_schema=config_schema,
            profile=profile,
        )
        return descriptor

    @classmethod
    def from_file(cls, path: str) -> StrategyDescriptor:
        """Прочитать manifest.yaml из файла.

        Args:
            path: Полный путь к manifest.yaml или к директории стратегии.

        Returns:
            StrategyDescriptor.

        Raises:
            ManifestError: Если файл не найден или невалиден.
        """
        import os

        filepath = path
        if os.path.isdir(path):
            filepath = os.path.join(path, cls.MANIFEST_FILENAME)

        if not os.path.exists(filepath):
            raise ManifestError(f"Manifest not found: {filepath}")

        import yaml  # type: ignore[import-untyped]

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except Exception as e:
            raise ManifestError(f"Failed to parse {filepath}: {e}") from e

        if not isinstance(data, dict):
            raise ManifestError(
                f"Invalid manifest format in {filepath}: "
                f"expected dict, got {type(data).__name__}"
            )

        descriptor = cls.from_dict(data, filepath)
        descriptor.path = os.path.dirname(os.path.abspath(filepath))
        return descriptor

    @classmethod
    def to_yaml(cls, descriptor: StrategyDescriptor) -> str:
        """Сериализовать Descriptor обратно в YAML (для дампа)."""
        lines = [
            f"name: {descriptor.name}",
            f"version: {descriptor.version}",
            f"author: {descriptor.author}",
            f"description: \"{descriptor.description}\"" if descriptor.description else "",
            f"category: {descriptor.category.value}",
            f"api_version: {descriptor.api_version}",
            f"min_core: {descriptor.min_core}" if descriptor.min_core != "0.0.0" else "",
        ]
        lines = [l for l in lines if l]

        # v2 fields
        if descriptor.homepage:
            lines.insert(1, f"homepage: {descriptor.homepage}")
        if descriptor.repository:
            lines.insert(1, f"repository: {descriptor.repository}")
        if descriptor.license:
            lines.insert(1, f"license: {descriptor.license}")

        if descriptor.exchange:
            lines.append("exchange:")
            for e in descriptor.exchange:
                lines.append(f"  - {e}")

        if descriptor.markets:
            lines.append("markets:")
            for m in descriptor.markets:
                lines.append(f"  - {m}")

        if descriptor.timeframes:
            lines.append("timeframes:")
            for t in descriptor.timeframes:
                lines.append(f"  - {t}")

        if descriptor.tags:
            lines.append("tags:")
            for t in descriptor.tags:
                lines.append(f"  - {t}")

        if descriptor.capabilities:
            lines.append("capabilities:")
            for c in descriptor.capabilities:
                lines.append(f"  - {c}")

        if descriptor.permissions:
            lines.append("permissions:")
            for p in descriptor.permissions:
                lines.append(f"  - {p.value}")

        if descriptor.dependencies:
            lines.append("dependencies:")
            for dep in descriptor.dependencies:
                lines.append(f"  - name: {dep.name}")
                lines.append(f"    version: \"{dep.version}\"")
                lines.append(f"    optional: {str(dep.optional).lower()}")

        if descriptor.profile is not None:
            lines.append("profile:")
            lines.append(f"  style: {descriptor.profile.style.value}")
            lines.append(f"  holding_time: {descriptor.profile.holding_time.value}")
            lines.append(f"  signal_frequency: {descriptor.profile.signal_frequency.value}")
            lines.append(f"  expected_win_rate: {descriptor.profile.expected_win_rate}")
            lines.append(f"  expected_rr: {descriptor.profile.expected_rr}")
            lines.append(f"  risk_level: {descriptor.profile.risk_level.value}")
            if descriptor.profile.preferred_market_regime:
                lines.append("  preferred_market_regime:")
                for r in descriptor.profile.preferred_market_regime:
                    lines.append(f"    - {r.value}")

        lines.append(f"entry: {descriptor.entry_point}")
        return "\n".join(lines)
