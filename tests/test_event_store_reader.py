"""Tests: EventStoreReader + SnapshotReader."""
import asyncio
import json
import os
import tempfile
from pathlib import Path

import pytest

from core.event_store import (
    EventStore,
    EventStoreReader,
    EventQuery,
    ReaderSnapshot,
    SnapshotReader,
    SQLiteEventRepository,
    StoredEvent,
)


@pytest.fixture
def store():
    tmp = Path(tempfile.mktemp(suffix=".db"))
    repo = SQLiteEventRepository(db_path=tmp)
    asyncio.run(repo.connect())
    s = EventStore(repository=repo)
    yield s
    asyncio.run(repo.close())
    os.unlink(str(tmp))


@pytest.fixture
def reader(store):
    return EventStoreReader(store)


def _make_events(store, aggregate: str = "decision", count: int = 5):
    events = []
    for i in range(count):
        e = StoredEvent.new(
            aggregate=aggregate,
            aggregate_id=f"{aggregate}#test",
            topic=f"{aggregate}.test_{i}",
            source="pytest",
            payload=json.dumps({"idx": i}).encode("utf-8"),
        )
        stored = store.publish_sync(e)
        events.append(stored)
    return events


class TestEventStoreReader:
    def test_read_stream(self, reader, store):
        _make_events(store, "decision", 3)
        results = asyncio.run(reader.read(stream="decision"))
        assert len(results) == 3
        for r in results:
            assert r.aggregate == "decision"

    def test_read_stream_from_version(self, reader, store):
        _make_events(store, "decision", 5)
        results = asyncio.run(reader.read(stream="decision", from_version=3))
        assert len(results) >= 2  # версии 3,4,5 — как минимум 2
        for r in results:
            assert r.aggregate_version >= 3

    def test_read_since(self, reader, store):
        import time
        ts = time.time()
        _make_events(store, "decision", 3)
        results = asyncio.run(reader.read_since(timestamp=ts))
        assert len(results) == 3

    def test_tail(self, reader, store):
        _make_events(store, "decision", 5)
        results = asyncio.run(reader.tail(limit=3))
        assert len(results) == 3

    def test_tail_filtered(self, reader, store):
        _make_events(store, "decision", 5)
        _make_events(store, "opportunity", 3)
        results = asyncio.run(reader.tail(limit=10, stream="decision"))
        assert len(results) == 5
        for r in results:
            assert r.aggregate == "decision"

    def test_by_correlation(self, reader, store):
        cid = "trace-123"
        events = []
        for i in range(3):
            e = StoredEvent.new(
                aggregate="decision",
                aggregate_id="decision#test",
                topic="decision.test",
                source="pytest",
                correlation_id=cid,
                payload=json.dumps({"idx": i}).encode("utf-8"),
            )
            stored = store.publish_sync(e)
            events.append(stored)
        results = asyncio.run(reader.by_correlation(cid))
        assert len(results) == 3
        for r in results:
            assert r.correlation_id == cid

    def test_by_causation(self, reader, store):
        parent_id = "parent-42"
        e1 = StoredEvent.new(
            aggregate="decision",
            aggregate_id="decision#test",
            topic="decision.parent",
            source="pytest",
            event_id=parent_id,
        )
        store.publish_sync(e1)
        for i in range(2):
            e2 = StoredEvent.new(
                aggregate="decision",
                aggregate_id="decision#test",
                topic="decision.child",
                source="pytest",
                causation_id=parent_id,
                payload=json.dumps({"idx": i}).encode("utf-8"),
            )
            store.publish_sync(e2)
        results = asyncio.run(reader.by_causation(parent_id))
        assert len(results) == 2

    def test_by_aggregate(self, reader, store):
        _make_events(store, "opportunity", 4)
        results = asyncio.run(reader.by_aggregate("opportunity", "opportunity#test"))
        assert len(results) == 4

    def test_count(self, reader, store):
        _make_events(store, "decision", 7)
        cnt = asyncio.run(reader.count(stream="decision"))
        assert cnt == 7

    def test_earliest_latest(self, reader, store):
        _make_events(store, "decision", 4)
        earliest = asyncio.run(reader.earliest("decision"))
        latest = asyncio.run(reader.latest("decision"))
        assert earliest is not None
        assert latest is not None
        assert earliest.aggregate_version <= latest.aggregate_version


class TestSnapshotReader:
    def test_restore(self, reader, store):
        _make_events(store, "decision", 5)
        snap = ReaderSnapshot(
            aggregate="decision",
            aggregate_id="decision#test",
            version=2,
            state={"applied": 2},
        )
        snap_reader = SnapshotReader(reader)
        events = asyncio.run(snap_reader.restore(snap))
        assert len(events) >= 3  # версии 3,4,5
        for e in events:
            assert e.aggregate_version > 2

    def test_restore_stream(self, reader, store):
        _make_events(store, "decision", 5)
        snap = ReaderSnapshot(
            aggregate="decision",
            aggregate_id="decision#test",
            version=2,
            state={"applied": 2},
        )
        snap_reader = SnapshotReader(reader)
        state, events = asyncio.run(
            snap_reader.restore_stream("decision", "decision#test", snapshot=snap)
        )
        assert state["_snapshot_version"] == 2
        assert state["_events_applied"] >= 3

    def test_restore_stream_no_snapshot(self, reader, store):
        _make_events(store, "decision", 3)
        snap_reader = SnapshotReader(reader)
        state, events = asyncio.run(
            snap_reader.restore_stream("decision", "decision#test", snapshot=None)
        )
        assert state["_events_applied"] == 3
        assert state["_latest_version"] >= 3
