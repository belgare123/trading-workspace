"""
Replay Demo — воспроизведение исторических рыночных данных для бэктестов.

Демонстрирует:
  - Загрузку данных из CSV/Parquet
  - Конфигурацию реплея (скорость, breakpoints, snapshots)
  - Паблиш в EventBus для остальных компонентов системы
  - Интеграцию с Quality Engine и Decision Engine

Как запустить:
    cd examples/replay_demo
    python run.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


async def main():
    print("=" * 55)
    print("Market Replay Demo")
    print("=" * 55)

    print()
    print("1️⃣  Загрузка данных")
    print("-" * 45)
    print("""
    from core.replay.engine import ReplayEngine
    from core.replay.models import ReplayManifest, ReplayPackage

    engine = ReplayEngine()

    # From Parquet (preferred)
    manifest = engine.load(
        path="data/historical/bybit_BTCUSDT_1h.parquet",
        stream_type="candle",
    )
    # Or packaged replay
    pkg = ReplayPackage.from_directory("replays/btc-30d")
    engine.load_package(pkg)
    """)

    print()
    print("2️⃣  Управление воспроизведением")
    print("-" * 45)
    print("""
    # Basic controls
    await engine.start()          # Start replay
    engine.pause()                # Pause
    engine.resume()               # Resume
    engine.toggle_pause()         # Toggle pause
    engine.stop()                 # Stop

    # Advanced
    engine.seek(500)              # Jump to tick 500
    engine.set_speed(50)          # 50× realtime
    await engine.run_step(10)     # Advance exactly 10 ticks

    # Status
    print(engine.progress())      # {tick, total, elapsed, speed}
    print(engine.is_running)      # bool
    print(engine.events_processed)# int
    """)

    print()
    print("3️⃣  Data format")
    print("-" * 45)
    print("""
    # Parquet schema (required columns):
    #   timestamp, open, high, low, close, volume

    # Directory structure:
    #   data/historical/
    #   ├── bybit_BTCUSDT_1h.parquet
    #   ├── bybit_ETHUSDT_1h.parquet
    #   └── binance_BTCUSDT_15m.parquet
    """)

    print()
    print("4️⃣  Integration points")
    print("-" * 45)
    integrations = [
        ("EventBus",          "OHLCV events → FeatureEngine → StrategyEngine"),
        ("Feature Engine",    "Calculators update features on each candle"),
        ("Strategy Engine",   "Periodic analyze() with current snapshot"),
        ("Decision Engine",   "Signals → Opportunities on candle close"),
        ("Quality Engine",    "Performance metrics per replay run"),
        ("Snapshot System",   "Serializes full state for crash recovery"),
    ]
    for comp, desc in integrations:
        print(f"  → {comp:<18s}  {desc}")

    print()
    print("5️⃣  Typical workflow")
    print("-" * 45)
    print("""
    # 1. Load data
    engine = ReplayEngine()
    manifest = engine.load("data/historical/bybit_BTCUSDT_1h.parquet")

    # 2. Attach listeners
    engine.on("candle", feature_engine._on_event)
    engine.on("candle", strategy_engine._on_candle)
    engine.on("candle", quality_engine._on_candle)

    # 3. Run
    await engine.start()
    engine.set_speed(100)

    # 4. Wait for completion
    while engine.is_running:
        await asyncio.sleep(1)
        print(f"Tick {engine.events_processed}")
    """)

    print()
    print("✅ Replay Demo complete")


if __name__ == "__main__":
    asyncio.run(main())
