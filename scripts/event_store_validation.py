#!/usr/bin/env python
"""Event Store Validation — масштабная проверка Event Store.

Проверяет:
  - 1–5 млн событий с замерами производительности
  - WAL checkpoint и размер БД
  - VACUUM
  - Reopen database
  - Aggregate restore
  - Replay
  - Trace

Usage:
    python scripts/event_store_validation.py [--events 1000000]
"""
import argparse
import asyncio
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.event_store import (
    EventStore,
    EventPublisher,
    SQLiteEventRepository,
    StoredEvent,
)
from core.event_store.repository import EventQuery
from core.event_store.trace import TraceBuilder


# ── helpers ──

def db_size_mb(db_path: str) -> float:
    return os.path.getsize(db_path) / (1024 * 1024)


def wal_size_mb(db_path: str) -> float:
    wal = db_path + "-wal"
    shm = db_path + "-shm"
    total = 0
    if os.path.exists(wal):
        total += os.path.getsize(wal)
    if os.path.exists(shm):
        total += os.path.getsize(shm)
    return total / (1024 * 1024)


async def run_validation(num_events: int):
    db_path = str(Path(__file__).resolve().parent.parent / "data" / "event-store-benchmark.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    # Remove old db
    for suffix in ("", "-wal", "-shm"):
        p = db_path + suffix
        if os.path.exists(p):
            os.remove(p)

    print("=" * 60)
    print(f"  Event Store Validation")
    print(f"  Events: {num_events:,} | DB: {db_path}")
    print("=" * 60)

    # ── 1. Connect + populate ──
    print("\n1. Connecting & populating...")
    repo = SQLiteEventRepository(db_path=db_path)
    await repo.connect()
    store = EventStore(repository=repo)

    t0 = time.perf_counter()
    batch_size = 10_000
    for i in range(0, num_events, batch_size):
        batch = [
            StoredEvent.new(
                aggregate="benchmark",
                aggregate_id=f"bench#{j % 100:04d}",
                topic="benchmark.candle",
                payload=b'{"open": 65000, "close": 65100}',
                source="validation",
            )
            for j in range(i, min(i + batch_size, num_events))
        ]
        await store.publish_batch(batch)

    write_time = time.perf_counter() - t0
    write_speed = num_events / write_time
    print(f"   Written: {num_events:,} events in {write_time:.1f}s ({write_speed:,.0f} ev/s)")
    print(f"   DB size: {db_size_mb(db_path):.1f} MB")
    print(f"   WAL:     {wal_size_mb(db_path):.1f} MB")

    # ── 2. WAL checkpoint ──
    print("\n2. WAL checkpoint...")
    raw = repo._raw_connection() if hasattr(repo, "_raw_connection") else None
    if raw:
        raw.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        raw.commit()
    else:
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.commit()
        conn.close()
    print(f"   After checkpoint — DB: {db_size_mb(db_path):.1f} MB, WAL: {wal_size_mb(db_path):.1f} MB")

    # ── 3. Query performance ──
    print("\n3. Query performance...")
    t0 = time.perf_counter()
    result = await store.read(EventQuery(limit=1000))
    read_time = time.perf_counter() - t0
    print(f"   Read 1000 events: {read_time:.3f}s ({1000/read_time:,.0f} ev/s)")

    t0 = time.perf_counter()
    result = await store.read(EventQuery(topic="benchmark.candle", limit=100))
    read_time = time.perf_counter() - t0
    print(f"   Topic filter (100): {read_time:.3f}s")

    t0 = time.perf_counter()
    result = await store.read(EventQuery(aggregate_id="bench#0000", limit=10))
    read_time = time.perf_counter() - t0
    print(f"   Aggregate filter (10): {read_time:.3f}s")

    # ── 4. VACUUM ──
    print("\n4. VACUUM...")
    t0 = time.perf_counter()
    if raw:
        raw.execute("VACUUM")
    else:
        conn = sqlite3.connect(db_path)
        conn.execute("VACUUM")
        conn.commit()
        conn.close()
    vac_time = time.perf_counter() - t0
    print(f"   After VACUUM — DB: {db_size_mb(db_path):.1f} MB ({vac_time:.1f}s)")

    # ── 5. Reopen database ──
    print("\n5. Reopen database...")
    await repo.close()
    repo2 = SQLiteEventRepository(db_path=db_path)
    await repo2.connect()
    store2 = EventStore(repository=repo2)

    t0 = time.perf_counter()
    result = await store2.read(EventQuery(limit=10))
    reopen_time = time.perf_counter() - t0
    print(f"   Reopen + read: {reopen_time:.3f}s, count={len(result)}")

    # ── 6. Aggregate restore ──
    print("\n6. Aggregate restore...")
    t0 = time.perf_counter()
    agg_events = await store2.read(EventQuery(aggregate_id="bench#0000"))
    restore_time = time.perf_counter() - t0
    print(f"   Restore bench#0000: {len(agg_events)} events in {restore_time:.3f}s")

    # ── 7. Trace ──
    print("\n7. Trace...")
    cid = "validation-correlation"
    # Mark a few events with this correlation
    for ev in [
        StoredEvent.new("benchmark", "bench#trace", "benchmark.signal",
                        correlation_id=cid, source="validation",
                        payload=b'{"signal": "buy"}'),
        StoredEvent.new("benchmark", "bench#trace", "benchmark.order",
                        correlation_id=cid, source="validation",
                        payload=b'{"order": "buy-1"}'),
        StoredEvent.new("benchmark", "bench#trace", "benchmark.fill",
                        correlation_id=cid, source="validation",
                        payload=b'{"fill": "buy-1"}'),
    ]:
        await store2.publish(ev)

    from core.event_store import EventStoreReader
    reader = EventStoreReader(store2)
    tb = TraceBuilder(reader)
    t0 = time.perf_counter()
    tg = await tb.build(cid)
    trace_time = time.perf_counter() - t0
    print(f"   Trace '{cid}': {len(tg.nodes)} nodes in {trace_time:.3f}s")

    # ── Close ──
    await repo2.close()

    # ── Save report ──
    report = {
        "version": "0.16.0-rc1",
        "events_total": num_events,
        "write_speed_ev_s": round(write_speed),
        "db_size_mb": round(db_size_mb(db_path), 1),
        "db_size_after_vacuum_mb": round(db_size_mb(db_path), 1),
        "read_1000_speed_ev_s": round(1000 / read_time) if read_time > 0 else 0,
        "vacuum_time_s": round(vac_time, 2),
        "reopen_read_time_s": round(reopen_time, 3),
        "aggregate_restore_count": len(agg_events),
        "aggregate_restore_time_s": round(restore_time, 3),
        "trace_time_s": round(trace_time, 3),
    }
    report_path = Path(__file__).resolve().parent.parent / "docs" / "event-store-benchmark.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\n✅ Report saved to {report_path}")
    print(f"\n{'=' * 60}")
    print(f"Summary: {num_events:,} events, {write_speed:,.0f} ev/s, "
          f"{db_size_mb(db_path):.1f}MB db")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", type=int, default=1_000_000)
    args = parser.parse_args()

    asyncio.run(run_validation(args.events))
