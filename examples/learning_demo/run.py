"""
Learning Demo — адаптивное обучение стратегий на исторических данных.

Демонстрирует:
  - Hyperopt (Optuna) — оптимизация параметров
  - Режим обучения на Replay Data
  - Сохранение/загрузка лучших параметров
  - A/B тестирование стратегий

Как запустить:
    cd examples/learning_demo
    python run.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


async def main():
    print("=" * 55)
    print("Learning Demo — Adaptive Strategy Optimization")
    print("=" * 55)

    print()
    print("1️⃣  Hyperopt (Optuna)")
    print("-" * 40)
    print()
    print("   python run_hyperopt.py \\")
    print("       --strategy momentum \\")
    print("       --symbol BTCUSDT \\")
    print("       --timeframe 1h \\")
    print("       --trials 500 \\")
    print("       --study-name \"momentum-v2-optimization\"")
    print()
    print("   # With custom param grid:")
    print("   python run_hyperopt.py \\")
    print('       --strategy-params \'{"rsi_period": {"type": "int", "low": 7, "high": 28}}\' \\')
    print("       --parallel 4")
    print()

    print("2️⃣  Training Mode (on Replay Data)")
    print("-" * 40)
    print()
    print("   # Train on 60 days, validate on 30 days:")
    print("   python run_hyperopt.py \\")
    print("       --strategy momentum \\")
    print("       --train-range 60d \\")
    print("       --val-range 30d \\")
    print("       --metric sharpe_ratio \\")
    print("       --direction maximize")
    print()
    print("   # Walk-forward optimization:")
    print("   python run_hyperopt.py \\")
    print("       --walk-forward \\")
    print("       --window 30d \\")
    print("       --step 7d")
    print()

    print("3️⃣  Best Parameters Persistence")
    print("-" * 40)
    print()
    print("   # Parameters are saved to SQLite:")
    print("   hyperopt_results/")
    print("   ├── momentum-v2-optimization.db")
    print("   ├── momentum-v2-optimization_best.json")
    print("   └── momentum-v2-optimization_trials.csv")
    print()
    print("   # Load best params into strategy:")
    print("   python run_backtest.py \\")
    print('       --strategy momentum-v2 \\')
    print('       --strategy-params @hyperopt_results/momentum-v2-optimization_best.json')
    print()

    print("4️⃣  A/B Testing")
    print("-" * 40)
    print()
    print("   python ab_test.py \\")
    print("       --strategy-A momentum-v1 \\")
    print("       --strategy-B momentum-v2 \\")
    print("       --symbol BTCUSDT \\")
    print("       --timeframe 1h \\")
    print("       --period 90d \\")
    print("       --output ab_test_report.html")
    print()

    print("5️⃣  Available Optimizable Strategies")
    print("-" * 40)
    print()
    strategies = [
        ("rsi_strategy",    "RSI mean-reversion",   {"rsi_period", "oversold", "overbought"}),
        ("momentum",        "EMA momentum",          {"fast_ema", "slow_ema", "volume_factor"}),
        ("ichimoku",        "Ichimoku cloud",        {"tenkan", "kijun", "senkou_b"}),
        ("adaptive_ma",    "Adaptive MA",            {"lookback", "sensitivity", "filter"}),
    ]
    for name, desc, params in strategies:
        print(f"   {name:<16s}  {desc}")
        print(f"   {'':16s}  Params: {', '.join(sorted(params))}")
        print()
    print()
    print("=" * 55)
    print("✅ Learning subsystem operational")
    print("=" * 55)


if __name__ == "__main__":
    asyncio.run(main())
