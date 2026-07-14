#!/usr/bin/env python
"""Performance Baseline — замер ключевых метрик платформы.

Сохраняет результат в docs/performance-baseline.json
для сравнения с будущими версиями.

Usage:
    python scripts/performance_baseline.py
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.event_store import (
    AggregateRepository,
    EventStore,
    SQLiteEventRepository,
    StoredEvent,
)
from core.event_store.repository import EventQuery
from core.replay import Timeline, generate_demo_events


# ═══════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════

def _make_store():
    repo = SQLiteEventRepository(db_path=":memory:")
    asyncio.run(repo.connect())
    return repo, EventStore(repository=repo)


async def _publish_single(store, i: int) -> None:
    ev = StoredEvent.new(
        aggregate="perf",
        aggregate_id=f"perf#{i:04d}",
        topic="perf.test",
        payload=b"{}",
        source="baseline",
    )
    await store.publish(ev)


def measure(label: str, fn, iterations: int = 1, warmup: int = 1) -> dict:
    for _ in range(warmup):
        fn()
    times = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        fn()
        t1 = time.perf_counter()
        times.append(t1 - t0)
    avg = sum(times) / len(times)
    return {
        "label": label,
        "iterations": iterations,
        "avg_s": round(avg, 6),
        "min_s": round(min(times), 6),
        "max_s": round(max(times), 6),
        "ops_per_sec": round(1.0 / avg) if avg > 0 else 0,
    }


# ═══════════════════════════════════════════════════════════════════
#  Metrics
# ═══════════════════════════════════════════════════════════════════

def metric_event_append() -> dict:
    repo, store = _make_store()
    i = [0]

    def do_append():
        asyncio.run(_publish_single(store, i[0]))
        i[0] += 1

    result = measure("event_append", do_append, iterations=200, warmup=50)
    asyncio.run(repo.close())
    return result


def metric_concurrent_batch() -> dict:
    repo, store = _make_store()

    async def do_batch():
        coros = [
            _publish_single(store, j) for j in range(100)
        ]
        t0 = time.perf_counter()
        await asyncio.gather(*coros)
        return time.perf_counter() - t0

    async def run():
        times = []
        for _ in range(10):
            t = await do_batch()
            times.append(t)
        avg = sum(times) / len(times)
        return {
            "label": "concurrent_append_100",
            "iterations": 10,
            "avg_s": round(avg, 6),
            "ops_per_sec": round(100.0 / avg),
        }

    result = asyncio.run(run())
    asyncio.run(repo.close())
    return result


def metric_replay_throughput() -> dict:
    events = generate_demo_events(count=1000, seed=42)
    tl = Timeline(events)

    def do_tick():
        tl.reset()
        tl.tick()

    result = measure("replay_throughput_1000", do_tick, iterations=20, warmup=3)
    return result


def metric_aggregate_restore() -> dict:
    repo, store = _make_store()
    agg_repo = AggregateRepository(store)

    async def setup():
        for ver in range(1, 50):
            ev = StoredEvent.new(
                aggregate="perf_agg",
                aggregate_id="perf_agg#1",
                topic="perf.agg",
                payload=b'{"seq":' + str(ver).encode() + b"}",
                source="baseline",
            )
            await store.publish(ev)

    asyncio.run(setup())

    async def do_restore():
        stream = await agg_repo.load("perf_agg", "perf_agg#1")
        return stream

    def restore_sync():
        asyncio.run(do_restore())

    result = measure("aggregate_restore_50", restore_sync, iterations=20, warmup=5)
    asyncio.run(repo.close())
    return result


def metric_trace_build() -> dict:
    repo, store = _make_store()

    async def setup():
        corr_id = "trace_perf"
        for i in range(50):
            ev = StoredEvent.new(
                aggregate="perf_trace",
                aggregate_id="perf_trace#1",
                topic="perf.trace",
                payload=b"{}",
                source="baseline",
                correlation_id=corr_id,
            )
            store.publish_sync(ev)

    asyncio.run(setup())

    async def do_trace():
        return await store.read(
            EventQuery(correlation_id="trace_perf")
        )

    def trace_sync():
        asyncio.run(do_trace())

    result = measure("trace_build_50", trace_sync, iterations=20, warmup=5)
    asyncio.run(repo.close())
    return result


# ═══════════════════════════════════════════════════════════════════
#  Run
# ═══════════════════════════════════════════════════════════════════

def main():
    print("=" * 55)
    print("  Performance Baseline — Trading Workspace v0.15.0")
    print("=" * 55)

    results = []
    for fn in [
        metric_event_append,
        metric_concurrent_batch,
        metric_replay_throughput,
        metric_aggregate_restore,
        metric_trace_build,
    ]:
        print(f"\n→ {fn.__name__} ...", end=" ", flush=True)
        try:
            r = fn()
            results.append(r)
            print(f"{r.get('ops_per_sec', '-')} ops/s  (avg {r.get('avg_s', '-')}s)")
        except Exception as e:
            print(f"FAILED: {e}")
            results.append({"label": fn.__name__, "error": str(e)})

    baseline = {
        "version": "0.15.0",
        "timestamp": time.time(),
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "metrics": results,
    }

    path = Path(__file__).resolve().parents[1] / "docs" / "performance-baseline.json"
    path.write_text(json.dumps(baseline, indent=2, ensure_ascii=False))
    print(f"\n{'=' * 55}")
    print(f"  Saved to docs/performance-baseline.json")
    print(f"  {sum(1 for r in results if 'error' not in r)}/{len(results)} metrics OK")
    print(f"{'=' * 55}")


if __name__ == "__main__":
    main()
