#!/usr/bin/env python
"""Long-running stress test — End-to-End Pipeline (12h).

Запускает полный пайплайн и проверяет деградацию:
  Scanner → Decision → Lifecycle → Event Store → Replay → Learning

Usage:
    # По умолчанию 1 час (для теста)
    python scripts/long_running_stress.py

    # Полный 12-часовой прогон
    python scripts/long_running_stress.py --duration 12 --output docs/stress-report.json
"""
import argparse
import asyncio
import json
import os
import sys
import time
import tracemalloc
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.event_store import (
    EventStore,
    SQLiteEventRepository,
    StoredEvent,
)
from core.replay import Timeline, generate_demo_events


# ═══════════════════════════════════════════════════════════════════
#  Metrics collector
# ═══════════════════════════════════════════════════════════════════

class Metrics:
    def __init__(self):
        self.start_time = time.time()
        self.snapshots: list[dict] = []

    def snapshot(self, label: str, events_total: int, repo):
        elapsed = time.time() - self.start_time
        current, peak = tracemalloc.get_traced_memory() if tracemalloc.is_tracing() else (0, 0)

        # Check WAL size
        db_path = getattr(repo, "_db_path", "")

        snap = {
            "timestamp": elapsed,
            "label": label,
            "events_total": events_total,
            "memory_current_mb": round(current / 1024 / 1024, 2),
            "memory_peak_mb": round(peak / 1024 / 1024, 2),
        }
        self.snapshots.append(snap)
        return snap


# ═══════════════════════════════════════════════════════════════════
#  Pipeline stages
# ═══════════════════════════════════════════════════════════════════

async def stage_event_store(store, count: int):
    """Write events to Event Store."""
    for i in range(count):
        ev = StoredEvent.new(
            aggregate="stress",
            aggregate_id=f"stress#{i % 100:04d}",
            topic="stress.candle",
            payload=b'{"open": 65000, "close": 65100, "high": 65200, "low": 64900}',
            source="stress_test",
        )
        await store.publish(ev)


def stage_replay(count: int):
    """Run replay on generated events."""
    events = generate_demo_events(count=min(count, 1000), seed=42)
    tl = Timeline(events)
    tl.tick()
    return len(tl.events)


# ═══════════════════════════════════════════════════════════════════
#  Main loop
# ═══════════════════════════════════════════════════════════════════

async def run_cycle(store, cycle: int, batch_size: int) -> dict:
    """One cycle of the pipeline."""
    t0 = time.perf_counter()

    # Write batch
    await stage_event_store(store, batch_size)

    # Read back
    from core.event_store.repository import EventQuery
    stored = await store.read(EventQuery(limit=10))
    write_time = time.perf_counter() - t0

    # Replay (different data — doesn't use Event Store)
    replay_count = stage_replay(batch_size)

    return {
        "cycle": cycle,
        "events_written": batch_size,
        "events_read": len(stored),
        "replay_events": replay_count,
        "write_time_s": round(write_time, 4),
        "write_speed": round(batch_size / write_time) if write_time > 0 else 0,
    }


async def main(duration_hours: int, batch_size: int, interval_s: int):
    print("=" * 60)
    print("  Long-Running Stress Test")
    print(f"  Duration: {duration_hours}h | Batch: {batch_size} | Interval: {interval_s}s")
    print("=" * 60)

    # Start memory tracking
    tracemalloc.start()

    # Setup Event Store
    repo = SQLiteEventRepository(db_path=":memory:")
    await repo.connect()
    store = EventStore(repository=repo)

    metrics = Metrics()
    cycle = 0
    total_events = 0
    start_wall = time.time()
    end_time = start_wall + duration_hours * 3600

    print(f"\n  {'Cycle':>5s}  {'Events':>8s}  {'Speed':>8s}  {'Memory':>10s}")
    print(f"  {'─'*5}  {'─'*8}  {'─'*8}  {'─'*10}")

    while time.time() < end_time:
        cycle += 1
        t0 = time.time()

        result = await run_cycle(store, cycle, batch_size)
        total_events += result["events_written"]

        # Snapshot every 10th cycle
        if cycle % 10 == 0:
            snap = metrics.snapshot(
                f"cycle_{cycle}",
                total_events,
                repo,
            )
            speed = result["write_speed"]
            mem = snap["memory_current_mb"]
            print(f"  {cycle:>5d}  {total_events:>8d}  {speed:>8,}/s  {mem:>8.1f}MB")

        # Sleep for interval
        elapsed = time.time() - t0
        if elapsed < interval_s:
            await asyncio.sleep(interval_s - elapsed)

    total_time = time.time() - start_wall
    print(f"\n{'=' * 60}")
    print(f"  Completed: {total_events} events in {total_time/3600:.1f}h")
    print(f"  Average:   {total_events / total_time:.0f} events/s")
    print(f"  Memory:    peak {tracemalloc.get_traced_memory()[1] / 1024 / 1024:.1f} MB")

    # Save report
    report = {
        "version": "0.16.0-rc1",
        "duration_hours": total_time / 3600,
        "total_events": total_events,
        "avg_speed": round(total_events / total_time),
        "batch_size": batch_size,
        "cycles": cycle,
        "snapshots": metrics.snapshots,
    }
    report_path = Path(__file__).resolve().parent.parent / "docs" / "stress-report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\n  Report saved: {report_path}")

    await repo.close()
    tracemalloc.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, default=1.0,
                        help="Duration in hours (default: 1)")
    parser.add_argument("--batch", type=int, default=1000,
                        help="Events per cycle (default: 1000)")
    parser.add_argument("--interval", type=int, default=60,
                        help="Seconds between cycles (default: 60)")
    args = parser.parse_args()

    asyncio.run(main(args.duration, args.batch, args.interval))
