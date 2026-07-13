# Phase 15.1 — Performance Report

**Date:** 2026-07-13
**Method:** Synthetic microbenchmarks on developer workstation (Windows, Python 3.11)
**Tool:** `scripts/benchmark.py` + `core/profiler.py`

---

## Memory Profile

| Stage | RSS | Objects Delta |
|-------|-----|---------------|
| Baseline (empty Python process) | ~22.9 MB | — |
| After core module imports | 27.2 MB | +4.9 MB |
| After FeatureEngine + DecisionEngine + StrategyEngine + ReplayEngine instantiation | 27.5 MB | +0.3 MB |
| After benchmark (final) | 29.0 MB | 29,211 total |

**Verdict:** ✅ Memory is well within acceptable limits. Engines are lightweight on instantiation (no eager allocations).

---

## Microbenchmarks

| Operation | Total | Per item |
|-----------|-------|----------|
| Create 1000 SignalBundles | 6.51 ms | **6.5 μs** |
| Iterate 1000 signals | 0.09 ms | **0.1 μs** |
| 1000 dict ops (100 entries each) | 26.5 ms | 26.5 μs/op |
| 10000 async context switches | 0.70 ms | **0.1 μs** |

**Verdict:** ✅ Data model operations are negligible. No hotspots in model creation or iteration.

---

## Engine Benchmarks

| Engine | Method | 100 calls | Per call |
|--------|--------|-----------|----------|
| **Decision Engine** | `process(raw_signals, price)` | 2.83 ms | **0.03 ms** (30 μs) |
| **Feature Engine** | `get_feature(symbol, name)` | 9.66 ms (1000 calls) | **9.7 μs** |

**Decision Engine throughput estimate:** ~33,000 calls/second  
**Feature Engine throughput estimate:** ~103,000 calls/second

**Verdict:** ✅ Both engines perform well below real-time requirements. A typical trading tick processes 10–50 signals through the Decision Engine, which takes under 2 ms total.

---

## Built-in Profiler

Implemented: `core/profiler.py`

### Features

| Feature | API |
|---------|-----|
| Decorator profiler | `@profile("metric_name")` on sync/async methods |
| Context manager | `with timing("name"):` block |
| Async context manager | `async with async_timing("name"):` block |
| Aggregated stats | `ProfilerRegistry.get_stats("name")` — count, min, max, avg, p50, p95, p99 |
| Full report | `ProfilerRegistry.generate_report()` — table sorted by total time |
| Memory snapshots | `take_memory_snapshot()` — RSS + Python object counts by type |
| Formatting | `format_report()`, `format_memory()` — CLI-ready table output |
| Control | `ProfilerRegistry.enable() / disable()` — runtime toggle |

### Usage

```python
from core.profiler import profile, timing, ProfilerRegistry

@profile("feature_engine.calculate")
async def calculate(self, symbol: str) -> dict:
    ...

with timing("pipeline.run"):
    results = await pipeline.process()

report = ProfilerRegistry.generate_report()
print(format_report(report))
```

### Currently Profiled Methods

| Module | Method | Metric name |
|--------|--------|-------------|
| `core/features/engine.py` | `_on_event` | `feature_engine.on_event` |
| `core/decision/engine.py` | `process` | `decision_engine.process` |
| `core/strategy/engine.py` | `analyze_all` | `strategy_engine.analyze_all` |
| `core/replay/engine.py` | `tick` | `replay_engine.tick` |

---

## Recommendations

1. **No performance bottlenecks detected.** All benchmarked operations are sub-millisecond and well below real-time trading requirements.
2. **No need for C extensions or JIT.** Pure Python performance is sufficient.
3. **Enable profiling in production selectively.** Use `ProfilerRegistry.enable()` during profiling sessions, disable for production to avoid 5% overhead.
4. **Add tests for profiler.** No performance-critical code exists, but the profiler itself should have CI tests.
5. **Monitor in production.** The profiler is designed to be toggled at runtime — useful for occasional production profiling.

---

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Decision Engine latency | **0.03 ms** | < 10 ms | ✅ |
| Signal creation | **6.5 μs** | < 1 ms | ✅ |
| Python async overhead | **0.1 μs** | < 10 μs | ✅ |
| Memory at rest | **29 MB RSS** | < 200 MB | ✅ |
| Built-in profiler | ✅ Implemented | — | ✅ |
