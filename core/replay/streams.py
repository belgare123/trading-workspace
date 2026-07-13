"""
9.3 Multi-Stream Replay — поддержка множества потоков данных.

Replay поддерживает:
  - Candles
  - Trades
  - Ticker
  - Liquidations
  - OrderBook
  - Funding
  - Open Interest
"""

from __future__ import annotations

import logging
import random
from typing import Any

from core.replay.models import ReplayEvent, ReplayStreamType

logger = logging.getLogger(__name__)


def make_candle_event(
    symbol: str,
    timestamp: float,
    open_p: float, high: float, low: float, close: float,
    volume: float,
    timeframe: str = "1m",
) -> ReplayEvent:
    return ReplayEvent(
        timestamp=timestamp,
        stream=ReplayStreamType.CANDLE,
        symbol=symbol,
        data={
            "open": open_p, "high": high, "low": low, "close": close,
            "volume": volume, "timeframe": timeframe,
        },
    )


def make_trade_event(
    symbol: str, timestamp: float, price: float, size: float,
    side: str = "buy",
) -> ReplayEvent:
    return ReplayEvent(
        timestamp=timestamp,
        stream=ReplayStreamType.TRADE,
        symbol=symbol,
        data={"price": price, "size": size, "side": side},
    )


def make_ticker_event(
    symbol: str, timestamp: float, bid: float, ask: float,
    last: float, volume_24h: float = 0.0,
) -> ReplayEvent:
    return ReplayEvent(
        timestamp=timestamp,
        stream=ReplayStreamType.TICKER,
        symbol=symbol,
        data={"bid": bid, "ask": ask, "last": last, "volume_24h": volume_24h},
    )


def make_liquidation_event(
    symbol: str, timestamp: float, price: float, size: float,
    side: str = "short",  # short = long liquidated
) -> ReplayEvent:
    return ReplayEvent(
        timestamp=timestamp,
        stream=ReplayStreamType.LIQUIDATION,
        symbol=symbol,
        data={"price": price, "size": size, "side": side},
    )


def make_orderbook_event(
    symbol: str, timestamp: float,
    bids: list[tuple[float, float]],  # [(price, size), ...]
    asks: list[tuple[float, float]],
    snapshot: bool = True,
) -> ReplayEvent:
    return ReplayEvent(
        timestamp=timestamp,
        stream=ReplayStreamType.ORDER_BOOK,
        symbol=symbol,
        data={"bids": bids, "asks": asks, "snapshot": snapshot},
    )


def make_funding_event(
    symbol: str, timestamp: float,
    rate: float, predicted_rate: float = 0.0,
) -> ReplayEvent:
    return ReplayEvent(
        timestamp=timestamp,
        stream=ReplayStreamType.FUNDING,
        symbol=symbol,
        data={"rate": rate, "predicted_rate": predicted_rate},
    )


def make_open_interest_event(
    symbol: str, timestamp: float,
    oi: float, change_pct: float = 0.0,
) -> ReplayEvent:
    return ReplayEvent(
        timestamp=timestamp,
        stream=ReplayStreamType.OPEN_INTEREST,
        symbol=symbol,
        data={"oi": oi, "change_pct": change_pct},
    )


def generate_demo_events(
    symbol: str = "BTCUSDT",
    count: int = 100,
    start_price: float = 65000.0,
    interval_sec: float = 60.0,
    seed: int = 42,
) -> list[ReplayEvent]:
    """Сгенерировать демо-события для тестирования."""
    rng = random.Random(seed)
    events: list[ReplayEvent] = []
    price = start_price
    base_time = 1700000000.0

    for i in range(count):
        ts = base_time + i * interval_sec
        change = rng.uniform(-0.02, 0.02) * price
        price += change
        price = max(price, 100.0)

        # Candle каждые interval_sec
        events.append(make_candle_event(
            symbol, ts,
            open_p=price - change, high=price * 1.01,
            low=price * 0.99, close=price,
            volume=rng.uniform(100, 1000),
        ))

        # Trade каждые 10 событий
        if i % 10 == 0:
            events.append(make_trade_event(
                symbol, ts + 0.1,
                price=price, size=rng.uniform(0.1, 5.0),
                side=rng.choice(["buy", "sell"]),
            ))

        # Ticker каждые 20
        if i % 20 == 0:
            events.append(make_ticker_event(
                symbol, ts,
                bid=price * 0.999, ask=price * 1.001,
                last=price,
            ))

        # Liquidation каждые 50
        if i % 50 == 0 and i > 0:
            events.append(make_liquidation_event(
                symbol, ts + 0.2,
                price=price * 0.95, size=rng.uniform(1, 10),
                side=rng.choice(["long", "short"]),
            ))

        # OrderBook каждые 30
        if i % 30 == 0:
            events.append(make_orderbook_event(
                symbol, ts,
                bids=[(price * 0.999, rng.uniform(1, 10)) for _ in range(5)],
                asks=[(price * 1.001, rng.uniform(1, 10)) for _ in range(5)],
            ))

        # Funding каждые 60
        if i % 60 == 0 and i > 0:
            events.append(make_funding_event(
                symbol, ts,
                rate=rng.uniform(-0.01, 0.01) / 100,
            ))

        # OI каждые 40
        if i % 40 == 0 and i > 0:
            events.append(make_open_interest_event(
                symbol, ts,
                oi=rng.uniform(10000, 100000),
                change_pct=rng.uniform(-5, 5),
            ))

    events.sort(key=lambda e: e.timestamp)
    return events
