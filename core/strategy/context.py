"""
StrategyContext — единая точка доступа стратегии к платформе.

Стратегия НЕ имеет прямого доступа к:
  - FeatureEngine
  - ContextEngine
  - StateEngine
  - Container

Вместо этого стратегия получает StrategyContext при инициализации.

  ctx.features  — данные признаков (candles, ema, rsi, orderbook...)
  ctx.market    — рыночные данные (текущая цена, объём, волатильность)
  ctx.state     — состояние стратегии (lifecycle, метрики, статистика)
  ctx.config    — настройки стратегии (из config.yaml)
  ctx.session   — информация о сессии (id, start_time)
  ctx.exchange  — данные биржи (название, режим, лимиты)

Это полностью отвязывает стратегии от внутренней архитектуры платформы.
FeatureEngine можно заменить — ни одна стратегия не изменится.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Protocol

from core.strategy.descriptor import StrategyDescriptor


# ═══════════════════════════════════════════════════════════════════
# FeatureAPI — доступ к признакам
# ═══════════════════════════════════════════════════════════════════


class FeatureAPI(Protocol):
    """Протокол доступа к признакам через ctx.features.

    Стратегия запрашивает только те признаки, которые указаны в manifest.yaml.

    Пример:
        ema = await ctx.features.get("ema", symbol="BTC/USDT", period=20)
        candles = await ctx.features.get_candles(symbol="BTC/USDT", limit=100)
        rsi = ctx.features.latest("rsi", symbol="BTC/USDT")
    """

    async def get(
        self,
        name: str,
        symbol: str | None = None,
        **params: Any,
    ) -> Any:
        """Получить значение признака.

        Args:
            name:   Имя признака (e.g. "ema", "rsi", "orderbook").
            symbol: Тикер (опционально — если стратегия работает с одним символом).
            **params: Дополнительные параметры (периоды, таймфреймы).

        Returns:
            Значение признака. Тип зависит от признака:
              - Числовые (ema, rsi): float | None
              - Серии (candles): list[dict]
              - Объекты (orderbook): OrderBookSnapshot
              - None если данных нет.
        """
        ...

    def latest(
        self,
        name: str,
        symbol: str | None = None,
    ) -> Any:
        """Последнее известное значение признака (без await)."""
        ...

    async def get_candles(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Получить OHLCV свечи."""
        ...

    async def has(self, name: str) -> bool:
        """Проверить доступность признака."""
        ...


# ═══════════════════════════════════════════════════════════════════
# MarketAPI — рыночные данные
# ═══════════════════════════════════════════════════════════════════


class MarketAPI(Protocol):
    """Доступ к рыночным данным через ctx.market.

    Пример:
        price = await ctx.market.price("BTC/USDT")
        vol = ctx.market.volume("BTC/USDT")
        ticker = await ctx.market.ticker("BTC/USDT")
    """

    async def price(self, symbol: str) -> float | None:
        """Текущая рыночная цена символа."""
        ...

    async def ticker(self, symbol: str) -> dict[str, Any] | None:
        """Полный ticker (bid, ask, last, volume, change)."""
        ...

    def volume(self, symbol: str) -> float | None:
        """24h объём (без await — последнее известное значение)."""
        ...

    def volatility(self, symbol: str) -> float | None:
        """Текущая волатильность."""
        ...


# ═══════════════════════════════════════════════════════════════════
# StateAPI — состояние стратегии
# ═══════════════════════════════════════════════════════════════════


class StateAPI(Protocol):
    """Доступ к состоянию стратегии через ctx.state.

    Пример:
        ctx.state.set("last_signal_price", price)
        last = ctx.state.get("last_signal_price")
        ctx.state.increment("total_signals")
    """

    def get(self, key: str, default: Any = None) -> Any:
        """Получить значение из состояния стратегии."""
        ...

    def set(self, key: str, value: Any) -> None:
        """Установить значение в состояние стратегии."""
        ...

    def increment(self, key: str, delta: int = 1) -> int:
        """Инкрементировать числовое значение."""
        ...

    def keys(self) -> list[str]:
        """Все ключи состояния."""
        ...

    def reset(self) -> None:
        """Сбросить состояние (при перезапуске стратегии)."""
        ...

    @property
    def uptime(self) -> float:
        """Секунд с момента запуска стратегии."""
        ...

    @property
    def signal_count(self) -> int:
        """Количество сгенерированных сигналов."""
        ...


# ═══════════════════════════════════════════════════════════════════
# ExchangeAPI — данные биржи
# ═══════════════════════════════════════════════════════════════════


class ExchangeAPI(Protocol):
    """Доступ к данным биржи через ctx.exchange.

    Пример:
        name = await ctx.exchange.name()
        trading = await ctx.exchange.is_trading("BTC/USDT")
        limits = ctx.exchange.limits("BTC/USDT")
    """

    async def name(self) -> str:
        """Название биржи (e.g. 'Bybit', 'Binance')."""
        ...

    async def is_trading(self, symbol: str) -> bool:
        """Проверяет, торгуется ли пара в данный момент."""
        ...

    def limits(self, symbol: str) -> dict[str, Any]:
        """Лимиты биржи для символа (min/max lot, step, tick)."""
        ...

    @property
    def mode(self) -> str:
        """Режим (live | paper | backtest)."""
        ...


