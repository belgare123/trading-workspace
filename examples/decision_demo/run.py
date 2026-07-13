"""
Decision Engine Demo — как сигналы превращаются в торговые решения.

Демонстрирует полный пайплайн:
  Raw Signals → Normalizer → Consensus → Conflict Resolution
  → Confidence Engine → Policy → Opportunity Builder → Events

Как запустить:
    cd examples/decision_demo
    python run.py
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from core.decision.engine import DecisionEngine
from core.decision.confidence import MarketRegime

logger = logging.getLogger(__name__)


async def main():
    logging.basicConfig(level=logging.INFO)

    engine = DecisionEngine()
    price = 50000.0

    # Scenario 1: Consensus (2 LONG signals)
    scenario_1 = {
        "momentum": {
            "symbol": "BTCUSDT",
            "direction": "long",
            "confidence": 85,
            "signals": [{"direction": "long", "confidence": 85, "score": 85}],
        },
        "rsi_strategy": {
            "symbol": "BTCUSDT",
            "direction": "long",
            "confidence": 72,
            "signals": [{"direction": "long", "confidence": 72, "score": 72}],
        },
    }

    # Scenario 2: Conflict (LONG vs SHORT)
    scenario_2 = {
        "momentum": {
            "symbol": "BTCUSDT",
            "direction": "long",
            "confidence": 80,
            "signals": [{"direction": "long", "confidence": 80, "score": 80}],
        },
        "mean_reversion": {
            "symbol": "BTCUSDT",
            "direction": "short",
            "confidence": 75,
            "signals": [{"direction": "short", "confidence": 75, "score": 75}],
        },
    }

    # Scenario 3: Strong consensus
    scenario_3 = {
        "momentum": {
            "symbol": "BTCUSDT",
            "direction": "long",
            "confidence": 92,
            "signals": [{"direction": "long", "confidence": 92, "score": 92}],
        },
        "rsi_strategy": {
            "symbol": "BTCUSDT",
            "direction": "long",
            "confidence": 88,
            "signals": [{"direction": "long", "confidence": 88, "score": 88}],
        },
        "volume_strategy": {
            "symbol": "BTCUSDT",
            "direction": "long",
            "confidence": 78,
            "signals": [{"direction": "long", "confidence": 78, "score": 78}],
        },
    }

    print("=" * 55)
    print("Decision Engine Demo")
    print("=" * 55)

    for idx, signals in enumerate([scenario_1, scenario_2, scenario_3], 1):
        result = engine.process(
            signals,
            current_price=price,
            regime=MarketRegime.TRENDING,
        )

        print(f"\n{idx}. Scenario — {len(signals)} strategies")
        for name, s in signals.items():
            arrow = "🟢 LONG" if s["direction"] == "long" else "🔴 SHORT"
            print(f"     {name:<20s} {arrow}  confidence={s['confidence']}")

        if result.accepted:
            opp = result.opportunity
            arrow = "🟢" if opp.direction == "long" else "🔴"
            print(f"     → Opportunity accepted [{arrow}] confidence={opp.confidence:.0%}")
        else:
            print(f"     → Rejected: {result.reason}")

    print()
    print("=" * 55)
    print("Pipeline stages:")
    print("=" * 55)
    stages = [
        ("Raw Signals",    "Momentum, RSI, Volume, MeanReversion → each strategy outputs Signal"),
        ("Normalizer",     "Maps 0-100 scores from different strategies to comparable scale"),
        ("Consensus",      "Weighted vote: ∑(confidence × weight) / ∑weights"),
        ("Conflict Res.",  "LONG vs SHORT → flip weaker signal or escalate"),
        ("Confidence",     "Adjust for market regime (trending ↔ ranging)"),
        ("Policy",         "Min score thresholds, max concurrent positions"),
        ("Opportunity",    "Builds actionable Opportunity with entry/stop/targets"),
        ("Events",         "Emits DecisionEvent → EventBus → Dashboard/Telegram"),
    ]
    for name, desc in stages:
        print(f"  {name:<16s}  {desc}")


if __name__ == "__main__":
    asyncio.run(main())
