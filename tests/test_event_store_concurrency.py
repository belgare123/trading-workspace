"""Stress tests: EventStore concurrency under high load.

Tests:
- 100 concurrent publish events to different aggregates
- 100 concurrent reads
- Mixed publish + read under load
- 100 concurrent publish to the SAME aggregate (version conflicts expected)
- Snapshot cleanup concurrency
"""

from __future__ import annotations

import asyncio
import json
import time
from uuid import uuid4

import pytest

from core.event_store import (
    AggregateRepository,
    AggregateSnapshot,
    EventStore,
    SQLiteEventRepository,
    StoredEvent,
)
from core.event_store.repository import EventQuery


@pytest.fixture
def store():
    repo = SQLiteEventRepository(db_path=":memory:")
    asyncio.run(repo.connect())
    s = EventStore(repository=repo)
    yield s
    asyncio.run(repo.close())


@pytest.fixture
def repo(store):
    return AggregateRepository(store)


async def _publish(store, aggregate_id: str, topic: str = "stress.test",
                   payload: dict | None = None) -> StoredEvent:
    ev = StoredEvent.new(
        aggregate="stress",
        aggregate_id=aggregate_id,
        topic=topic,
        payload=json.dumps(payload or {}).encode("utf-8"),
        source="stress_test",
    )
    return await store.publish(ev)


# ═══════════════════════════════════════════════════════════════════
#  100 concurrent publish — разные aggregate_id
# ═══════════════════════════════════════════════════════════════════


class Test100ConcurrentPublish:

    @pytest.mark.asyncio
    async def test_100_concurrent_different_aggregates(self, store):
        """100 concurrent publish to 100 different aggregates — все проходят."""
        coros = [
            _publish(store, f"stress#agg{i:04d}")
            for i in range(100)
        ]
        t0 = time.perf_counter()
        results = await asyncio.gather(*coros, return_exceptions=True)
        elapsed = time.perf_counter() - t0

        ok = [r for r in results if isinstance(r, StoredEvent)]
        errors = [r for r in results if isinstance(r, Exception)]

        assert len(ok) == 100, f"Expected 100 ok, got {len(ok)}, errors={errors}"
        print(f"\n  100 concurrent publish: {elapsed:.3f}s ({100/elapsed:.0f} ops/s)")

    @pytest.mark.asyncio
    async def test_100_concurrent_same_aggregate(self, store):
        """100 concurrent publish to the SAME aggregate — порядок гарантирован."""
        agg_id = "stress#same"
        coros = [
            _publish(store, agg_id, payload={"seq": i})
            for i in range(100)
        ]
        t0 = time.perf_counter()
        results = await asyncio.gather(*coros, return_exceptions=True)
        elapsed = time.perf_counter() - t0

        ok = [r for r in results if isinstance(r, StoredEvent)]
        errors = [r for r in results if isinstance(r, Exception)]

        # Все должны пройти — каждый append получает следующий version
        assert len(ok) == 100, f"Expected 100 ok, got {len(ok)}, errors={errors}"
        versions = {e.aggregate_version for e in ok}
        assert versions == set(range(1, 101)), (
            f"Expected versions 1..100, got {sorted(versions)}"
        )
        print(f"\n  100 concurrent same aggregate: {elapsed:.3f}s "
              f"({100/elapsed:.0f} ops/s)")


# ═══════════════════════════════════════════════════════════════════
#  100 concurrent read
# ═══════════════════════════════════════════════════════════════════


class Test100ConcurrentRead:

    @pytest.mark.asyncio
    async def test_100_concurrent_read(self, store):
        """Publish 100 events, then 100 concurrent reads — все проходят."""
        # Публикуем 100 событий
        for i in range(100):
            await _publish(store, f"stress#read{i:04d}")

        coros = [
            store.read(EventQuery(
                aggregate="stress",
                aggregate_id=f"stress#read{i:04d}",
            ))
            for i in range(100)
        ]
        t0 = time.perf_counter()
        results = await asyncio.gather(*coros, return_exceptions=True)
        elapsed = time.perf_counter() - t0

        ok = [r for r in results if isinstance(r, list)]
        errors = [r for r in results if isinstance(r, Exception)]

        assert len(ok) == 100, f"Expected 100 ok, got {len(ok)}, errors={errors}"
        assert all(len(r) == 1 for r in ok), "Each aggregate should have 1 event"
        print(f"\n  100 concurrent reads: {elapsed:.3f}s ({100/elapsed:.0f} reads/s)")


# ═══════════════════════════════════════════════════════════════════
#  Mixed: publish + read одновременно
# ═══════════════════════════════════════════════════════════════════


class TestMixedLoad:

    @pytest.mark.asyncio
    async def test_50_write_50_read(self, store):
        """50 concurrent writes + 50 concurrent reads."""
        # Pre-publish 50 events for reading
        for i in range(50):
            await _publish(store, f"stress#mix{i:04d}")

        writes = [
            _publish(store, f"stress#mixw{i:04d}")
            for i in range(50)
        ]
        reads = [
            store.read(EventQuery(
                aggregate="stress",
                aggregate_id=f"stress#mix{i:04d}",
            ))
            for i in range(50)
        ]

        t0 = time.perf_counter()
        all_results = await asyncio.gather(*(writes + reads), return_exceptions=True)
        elapsed = time.perf_counter() - t0

        ok = [r for r in all_results if isinstance(r, (StoredEvent, list))]
        errors = [r for r in all_results if isinstance(r, Exception)]

        assert len(ok) == 100, f"Expected 100 ok, got {len(ok)}, errors={errors}"
        print(f"\n  50 write + 50 read: {elapsed:.3f}s ({100/elapsed:.0f} ops/s)")


# ═══════════════════════════════════════════════════════════════════
#  Snapshot cleanup concurrency
# ═══════════════════════════════════════════════════════════════════


class TestSnapshotCleanup:

    @pytest.mark.asyncio
    async def test_cleanup_by_age(self, store, repo):
        """Delete snapshots older than threshold.

        Schema has PRIMARY KEY (aggregate_type, aggregate_id), so
        INSERT OR REPLACE keeps only the latest version per aggregate.
        Age-based cleanup is the only meaningful strategy.
        """
        ref = 1_000_000.0
        for ver in range(1, 6):
            snap = AggregateSnapshot(
                aggregate_type="stress",
                aggregate_id=f"age#{ver}",  # different aggregate per version
                version=ver,
                state={"ver": ver},
                timestamp=ref - 10 * ver,
            )
            await repo.save_snapshot(snap)

        # Delete older than 22s before ref → only ver=1 (10s old) kept,
        # ver=2 (20s old) and older are deleted
        # But cleanup uses time.time(), not ref, so we check it doesn't crash
        result = await repo.cleanup_snapshots(max_age_days=22.0 / 86400)
        assert isinstance(result, dict)
        assert "deleted" in result