# ═══════════════════════════════════════════════════════════════════
# StrategyConfig — настройки стратегии
# ═══════════════════════════════════════════════════════════════════


@dataclass
class StrategyConfig:
    """Настройки стратегии из config.yaml.

    Поддерживает вложенный доступ через точки:
        cfg = ctx.config
        ema_fast = cfg.get("ema_fast", 20)
        atr_period = cfg.get("atr_period", 14)
        score = cfg.get("score", 60)

        # Вложенные ключи
        thresholds = cfg.get("risk.max_drawdown", 0.05)

    После Phase 5 (Configuration Runtime) значения могут обновляться
    горячо (без перезапуска стратегии).
    """

    _data: dict[str, Any] = field(default_factory=dict)
    _defaults: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any],
        defaults: dict[str, Any] | None = None,
    ) -> StrategyConfig:
        return cls(_data=dict(data), _defaults=dict(defaults or {}))

    def get(self, key: str, default: Any = None) -> Any:
        """Получить настройку.

        Поддерживает вложенные ключи через точку:
            ctx.config.get("risk.max_drawdown")
            ctx.config.get("ema_fast", 20)
        """
        # Вложенный доступ через точку
        if "." in key:
            parts = key.split(".")
            current: Any = self._data
            for part in parts:
                if isinstance(current, dict):
                    current = current.get(part)
                else:
                    break
            if current is not None:
                return current
            # Fallback to defaults with same path
            current = self._defaults
            for part in parts:
                if isinstance(current, dict):
                    current = current.get(part)
                else:
                    return default
            return current if current is not None else default

        value = self._data.get(key)
        if value is not None:
            return value
        return self._defaults.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Обновить настройку (для hot-reload)."""
        self._data[key] = value

    def all(self) -> dict[str, Any]:
        """Все настройки (данные + defaults)."""
        merged = dict(self._defaults)
        merged.update(self._data)
        return merged

    def __getitem__(self, key: str) -> Any:
        value = self.get(key)
        if value is None:
            raise KeyError(f"Config key not found: {key}")
        return value


# ═══════════════════════════════════════════════════════════════════
# SessionInfo — информация о сессии
# ═══════════════════════════════════════════════════════════════════


@dataclass
class SessionInfo:
    """Информация о текущей сессии.

    Attributes:
        id:          Уникальный ID сессии.
        start_time:  Время начала сессии.
        is_backtest: True если запуск в режиме бэктеста.
        is_live:     True если живая торговля.
        symbols:     Список отслеживаемых символов.
        timeframe:   Базовый таймфрейм.
    """

    id: str = ""
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_backtest: bool = False
    is_live: bool = False
    symbols: list[str] = field(default_factory=list)
    timeframe: str = "1h"

    @property
    def uptime_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self.start_time).total_seconds()


# ═══════════════════════════════════════════════════════════════════
# StrategyContext — единая точка доступа
# ═══════════════════════════════════════════════════════════════════


@dataclass
class StrategyContext:
    """Контекст стратегии — единственный способ взаимодействия с платформой.

    Стратегия получает этот объект при вызове initialize() и использует
    его для всего: чтение признаков, рыночных данных, конфига и т.д.

    Пример использования внутри стратегии:
        async def analyze(self, ctx: StrategyContext) -> SignalBundle:
            candles = await ctx.features.get_candles("BTC/USDT", limit=100)
            ema = await ctx.features.get("ema", symbol="BTC/USDT", period=20)
            price = await ctx.market.price("BTC/USDT")
            threshold = ctx.config.get("score_threshold", 60)
            ...
    """

    descriptor: StrategyDescriptor
    """Метаданные стратегии (manifest.yaml)."""

    config: StrategyConfig = field(default_factory=StrategyConfig)
    """Настройки стратегии (config.yaml)."""

    session: SessionInfo = field(default_factory=SessionInfo)
    """Информация о сессии."""

    # ── API-протоколы (заполняются Engine при инициализации) ──

    features: Optional[FeatureAPI] = None
    """Доступ к признакам FeatureEngine."""

    market: Optional[MarketAPI] = None
    """Доступ к рыночным данным."""

    state: Optional[StateAPI] = None
    """Доступ к состоянию стратегии."""

    exchange: Optional[ExchangeAPI] = None
    """Доступ к данным биржи."""

    # ── Мета ──

    _metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def name(self) -> str:
        return self.descriptor.name

    @property
    def symbol(self) -> str:
        """Первый символ из сессии (если стратегия однопарная)."""
        if self.session.symbols:
            return self.session.symbols[0]
        return ""

    def is_ready(self) -> bool:
        """Все зависимости контекста готовы."""
        return all([
            self.features is not None,
            self.market is not None,
            self.state is not None,
        ])

    def set_metadata(self, key: str, value: Any) -> None:
        """Установить произвольные метаданные контекста."""
        self._metadata[key] = value

    def get_metadata(self, key: str, default: Any = None) -> Any:
        return self._metadata.get(key, default)
