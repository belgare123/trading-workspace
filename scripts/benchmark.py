#!/usr/bin/env python
"""Performance benchmark — measure latency of core engines."""

import asyncio
import sys
import os
import time
import gc

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.profiler import (
    ProfilerRegistry,
    format_report,
    take_memory_snapshot,
    format_memory,
)


async def main():
    ProfilerRegistry.enable()
    ProfilerRegistry.reset()
    
    # 1. Memory baseline
    gc.collect()
    snap0 = take_memory_snapshot()
    
    # 2. Import core modules (lazy)  
    from core.features.engine import FeatureEngine
    from core.decision.engine import DecisionEngine
    from core.strategy.engine import StrategyEngine
    from core.replay.engine import ReplayEngine
    
    snap1 = take_memory_snapshot()
    print("=" * 60)
    print("MEMORY: After imports")
    print("=" * 60)
    print(f"    RSS:      {snap0.rss_mb:>8.1f} MB → {snap1.rss_mb:>8.1f} MB  ({snap1.rss_mb - snap0.rss_mb:+.1f} MB)")
    print(f"    Objects:  {snap0.objects_total:>8,} → {snap1.objects_total:>8,}  ({snap1.objects_total - snap0.objects_total:+4,})")
    
    # 3. Instantiate engines
    fe = FeatureEngine()
    de = DecisionEngine()
    se = StrategyEngine()
    re = ReplayEngine()
    
    snap2 = take_memory_snapshot()
    print()
    print("=" * 60)
    print("MEMORY: After engine instantiation")
    print("=" * 60)
    print(f"    RSS:      {snap1.rss_mb:>8.1f} MB → {snap2.rss_mb:>8.1f} MB  ({snap2.rss_mb - snap1.rss_mb:+.1f} MB)")
    print(f"    Objects:  {snap1.objects_total:>8,} → {snap2.objects_total:>8,}  ({snap2.objects_total - snap1.objects_total:+4,})")
    
    # 4. Microbenchmarks (synthetic operations)
    print()
    print("=" * 60)
    print("MICROBENCHMARKS")
    print("=" * 60)
    
    # 4a. Signal processing simulation
    from core.strategy.signal import Signal, SignalBundle
    from screener_sdk import SignalDirection
    from datetime import datetime, timezone
    from uuid import uuid4
    
    n_signals = 1000
    t0 = time.perf_counter()
    
    signals = []
    for i in range(n_signals):
        s = Signal(
            symbol="BTCUSDT",
            direction=SignalDirection.LONG if i % 2 == 0 else SignalDirection.SHORT,
            score=75,
            confidence=75.0,
            entry=50000.0 + i,
            strategy="test_strat",
            timestamp=datetime.now(timezone.utc),
            metadata={"idx": i, "uuid": str(uuid4())},
        )
        bundle = SignalBundle(
            strategy="test_strat",
            signals=[s],
            timestamp=datetime.now(timezone.utc),
        )
        signals.append(bundle)
    
    t1 = time.perf_counter()
    avg_us = ((t1 - t0) / n_signals) * 1000000
    print(f"  Create {n_signals} SignalBundles:    {(t1-t0)*1000:.2f} ms  ({avg_us:.1f} μs each)")
    
    # 4b. Signal iteration
    t0 = time.perf_counter()
    count = 0
    for bundle in signals:
        for sig in bundle.signals:
            _ = sig.score * sig.entry if sig.entry else 0
            count += 1
    t1 = time.perf_counter()
    avg_us = ((t1 - t0) / count) * 1000000
    print(f"  Iterate {count} signals:            {(t1-t0)*1000:.2f} ms  ({avg_us:.1f} μs each)")
    
    # 4c. Dict operations (feature-like)
    t0 = time.perf_counter()
    feature_cache: dict[str, float] = {}
    for i in range(1000):
        for j in range(100):
            key = f"feature.{i}.{j}"
            feature_cache[key] = float(i * j)
        feature_cache.clear()
    t1 = time.perf_counter()
    print(f"  1000 dict ops (100 entries each):  {(t1-t0)*1000:.1f} ms  ({((t1-t0)/1000)*1000:.1f} μs/batch)")
    
    # 4d. Async overhead
    n_coro = 10000
    
    async def noop():
        return 1
    
    t0 = time.perf_counter()
    for _ in range(n_coro):
        await noop()
    t1 = time.perf_counter()
    print(f"  {n_coro} async await:                   {(t1-t0)*1000:.2f} ms  ({((t1-t0)/n_coro)*1000000:.1f} μs each)")
    
    # 5. Decision engine process benchmark (direct calls)
    print()
    print("=" * 60)
    print("DECISION ENGINE (direct method calls)")
    print("=" * 60)
    
    # Test without profiler noise for decision engine
    ProfilerRegistry.disable()
    
    t0 = time.perf_counter()
    n_batches = 100
    
    for i in range(n_batches):
        raw = {
            f"strategy_{i}": {
                "symbol": "BTCUSDT",
                "signals": [{"direction": "long", "confidence": 75 + (i % 25), "score": 75}],
                "direction": "long",
                "confidence": 75 + (i % 25),
            }
        }
        result = de.process(raw, current_price=50000.0 + i)
    
    t1 = time.perf_counter()
    print(f"  {n_batches} decision.process() calls:  {(t1-t0)*1000:.2f} ms  ({((t1-t0)/n_batches)*1000:.2f} ms each)")
    
    # 6. Feature engine - feature retrieval simulation
    print()
    print("=" * 60)
    print("FEATURE ENGINE (get_feature calls)")
    print("=" * 60)
    
    ProfilerRegistry.enable()
    
    t0 = time.perf_counter()
    for i in range(1000):
        _ = fe.get_feature("BTCUSDT", "rsi.14")
    t1 = time.perf_counter()
    avg_us = ((t1 - t0) / 1000) * 1000000
    print(f"  1000 get_feature() calls:          {(t1-t0)*1000:.2f} ms  ({avg_us:.1f} μs each)")
    
    # 7. Profiler report
    print()
    print("=" * 60)
    print("PROFILER REPORT")
    print("=" * 60)
    print()
    report = ProfilerRegistry.generate_report()
    if report:
        print(format_report(report))
    else:
        print("  (No profiled operations recorded — live profiling needs engine startup)")
    
    # 8. Final memory
    snap3 = take_memory_snapshot()
    print()
    print("=" * 60)
    print("MEMORY: Final")
    print("=" * 60)
    print(f"    RSS:      {snap3.rss_mb:.1f} MB")
    print(f"    Objects:  {snap3.objects_total:,}")
    print("\nTop types:")
    for i, (t, c) in enumerate(sorted(snap3.objects_by_type.items(), key=lambda x: -x[1])[:10], 1):
        print(f"    {i:2d}. {t:<30s} {c:>8,}")
    
    print()
    print("=" * 60)
    print("BENCHMARK COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
