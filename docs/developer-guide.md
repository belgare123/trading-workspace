# Trading Workspace — Developer Guide

## Writing Your First Strategy

This guide walks through creating a trading strategy from scratch.

### Prerequisites

```bash
# Install the platform
pip install -e .

# Verify installation
python -c "from screener_sdk import BaseStrategy; print('SDK OK')"
```

### 1. Project Structure

```
strategies/
└── MyStrategy/
    ├── manifest.yaml      # Strategy metadata
    ├── strategy.py        # Main strategy code
    └── requirements.txt   # (optional) Extra dependencies
```

### 2. Manifest File

`strategies/MyStrategy/manifest.yaml`:

```yaml
name: my-strategy
display_name: "My First Strategy"
version: 1.0.0
description: "A simple momentum strategy example"
author: "Your Name"
license: MIT
strategy_type: momentum
timeframes:
  - 5m
  - 15m
exchanges:
  - bybit
symbols:
  - BTCUSDT
  - ETHUSDT
features:
  required:
    - rsi
    - ema_cross
  optional:
    - volume_profile
```

### 3. Strategy Code

`strategies/MyStrategy/strategy.py`:

```python
"""My First Strategy — a simple momentum example."""

from typing import Any

from screener_sdk import (
    BaseStrategy,
    StrategyContext,
    Signal,
    SignalBundle,
    SignalDirection,
    StrategyDescriptor,
)


class MyStrategy(BaseStrategy):
    """Simple momentum strategy using RSI + EMA cross."""

    @classmethod
    def create(cls, descriptor: StrategyDescriptor) -> "MyStrategy":
        """Factory method — the engine calls this to instantiate the strategy."""
        return cls(descriptor)

    def __init__(self, descriptor: StrategyDescriptor) -> None:
        super().__init__(descriptor)
        # Strategy parameters (configurable via manifest or CLI)
        self.rsi_oversold = 30
        self.rsi_overbought = 70
        self.ema_fast = 9
        self.ema_slow = 21

    async def on_start(self, context: StrategyContext) -> None:
        """Called once when the strategy starts."""
        self.logger.info(f"[{self.name}] Strategy started")

    async def on_stop(self, context: StrategyContext) -> None:
        """Called when the strategy stops."""
        self.logger.info(f"[{self.name}] Strategy stopped")

    async def analyze(
        self,
        symbol: str,
        context: StrategyContext,
    ) -> SignalBundle | None:
        """Main analysis method — called on each candle."""
        # 1. Get required features
        rsi = context.get_feature("rsi")
        ema_fast_val = context.get_feature("ema_9")
        ema_slow_val = context.get_feature("ema_21")
        price = context.price

        if not all([rsi, ema_fast_val, ema_slow_val, price]):
            return None  # Not enough data yet

        # 2. Check conditions
        signals = []
        now = context.timestamp

        # Bullish: RSI oversold + EMA golden cross
        if rsi < self.rsi_oversold and ema_fast_val > ema_slow_val:
            signals.append(Signal(
                symbol=symbol,
                direction=SignalDirection.LONG,
                confidence=0.75,
                price=price,
                timestamp=now,
                source=self.name,
                metadata={
                    "rsi": float(rsi),
                    "reason": "RSI oversold + EMA bullish cross",
                },
            ))

        # Bearish: RSI overbought + EMA death cross
        elif rsi > self.rsi_overbought and ema_fast_val < ema_slow_val:
            signals.append(Signal(
                symbol=symbol,
                direction=SignalDirection.SHORT,
                confidence=0.70,
                price=price,
                timestamp=now,
                source=self.name,
                metadata={
                    "rsi": float(rsi),
                    "reason": "RSI overbought + EMA bearish cross",
                },
            ))

        if not signals:
            return None

        return SignalBundle(
            strategy=self.name,
            symbol=symbol,
            signals=signals,
            timestamp=now,
        )
```

### 4. Install and Test

```bash
# 1. Discover the strategy
python -c "from core.strategy.discovery import DiscoveryEngine; de = DiscoveryEngine(); found = de.discover_path('strategies/MyStrategy'); print(f'Found: {found}')"

# 2. Run a backtest
python run_backtest.py --strategy MyStrategy --symbol BTCUSDT --timeframe 5m --days 30

# 3. Run live (with platform running)
# The strategy will be auto-discovered from strategies/
```

### 5. Package for Marketplace

```bash
# Package your strategy for distribution
tw install my-strategy  # Install from local path

# Or publish (when marketplace supports it)
# tw publish strategies/MyStrategy
```

## Strategy API Reference

### `BaseStrategy`

| Method | Called | Purpose |
|--------|--------|---------|
| `create(descriptor)` | Once | Factory — create strategy instance |
| `on_start(context)` | Once | Setup code (state initialization) |
| `on_stop(context)` | Once | Cleanup code |
| `analyze(symbol, context)` | Per candle | Main analysis — return signals or None |

### `StrategyContext`

Provided to every strategy call. Contains per-symbol market state:

| Property | Returns | Description |
|----------|---------|-------------|
| `symbol` | `str` | Current symbol |
| `price` | `float` | Current price |
| `timestamp` | `float` | Unix timestamp |
| `timeframe` | `str` | Current candle timeframe |
| `candles` | `DataFrame` | Historical candles |
| `get_feature(name)` | `Any` | Computed indicator value |
| `get_profile()` | `MarketProfile` | Session market profile |
| `get_regime()` | `RegimeType` | Current market regime (trending/ranging/volatile) |
| `get_session()` | `SessionType` | Current trading session |

### `Signal` Model

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | `str` | Trading pair |
| `direction` | `SignalDirection` | LONG, SHORT, or NEUTRAL |
| `confidence` | `float` | 0.0–1.0 confidence score |
| `price` | `float` | Entry price |
| `timestamp` | `float` | Signal timestamp |
| `source` | `str` | Strategy name |
| `metadata` | `dict` | Arbitrary strategy-specific data |

### `SignalBundle`

A batch of signals from one strategy for one symbol:

```python
SignalBundle(
    strategy="my-strategy",
    symbol="BTCUSDT",
    signals=[Signal(...), Signal(...)],
    timestamp=1234567890.0,
)
```

## Best Practices

### Do ✅

- **Minimize state** — strategies should be stateless where possible
- **Use features** — let the FeatureEngine compute indicators
- **Return early** — `return None` when conditions don't match
- **Log moderately** — use `self.logger.info()` for meaningful events
- **Name consistently** — use kebab-case for strategy names

### Don't ❌

- **Don't import from `core.*` directly** — use `screener_sdk`
- **Don't store per-candle history** — the platform tracks context
- **Don't make network calls** — strategy must return quickly
- **Don't modify shared state** — strategies run concurrently
- **Don't hardcode symbols** — use manifest or config

## Testing Your Strategy

```bash
# Quick smoke test
python smoke_test.py --strategy MyStrategy

# Full backtest
python run_backtest.py --strategy MyStrategy --days 90 --output results/

# Analyze backtest results
python -c "
import json
with open('results/MyStrategy_BTCUSDT.json') as f:
    data = json.load(f)
print(f'Winrate: {data[\"winrate\"]:.1f}%')
print(f'Profit Factor: {data[\"profit_factor\"]:.2f}')
print(f'Total Trades: {data[\"total_trades\"]}')
"
```

## Next Steps

- Read the [Plugin Guide](plugin-guide.md) to publish your strategy
- Read the [Architecture Guide](architecture-guide.md) for the full picture
- See `examples/` for more strategy patterns
- Run `tw search momentum` to find marketplace packages
