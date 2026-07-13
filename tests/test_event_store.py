"""Tests for Event Store — core/event_store/ (async tests)."""

from __future__ import annotations

import pytest

from core.event_store.models import (
    StoredEvent,
    EventNotFoundError,
)
from core.event_store.repository import EventQuery
from core.event_store.store import EventStore, reset_event_store


def make_store():
    """Create in-memory EventStore (helper — not a fixture)."""
    from core.event_store.sqlite_repo import SQLiteEventRepository

    repo = SQLiteEventRepository(db_path=":memory:")
    return repo


@pytest.fixture
def repo():
    """Sync fixture — caller must connect/disconnect."""
    r = make_store()
    return r


# ═══════════════════════════════════════════════════════════════════
#  EventStore — write
# ═══════════════════════════════════════════════════════════════════


class TestEventStoreWrite:
    @pytest.mark.asyncio
    async def test_publish_and_read(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        ev = StoredEvent.new(
            aggregate="decision",
            aggregate_id="decision#001",
            topic="decision.accepted",
            payload=b'{"symbol": "BTCUSDT"}',
            source="DecisionEngine",
        )
        stored = await store.publish(ev)

        assert stored.event_id == ev.event_id
        assert stored.aggregate_version > 0

        loaded = await store.read_one(stored.event_id)
        assert loaded.event_id == stored.event_id
        assert loaded.payload == b'{"symbol": "BTCUSDT"}'
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_auto_increment_version(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        aid = "decision#auto-inc"
        for i in range(5):
            ev = StoredEvent.new(
                aggregate="decision",
                aggregate_id=aid,
                topic="decision.accepted",
            )
            stored = await store.publish(ev)
            assert stored.aggregate_version == i + 1

        latest = await store.latest_version(aid)
        assert latest == 5
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_explicit_version(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        ev = StoredEvent.new(
            aggregate="decision",
            aggregate_id="decision#explicit",
            topic="decision.accepted",
            aggregate_version=42,
        )
        stored = await store.publish(ev)
        assert stored.aggregate_version == 42
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_publish_multiple_aggregates(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        aggregates = [
            ("decision", "decision#1", "decision.accepted"),
            ("opportunity", "opportunity#1", "opportunity.created"),
            ("quality", "quality#1", "quality.updated"),
        ]
        for agg, aid, topic in aggregates:
            ev = StoredEvent.new(aggregate=agg, aggregate_id=aid, topic=topic)
            await store.publish(ev)

        for agg, aid, topic in aggregates:
            events = await store.read(
                EventQuery(aggregate=agg, aggregate_id=aid)
            )
            assert len(events) == 1
            assert events[0].topic == topic
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_read_one_not_found(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        with pytest.raises(EventNotFoundError):
            await store.read_one("nonexistent")
        await repo.close()
        reset_event_store()


# ═══════════════════════════════════════════════════════════════════
#  EventStore — query
# ═══════════════════════════════════════════════════════════════════


class TestEventStoreQuery:
    @pytest.mark.asyncio
    async def test_by_aggregate(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        # seed
        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#d1",
            topic="decision.accepted", correlation_id="chain-001",
        ))
        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#d2",
            topic="decision.rejected", correlation_id="chain-001",
        ))
        await store.publish(StoredEvent.new(
            aggregate="opportunity", aggregate_id="opportunity#o1",
            topic="opportunity.created", correlation_id="chain-001",
        ))
        await store.publish(StoredEvent.new(
            aggregate="quality", aggregate_id="quality#s1",
            topic="quality.updated",
        ))

        results = await store.read(EventQuery(aggregate="decision"))
        assert len(results) == 2
        assert all(e.aggregate == "decision" for e in results)
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_by_topic(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#d1",
            topic="decision.accepted",
        ))
        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#d2",
            topic="decision.rejected",
        ))

        results = await store.by_topic("decision.accepted")
        assert len(results) == 1
        assert results[0].topic == "decision.accepted"
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_by_correlation(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#d1",
            topic="decision.accepted", correlation_id="chain-001",
        ))
        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#d2",
            topic="decision.rejected", correlation_id="chain-001",
        ))
        await store.publish(StoredEvent.new(
            aggregate="quality", aggregate_id="quality#s1",
            topic="quality.updated", correlation_id="chain-002",
        ))

        results = await store.by_correlation("chain-001")
        assert len(results) == 2
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_tail(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        for i in range(5):
            await store.publish(StoredEvent.new(
                aggregate="test", aggregate_id=f"test#{i}", topic="test.evt",
            ))

        results = await store.tail(limit=3)
        assert len(results) == 3
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_count(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        await store.publish(StoredEvent.new(
            aggregate="test", aggregate_id="test#1", topic="test.a",
        ))
        await store.publish(StoredEvent.new(
            aggregate="test", aggregate_id="test#2", topic="test.b",
        ))

        cnt = await store.count(EventQuery(aggregate="test"))
        assert cnt == 2
        cnt_all = await store.count(EventQuery())
        assert cnt_all == 2
        await repo.close()
        reset_event_store()


# ═══════════════════════════════════════════════════════════════════
#  EventStore — subscriptions
# ═══════════════════════════════════════════════════════════════════


class TestEventStoreSubscription:
    @pytest.mark.asyncio
    async def test_on_topic(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        received = []

        async def handler(ev):
            received.append(ev)

        store.on_topic("decision.accepted", handler)
        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#sub",
            topic="decision.accepted",
        ))
        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#sub2",
            topic="decision.rejected",
        ))
        assert len(received) == 1
        assert received[0].topic == "decision.accepted"
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_on_aggregate(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        received = []

        async def handler(ev):
            received.append(ev)

        store.on_aggregate("opportunity", handler)
        await store.publish(StoredEvent.new(
            aggregate="opportunity", aggregate_id="opportunity#test",
            topic="opportunity.created",
        ))
        await store.publish(StoredEvent.new(
            aggregate="decision", aggregate_id="decision#test",
            topic="decision.accepted",
        ))
        assert len(received) == 1
        assert received[0].aggregate == "opportunity"
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_on_any(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        received = []

        async def handler(ev):
            received.append(ev)

        store.on_any(handler)
        await store.publish(StoredEvent.new(
            aggregate="test", aggregate_id="test#1", topic="test.a",
        ))
        await store.publish(StoredEvent.new(
            aggregate="test", aggregate_id="test#2", topic="test.b",
        ))
        assert len(received) == 2
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_on_sync(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        received = []

        def handler(ev):
            received.append(ev)

        store.on_sync(handler)
        await store.publish(StoredEvent.new(
            aggregate="test", aggregate_id="test#3", topic="test.c",
        ))
        assert len(received) == 1
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_unsubscribe(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        received = []

        async def handler(ev):
            received.append(ev)

        unsub = store.on_topic("test.echo", handler)
        await store.publish(StoredEvent.new(
            aggregate="test", aggregate_id="test#u1", topic="test.echo",
        ))
        assert len(received) == 1

        unsub()
        await store.publish(StoredEvent.new(
            aggregate="test", aggregate_id="test#u2", topic="test.echo",
        ))
        assert len(received) == 1
        await repo.close()
        reset_event_store()


# ═══════════════════════════════════════════════════════════════════
#  SQLite repository — edge cases
# ═══════════════════════════════════════════════════════════════════


class TestSQLiteRepository:
    @pytest.mark.asyncio
    async def test_connect_twice(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        await store.connect()  # should be noop
        assert store.repo is not None
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_append_duplicate_id(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        fixed_id = "dup-id-12345678901234567890123456789012345"
        ev = StoredEvent.new(
            aggregate="test", aggregate_id="test#dup",
            topic="test.dup", event_id=fixed_id,
        )
        await store.publish(ev)
        ev2 = StoredEvent.new(
            aggregate="test", aggregate_id="test#dup2",
            topic="test.dup2", event_id=fixed_id,
        )
        await store.publish(ev2)

        results = await store.read(EventQuery(aggregate="test"))
        assert len(results) >= 1
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_large_payload(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        payload = b"x" * 100_000
        ev = StoredEvent.new(
            aggregate="test", aggregate_id="test#large",
            topic="test.large", payload=payload,
        )
        stored = await store.publish(ev)
        loaded = await store.read_one(stored.event_id)
        assert len(loaded.payload) == 100_000
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_empty_query_returns_all(self):
        from core.event_store.sqlite_repo import SQLiteEventRepository

        repo = SQLiteEventRepository(db_path=":memory:")
        await repo.connect()
        store = EventStore(repository=repo)

        for i in range(5):
            await store.publish(StoredEvent.new(
                aggregate="test", aggregate_id=f"test#q{i}", topic="test.query",
            ))
        results = await store.read(EventQuery(limit=100))
        assert len(results) >= 5
        await repo.close()
        reset_event_store()

    @pytest.mark.asyncio
    async def test_close_and_reopen(self):
        import tempfile, os
        from core.event_store.sqlite_repo import SQLiteEventRepository

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name

        try:
            repo = SQLiteEventRepository(db_path=db_path)
            await repo.connect()
            s = EventStore(repository=repo)
            await s.publish(StoredEvent.new(
                aggregate="test", aggregate_id="test#close", topic="test.close",
            ))
            await s.close()

            repo2 = SQLiteEventRepository(db_path=db_path)
            await repo2.connect()
            s2 = EventStore(repository=repo2)
            cnt = await s2.count(EventQuery(aggregate="test"))
            assert cnt >= 1
            await s2.close()
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)
