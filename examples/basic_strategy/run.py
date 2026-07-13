"""
Basic Strategy Demo — как создать и зарегистрировать стратегию.

Два API-уровня:
  Level 1 — strategies.base.BaseStrategy (основной, V2)
  Level 2 — screener_sdk.BaseStrategy (абстрактный слой, V3)

Как запустить:
    cd examples/basic_strategy
    python run.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


async def main():
    print("=" * 55)
    print("Basic Strategy Demo")
    print("=" * 55)

    print()
    print("Level 1 — strategies.base.BaseStrategy (основной)")
    print("-" * 45)
    print("""
    from strategies.base import BaseStrategy, StrategyMeta
    from strategies import register_strategy

    @register_strategy(
        name="rsi-demo",
        description="RSI Mean Reversion",
        category="reversal",
        min_score=40,
        cooldown=180,
        timeframes=["5m", "15m"],
    )
    class RSIStrategy(BaseStrategy):
        '''Simple RSI mean-reversion strategy.'''

        OVERSOLD = 30
        OVERBOUGHT = 70

        async def analyze(self, ctx):
            rsi = ctx.get_feature("rsi.14")
            if rsi is None:
                return None
            if rsi < self.OVERSOLD:
                return ctx.signal(direction="long", score=75,
                                  confidence=70 + self.OVERSOLD - rsi)
            if rsi > self.OVERBOUGHT:
                return ctx.signal(direction="short", score=75,
                                  confidence=70 + rsi - self.OVERBOUGHT)
            return None
    """)

    print()
    print("Level 2 — screener_sdk.BaseStrategy (абстракция)")
    print("-" * 45)
    print("""
    from screener_sdk import (
        BaseStrategy, StrategyContext,
        Signal, SignalBundle, SignalDirection,
    )

    class RSIStrategySDK(BaseStrategy):
        '''SDK-level strategy.'''

        async def analyze(self, symbol, context):
            rsi = context.get_feature("rsi.14")
            if rsi is None or rsi < 30:
                return None
            return SignalBundle(
                strategy=self.name,
                signals=[Signal(
                    direction=SignalDirection.LONG,
                    score=75,
                    confidence=70,
                    symbol=symbol,
                    entry=context.price,
                )],
                timestamp=context.timestamp
            )
    """)

    print()
    print("Регистрация и запуск")
    print("-" * 45)
    print("""
    # Option 1: Through StrategyEngine
    from core.strategy.engine import StrategyEngine
    engine = StrategyEngine()
    await engine.start_all()

    # Option 2: Backtesting
    python run_backtest.py --strategy rsi-demo --symbol BTCUSDT --timeframe 15m

    # Option 3: Live trading
    python run_crypto.py --strategies rsi-demo --exchange bybit
    """)

    print()
    print("Ключевые концепции")
    print("-" * 45)
    concepts = [
        ("FeatureStore",    "Strategies read features, not raw market data"),
        ("SignalBundle",    "One analyze() call → multiple Signal objects"),
        ("Cooldown",        "Anti-spam: min seconds between same-signal emits"),
        ("StrategyMeta",    "Decorator-based metadata (name, category, min_score)"),
        ("Context",         "StrategyContext wraps features + market state + timestamp"),
    ]
    for concept, desc in concepts:
        print(f"  {concept:<16s}  {desc}")

    print()
    print("✅ Basic Strategy Demo complete")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
