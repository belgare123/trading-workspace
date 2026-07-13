"""Mock API implementations — встроенные заглушки для тестирования стратегий.

Заменяют реальные FeatureAPI, MarketAPI, StateAPI, ExchangeAPI
на этапе разработки и тестирования.

Вынесены из engine.py при декомпозиции (Step 7).
"""

from __future__ import annotations

import time
from typing import Any


class MockFeatureAPI:
    """Встроенная реализация FeatureAPI для тестов.

    Позволяет тестировать стратегии без FeatureEngine.
    Используется по умолчанию — заменяется реальной реализацией
    через DI container на этапе интеграции.
    """

    def __init__(self, data: dict[str, dict[str, Any]] | None = None) -> None:
        self._data: dict[str, dict[str, Any]] = data or {}
        self._latest: dict[str, dict[str, Any]] = {}

    def _key(self, name: str, symbol: str | None, **params: Any) -> str:
        parts = [name]
        if symbol:
            parts.append(symbol)
        for k, v in sorted(params.items()):
            parts.append(f"{k}={v}")
        return "|".join(parts)

    async def init(self, data: dict[str, dict[str, Any]]) -> None:
        """Загрузить данные (для тестов)."""
        self._data = data

    async def get(
        self,
        name: str,
        symbol: str | None = None,
        **params: Any,
    ) -> Any:
        key = self._key(name, symbol, **params)
        if key in self._data:
            return self._data[key]
        if name in self._data:
            return self._data[name]
        return None

    def latest(self, name: str, symbol: str | None = None) -> Any:
        key = self._key(name, symbol)
        if key in self._latest:
            return self._latest[key]
        return None

    async def get_candles(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        key = f"candles|{symbol}|timeframe={timeframe}"
        if key in self._data:
            return self._data[key][:limit]
        return []

    async def has(self, name: str) -> bool:
        return name in self._data or any(
            k.startswith(f"{name}|") for k in self._data
        )


class MockMarketAPI:
    """Встроенная реализация MarketAPI."""

    def __init__(self) -> None:
        self._prices: dict[str, float] = {}
        self._tickers: dict[str, dict] = {}
        self._volumes: dict[str, float] = {}
        self._volatilities: dict[str, float] = {}

    async def init(
        self,
        prices: dict[str, float] | None = None,
        tickers: dict[str, dict] | None = None,
    ) -> None:
        if prices:
            self._prices.update(prices)
        if tickers:
            self._tickers.update(tickers)

    async def price(self, symbol: str) -> float | None:
        return self._prices.get(symbol)

    async def ticker(self, symbol: str) -> dict[str, Any] | None:
        return self._tickers.get(symbol)

    def volume(self, symbol: str) -> float | None:
        return self._volumes.get(symbol)

    def volatility(self, symbol: str) -> float | None:
        return self._volatilities.get(symbol)


class MockStateAPI:
    """Встроенная реализация StateAPI."""

    def __init__(self) -> None:
        self._state: dict[str, Any] = {}
        self._start_time = time.time()

    def get(self, key: str, default: Any = None) -> Any:
        return self._state.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._state[key] = value

    def increment(self, key: str, delta: int = 1) -> int:
        new = self._state.get(key, 0) + delta
        self._state[key] = new
        return new

    def keys(self) -> list[str]:
        return list(self._state.keys())

    def reset(self) -> None:
        self._state.clear()

    @property
    def uptime(self) -> float:
        return time.time() - self._start_time

    @property
    def signal_count(self) -> int:
        return self._state.get("signal_count", 0)


class MockExchangeAPI:
    """Встроенная реализация ExchangeAPI."""

    def __init__(self, name: str = "mock", mode: str = "paper") -> None:
        self._name = name
        self._mode = mode
        self._limits: dict[str, dict] = {}
        self._trading: dict[str, bool] = {}

    async def name(self) -> str:
        return self._name

    async def is_trading(self, symbol: str) -> bool:
        return self._trading.get(symbol, True)

    def limits(self, symbol: str) -> dict[str, Any]:
        return self._limits.get(symbol, {})

    @property
    def mode(self) -> str:
        return self._mode
