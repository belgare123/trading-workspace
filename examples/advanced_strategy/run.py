"""
Advanced Strategy Demo — многосигнальная стратегия, FeatureGraph, Dynamic режим.

Демонстрирует:
  - Стратегию с 5+ фичами и несколькими сигналами
  - FeatureGraph: явные зависимости между фичами
  - Dynamic режим (lazy feature registration)
  - Marketplace-упаковка готовой стратегии

Как запустить:
    cd examples/advanced_strategy
    python run.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


async def main():
    print("=" * 55)
    print("Advanced Strategy Demo")
    print("=" * 55)

    print()
    print("1. Полный код стратегии")
    print("-" * 45)
    print("""
    from strategies.base import BaseStrategy, StrategyMeta
    from strategies import register_strategy

    @register_strategy(
        name="advanced-momentum",
        description="Многосигнальный momentum (EMA + RSI + Volume + ATR)",
        category="momentum",
        min_score=50,
        cooldown=120,
        timeframes=["5m", "15m", "1h"],
    )
    class AdvancedMomentumStrategy(BaseStrategy):
        \"\"\"Multi-signal momentum: EMA crossover + RSI filter + volume confirmation.\"\"\"

        FAST_EMA = 9
        SLOW_EMA = 21
        VOLUME_FACTOR = 1.5
        RSI_LOWER = 40
        RSI_UPPER = 60

        async def analyze(self, ctx):
            features = {
                "rsi":       ctx.get_feature("rsi.14"),
                "ema_fast":  ctx.get_feature(f"ema.{self.FAST_EMA}"),
                "ema_slow":  ctx.get_feature(f"ema.{self.SLOW_EMA}"),
                "volume":    ctx.get_feature("volume_ratio"),
                "atr":       ctx.get_feature("atr.14"),
            }
            if any(v is None for v in features.values()):
                return None

            rsi, ema_fast, ema_slow, volume, atr = features.values()
            price = ctx.price

            # Signal 1: Golden cross + volume
            if ema_fast > ema_slow and volume > self.VOLUME_FACTOR \\
               and self.RSI_LOWER < rsi < self.RSI_UPPER:
                confidence = min(85, 60 + (volume - 1.0) * 20)
                return ctx.signal(
                    direction="long",
                    score=confidence,
                    confidence=confidence,
                    metadata={"features": list(features.keys())},
                )

            return None
    """)

    print()
    print("2. FeatureGraph — явные зависимости")
    print("-" * 45)
    print("""
    from core.features.graph import FeatureGraph

    graph = FeatureGraph()
    graph.add_node("ema.9",        depends_on=["ohlc.close"])
    graph.add_node("ema.21",       depends_on=["ohlc.close"])
    graph.add_node("rsi.14",       depends_on=["ohlc.close"])
    graph.add_node("volume_ratio", depends_on=["ohlc.volume"])
    graph.add_node("atr.14",       depends_on=["ohlc.high", "ohlc.low", "ohlc.close"])

    # Topological sort → optimal calculation order
    order = graph.resolve_order()
    # → ["ohlc.close", "ohlc.volume", "ohlc.high", "ohlc.low",
    #     "ema.9", "ema.21", "rsi.14", "volume_ratio", "atr.14"]
    """)

    print()
    print("3. Dynamic Feature Registration")
    print("-" * 45)
    print("""
    class AdaptiveStrategy(BaseStrategy):
        async def on_start(self, ctx):
            ctx.features.require("rsi.14")
            ctx.features.require("ema.9")
            ctx.features.require("ema.21")

        async def analyze(self, ctx):
            if ctx.symbol == "BTCUSDT":
                ctx.features.require("btc_dominance")

            features = {name: ctx.get_feature(name)
                       for name in ctx.features.registered}
            ...
    """)

    print()
    print("4. Marketplace Packaging")
    print("-" * 45)
    print("""
    # Package as workspace plugin:
    tw package create advanced-momentum --version 2.1.0 --type strategy

    # Install from package:
    tw install advanced-momentum

    # Install from source directory:
    tw install ./examples/advanced_strategy
    """)

    print()
    print("✅ Advanced Strategy Demo complete")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
