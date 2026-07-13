"""
Core API — контракты для всех компонентов системы.

Текущая версия API: 2.0
Compatibility Layer живёт до версии 1.0.0,
после чего удаляется.

Используем typing.Protocol для структурной типизации:
реализация не обязана наследовать протокол явно,
достаточно иметь методы с правильной сигнатурой.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Coroutine, Protocol, runtime_checkable

# ══════════════════════════════════════════════
#  Version
# ══════════════════════════════════════════════

CORE_API_VERSION: str = "2.0"
"""Текущая версия Core API.
Compatibility Layer включён для стратегий c api < CORE_API_VERSION.
Удаляется при переходе на 3.0."""

MAX_COMPAT_API_VERSION: str = "1.0"
"""Максимальная версия API, для которой работает Compatibility Layer.
Стратегии c api <= MAX_COMPAT_API_VERSION получают адаптер автоматически."""


# ══════════════════════════════════════════════
#  Capability — типизированные возможности
# ══════════════════════════════════════════════

class Capability(str, Enum):
    """Типизированные возможности для Capability API.
    Стратегия объявляет, какие данные ей нужны через этот enum."""
    # Market data
    CANDLES = "candles"
    TICKER = "ticker"
    VOLUME = "volume"
    # Indicators
    EMA = "ema"
    RSI = "rsi"
    ATR = "atr"
    SMA = "sma"
    MACD = "macd"
    BOLLINGER = "bollinger"
    STOCHASTIC = "stochastic"
    # Microstructure
    ORDERBOOK = "orderbook"
    TRADES = "trades"
    LIQUIDATIONS = "liquidations"
    WHALES = "whales"
    CVD = "cvd"
    # Context
    TREND = "trend"
    SESSION = "session"
    VOLATILITY = "volatility"
    CORRELATION = "correlation"
    RELATIVE_STRENGTH = "relative_strength"
    SECTOR = "sector"
    SENTIMENT = "sentiment"
    # Analysis
    DECISION = "decision"
    RISK = "risk"
    CONSENSUS = "consensus"
    HEATMAP = "heatmap"
    LIQUIDITY = "liquidity"
    BREADTH = "breadth"
    CLUSTERING = "clustering"


# ══════════════════════════════════════════════
#  Event (v2) — версионированное событие
# ══════════════════════════════════════════════

CURRENT_EVENT_VERSION = 2


@dataclass
class Event:
    """Версионированное событие от источника данных.

    v2: добавлены `version` и `source` для совместимости
    с множественными биржами и форматами данных.
    """
    version: int = CURRENT_EVENT_VERSION
    source: str = "unknown"       # bybit | binance | okx | replay
    channel: str = ""             # candles.BTCUSDT.5m | trades.BTCUSDT
    symbol: str = ""              # BTC/USDT:USDT
    data: dict = field(default_factory=dict)
    ts: float = field(default_factory=lambda: time.time() * 1000)
    received_at: float = field(default_factory=time.time)


@dataclass
class SignalResult:
    """Результат обработки сигнала (V1-compat stub).

    Используется SignalEngine и TelegramNotifier.
    """
    signal_name: str = ""
    symbol: str = ""
    exchange: str = ""
    score: float = 0.0
    direction: str = "neutral"
    meta: dict = field(default_factory=dict)
    ts: float = 0.0
    cooldown: int = 0


# ══════════════════════════════════════════════
#  Core Protocol interfaces
# ══════════════════════════════════════════════

Handler = Callable[["Event"], Coroutine[Any, Any, None]]


class IEventBus(Protocol):
    """Интерфейс шины событий."""

    async def publish(self, event: Event) -> None:
        ...

    def subscribe(self, channel: str, handler: Handler) -> None:
        ...

    def unsubscribe(self, channel: str, handler: Handler) -> None:
        ...


class IFeatureStore(Protocol):
    """Хранилище признаков (кэш FeatureEngine)."""

    async def get(self, symbol: str, key: str) -> Any | None:
        ...

    async def set(self, symbol: str, key: str, value: Any, ttl: float = 30.0) -> None:
        ...

    async def get_multi(self, symbols: list[str], keys: list[str]) -> dict[str, dict[str, Any]]:
        ...

    async def get_stale(self, symbol: str, max_age: float = 5.0) -> dict[str, Any]:
        ...


class IFeatureEngine(Protocol):
    """Feature Engine — вычисление признаков."""

    async def compute(self, symbol: str) -> dict[str, Any]:
        ...

    async def get_feature(self, symbol: str, name: str) -> Any | None:
        ...

    def get_calculator(self, name: str) -> Any | None:
        ...


class IContextEngine(Protocol):
    """Context Engine — сбор контекста для стратегий."""

    async def build_context(self, symbol: str, capabilities: set[Capability] | None = None) -> dict[str, Any]:
        ...


class IStrategyEngine(Protocol):
    """Strategy Engine — диспетчер стратегий."""

    async def analyze(self, symbol: str) -> list[Any]:
        ...

    async def start(self) -> None:
        ...

    async def stop(self) -> None:
        ...


class IDecisionEngine(Protocol):
    """Decision Engine — объединение сигналов в решения."""

    async def process(self, opportunities: list[Any]) -> list[Any]:
        ...

    async def evaluate(self, decision: Any) -> bool:
        ...


class IOutput(Protocol):
    """Интерфейс вывода сигналов (Telegram, API, лог, файл)."""

    async def send(self, signal: Any) -> bool:
        ...

    async def send_batch(self, signals: list[Any]) -> bool:
        ...


class IStorage(Protocol):
    """Персистентное хранилище (SQLite, файлы, etc.)."""

    async def save(self, collection: str, data: Any) -> None:
        ...

    async def query(self, collection: str, **filters) -> list[Any]:
        ...


# ══════════════════════════════════════════════
#  Data types
# ══════════════════════════════════════════════

@dataclass
class MarketDataEvent:
    """Событие рыночных данных (V2-compat)."""
    channel: str = ""
    symbol: str = ""
    data: dict = field(default_factory=dict)
    ts: float = field(default_factory=lambda: time.time() * 1000)


class MarketDataBus:
    """V2 Event Bus (stub для обратной совместимости).

    В Phase 0-4 заменён на чистый DI + ServiceRuntime.
    Оставлен для совместимости V1 модулей.
    """

    def __init__(self) -> None:
        self._subscriptions: dict[str, list[Handler]] = {}
        self._started = False

    async def publish(self, event: Event) -> None:
        channel = event.channel
        for handler in self._subscriptions.get(channel, []):
            try:
                await handler(event)
            except Exception:
                pass

    def subscribe(self, channel: str, handler: Handler) -> None:
        if channel not in self._subscriptions:
            self._subscriptions[channel] = []
        self._subscriptions[channel].append(handler)

    def unsubscribe(self, channel: str, handler: Handler) -> None:
        self._subscriptions[channel] = [
            h for h in self._subscriptions.get(channel, []) if h is not handler
        ]

    async def start(self) -> None:
        self._started = True

    async def stop(self) -> None:
        self._started = False
        self._subscriptions.clear()


def get_bus() -> MarketDataBus:
    """Получить глобальный MarketDataBus (stub)."""
    return MarketDataBus()

@dataclass
class Opportunity:
    """Рыночная возможность — результат анализа стратегии.
    Заменяет сырой SignalResult в v2 pipeline.

    Strategy.analyze() возвращает Opportunity.
    DecisionEngine принимает список Opportunity и решает,
    что отправить, объединить, отложить или отбросить.
    """
    symbol: str
    direction: str           # long | short
    score: float             # 0-100
    confidence: float        # 0.0-1.0
    strategy_name: str       # кто создал
    evidence: list[str] = field(default_factory=list)
    entry: float | None = None
    targets: list[float] = field(default_factory=list)
    stop: float | None = None
    risk: float = 0.0
    ts: float = field(default_factory=time.time)
    meta: dict = field(default_factory=dict)


# ══════════════════════════════════════════════
#  Strategy Manifest (контракт стратегии)
# ══════════════════════════════════════════════

@dataclass
class StrategyManifest:
    """Обязательный манифест стратегии.

    Парсится из manifest.yaml в папке стратегии.
    Без корректного манифеста стратегия не загружается.
    """
    id: str                    # уникальный ID (например, "momentum_v2")
    name: str                  # человеческое имя
    version: str               # семантическая версия
    api: str                   # версия Core API (должна быть <= CORE_API_VERSION)
    author: str                # автор
    category: str              # trend | scalping | ict | smart_money | breakout | mean_reversion
    description: str = ""
    capabilities: list[str] = field(default_factory=list)  # Capability values
    permissions: list[str] = field(default_factory=list)   # ["write:log", "read:config"]
    parameters: dict[str, Any] = field(default_factory=dict)  # defaults
