"""Tests: Aggregate Streams (AggregateStream, AggregateRepository, ConcurrencyError)."""
import asyncio
import json
from pathlib import Path

import pytest

from core.event_store import (
    AggregateRepository,
    AggregateSnapshot,
    AggregateStream,
    ConcurrencyError,
    EventStore,
    EventStoreReader,
    SQLiteEventRepository,
    StoredEvent,
)


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


async def _publish(store, **kwargs) -> StoredEvent:
    """Publish helper."""
    topic = kwargs.pop("topic", "test.event")
    kwargs.pop("event_type", None)
    ev = StoredEvent.new(
        aggregate=kwargs.pop("aggregate", "test"),
        aggregate_id=kwargs.pop("aggregate_id", "test#1"),
        topic=topic,
        payload=json.dumps(kwargs.pop("payload", {})).encode("utf-8"),
        correlation_id=kwargs.pop("correlation_id", ""),
        causation_id=kwargs.pop("causation_id", ""),
        source="pytest",
    )
    return await store.publish(ev)


# ═══════════════════════════════════════════════════════════════════
#  ConcurrencyError
# ═══════════════════════════════════════════════════════════════════


class TestConcurrencyError:
    @pytest.mark.asyncio
    async def test_concurrency_error(self):
        err = ConcurrencyError("trade", "BTCUSDT", expected=5, current=7)
        assert err.aggregate_type == "trade"
        assert err.aggregate_id == "BTCUSDT"
        assert err.expected == 5
        assert err.current == 7
        assert "expected version 5" in str(err)
        assert "current 7" in str(err)


# ═══════════════════════════════════════════════════════════════════
#  AggregateSnapshot
# ═══════════════════════════════════════════════════════════════════


class TestAggregateSnapshot:
    @pytest.mark.asyncio
    async def test_from_event(self):
        ev = StoredEvent.new(
            aggregate="opportunity",
            aggregate_id="BTCUSDT",
            topic="opportunity.opened",
            payload=b'{"symbol": "BTCUSDT", "side": "buy"}',
            source="LifecycleEngine",
        )
        snap = AggregateSnapshot.from_event(ev)
        assert snap.aggregate_type == "opportunity"
        assert snap.aggregate_id == "BTCUSDT"
        assert snap.version == 0  # Было 0 до auto-increment
        assert snap.state["source"] == "LifecycleEngine"

    @pytest.mark.asyncio
    async def test_to_from_dict(self):
        snap = AggregateSnapshot(
            aggregate_type="trade",
            aggregate_id="BTCUSDT",
            version=42,
            state={"closed": True, "pnl": 150.0},
            timestamp=1718000000.0,
            metadata={"created_by": "test"},
        )
        d = snap.to_dict()
        assert d["version"] == 42
        restored = AggregateSnapshot.from_dict(d)
        assert restored.version == 42
        assert restored.state["pnl"] == 150.0
        assert restored.metadata["created_by"] == "test"


# ═══════════════════════════════════════════════════════════════════
#  AggregateStream
# ═══════════════════════════════════════════════════════════════════


class TestAggregateStream:
    @pytest.mark.asyncio
    async def test_empty_stream(self):
        agg = AggregateStream("trade", "BTCUSDT")
        assert agg.version == 0
        assert agg.event_count == 0
        assert agg.events() == []
        assert agg.latest() is None
        assert agg.snapshot() is None
        assert not agg.has_snapshot

    @pytest.mark.asyncio
    async def test_stream_with_events(self, store):
        ev1 = await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                             topic="trade.opened", payload={"symbol": "BTCUSDT"})
        ev2 = await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                             topic="trade.updated", payload={"price": 50000})
        ev3 = await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                             topic="trade.closed", payload={"pnl": 150.0})

        agg = AggregateStream("trade", "BTCUSDT", events=[ev1, ev2, ev3])
        assert agg.version == 3  # aggregate_version auto-increment
        assert agg.event_count == 3
        assert agg.latest().topic == "trade.closed"
        assert agg.latest().aggregate_version == 3

    @pytest.mark.asyncio
    async def test_history_and_since(self, store):
        ev1 = await _publish(store, aggregate="opp", aggregate_id="BTCUSDT",
                             topic="opp.opened")
        ev2 = await _publish(store, aggregate="opp", aggregate_id="BTCUSDT",
                             topic="opp.activated")
        ev3 = await _publish(store, aggregate="opp", aggregate_id="BTCUSDT",
                             topic="opp.closed")

        agg = AggregateStream("opp", "BTCUSDT", events=[ev1, ev2, ev3])
        assert len(agg.history()) == 3
        since = agg.since(2)
        assert len(since) == 2
        assert since[0].aggregate_version == 2

    @pytest.mark.asyncio
    async def test_at_version(self, store):
        ev1 = await _publish(store, aggregate="dec", aggregate_id="d#1",
                             topic="decision.created")
        await _publish(store, aggregate="dec", aggregate_id="d#1",
                       topic="decision.executed")

        agg = AggregateStream("dec", "d#1", events=[ev1])
        ev = agg.at_version(1)
        assert ev is not None
        assert ev.topic == "decision.created"
        assert agg.at_version(99) is None

    @pytest.mark.asyncio
    async def test_make_snapshot(self, store):
        ev1 = await _publish(store, aggregate="trade", aggregate_id="t#1",
                             topic="trade.opened", payload={"side": "buy"})
        agg = AggregateStream("trade", "t#1", events=[ev1])
        assert not agg.has_snapshot

        snap = agg.make_snapshot()
        assert agg.has_snapshot
        assert snap.version == agg.version
        assert snap.aggregate_type == "trade"
        assert snap.state["payload"]["side"] == "buy"

    @pytest.mark.asyncio
    async def test_make_snapshot_empty(self):
        agg = AggregateStream("trade", "empty")
        with pytest.raises(ValueError, match="Cannot snapshot"):
            agg.make_snapshot()

    @pytest.mark.asyncio
    async def test_diff(self, store):
        ev1 = await _publish(store, aggregate="opp", aggregate_id="o#1",
                             topic="opp.created")
        ev2 = await _publish(store, aggregate="opp", aggregate_id="o#1",
                             topic="opp.updated")
        ev3 = await _publish(store, aggregate="opp", aggregate_id="o#1",
                             topic="opp.closed")

        agg = AggregateStream("opp", "o#1", events=[ev1, ev2, ev3])
        result = agg.diff(1, 3)
        assert result["from_version"] == 1
        assert result["to_version"] == 3
        assert result["count"] == 2  # versions 2 and 3

    @pytest.mark.asyncio
    async def test_export_json(self, store):
        ev1 = await _publish(store, aggregate="trade", aggregate_id="t#1",
                             topic="trade.opened")
        agg = AggregateStream("trade", "t#1", events=[ev1])
        js = agg.export_json()
        data = json.loads(js)
        assert data["aggregate_type"] == "trade"
        assert data["version"] == 1
        assert len(data["events"]) == 1

    @pytest.mark.asyncio
    async def test_replay(self, store):
        ev1 = await _publish(store, aggregate="r", aggregate_id="r#1",
                             topic="replay.test")
        agg = AggregateStream("r", "r#1", events=[ev1])
        assert len(agg.replay()) == 1

    @pytest.mark.asyncio
    async def test_to_dict(self, store):
        ev = await _publish(store, aggregate="t", aggregate_id="t#1",
                            topic="test.t")
        agg = AggregateStream("t", "t#1", events=[ev])
        d = agg.to_dict()
        assert d["aggregate_type"] == "t"
        assert d["version"] == 1


# ═══════════════════════════════════════════════════════════════════
#  AggregateRepository
# ═══════════════════════════════════════════════════════════════════


class TestAggregateRepository:
    @pytest.mark.asyncio
    async def test_load_empty(self, repo):
        agg = await repo.load("trade", "nonexistent")
        assert agg.version == 0
        assert agg.event_count == 0

    @pytest.mark.asyncio
    async def test_load_with_events(self, store, repo):
        await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                       topic="trade.opened")
        await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                       topic="trade.closed")

        agg = await repo.load("trade", "BTCUSDT")
        assert agg.version == 2
        assert agg.event_count == 2
        assert agg.latest().topic == "trade.closed"

    @pytest.mark.asyncio
    async def test_load_multiple_aggregates(self, store, repo):
        await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                       topic="trade.opened")
        await _publish(store, aggregate="opportunity", aggregate_id="ETHUSDT",
                       topic="opp.opened")

        btc = await repo.load("trade", "BTCUSDT")
        eth = await repo.load("opportunity", "ETHUSDT")
        assert btc.event_count == 1
        assert eth.event_count == 1
        assert btc.latest().topic == "trade.opened"
        assert eth.latest().topic == "opp.opened"

    @pytest.mark.asyncio
    async def test_version(self, store, repo):
        await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                       topic="trade.opened")
        await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                       topic="trade.updated")

        ver = await repo.version("trade", "BTCUSDT")
        assert ver == 2

    @pytest.mark.asyncio
    async def test_version_empty(self, repo):
        ver = await repo.version("trade", "nonexistent")
        assert ver == 0

    @pytest.mark.asyncio
    async def test_append_without_oc(self, store, repo):
        ev = StoredEvent.new(
            aggregate="trade",
            aggregate_id="BTCUSDT",
            topic="trade.opened",
        )
        stored = await repo.append(ev)
        assert stored.aggregate_version == 1

    @pytest.mark.asyncio
    async def test_append_with_oc_ok(self, store, repo):
        ev1 = StoredEvent.new(aggregate="trade", aggregate_id="BTCUSDT",
                              topic="trade.opened")
        await repo.append(ev1, expected_version=0)

        ev2 = StoredEvent.new(aggregate="trade", aggregate_id="BTCUSDT",
                              topic="trade.closed")
        stored = await repo.append(ev2, expected_version=1)
        assert stored.aggregate_version == 2

    @pytest.mark.asyncio
    async def test_append_with_oc_conflict(self, store, repo):
        ev1 = StoredEvent.new(aggregate="trade", aggregate_id="BTCUSDT",
                              topic="trade.opened")
        await repo.append(ev1, expected_version=0)

        ev2 = StoredEvent.new(aggregate="trade", aggregate_id="BTCUSDT",
                              topic="trade.closed")
        with pytest.raises(ConcurrencyError) as excinfo:
            await repo.append(ev2, expected_version=0)
        assert excinfo.value.expected == 0
        assert excinfo.value.current == 1

    @pytest.mark.asyncio
    async def test_snapshot_lifecycle(self, store, repo):
        ev1 = await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                             topic="trade.opened", payload={"side": "buy"})
        ev2 = await _publish(store, aggregate="trade", aggregate_id="BTCUSDT",
                             topic="trade.closed", payload={"pnl": 150.0})

        # Сохранить снимок
        snap = AggregateSnapshot(
            aggregate_type="trade",
            aggregate_id="BTCUSDT",
            version=2,
            state={"side": "buy", "pnl": 150.0},
            timestamp=ev2.timestamp,
        )
        await repo.save_snapshot(snap)

        # Загрузить снимок
        loaded = await repo.load_snapshot("trade", "BTCUSDT")
        assert loaded is not None
        assert loaded.version == 2
        assert loaded.state["pnl"] == 150.0

        # Удалить снимок
        deleted = await repo.delete_snapshot("trade", "BTCUSDT")
        assert deleted
        assert await repo.load_snapshot("trade", "BTCUSDT") is None

    @pytest.mark.asyncio
    async def test_snapshot_not_found(self, repo):
        snap = await repo.load_snapshot("trade", "nonexistent")
        assert snap is None

    @pytest.mark.asyncio
    async def test_restore_with_snapshot(self, store, repo):
        # Создать события
        await _publish(store, aggregate="trade", aggregate_id="R#1",
                       topic="trade.v1")
        await _publish(store, aggregate="trade", aggregate_id="R#1",
                       topic="trade.v2")
        await _publish(store, aggregate="trade", aggregate_id="R#1",
                       topic="trade.v3")

        # Снимок на v2
        snap = AggregateSnapshot(
            aggregate_type="trade",
            aggregate_id="R#1",
            version=2,
            state={"v": 2},
        )
        await repo.save_snapshot(snap)

        # Восстановление: снимок + события после
        restored = await repo.restore("trade", "R#1")
        assert restored is not None
        assert restored.snapshot_version == 2
        assert restored.version >= 2
        # Должны быть только события после снимка (v3+)
        assert restored.event_count == 1
        assert restored.latest().topic == "trade.v3"

    @pytest.mark.asyncio
    async def test_restore_without_snapshot(self, store, repo):
        await _publish(store, aggregate="trade", aggregate_id="N#1",
                       topic="trade.v1")

        restored = await repo.restore("trade", "N#1")
        assert restored is not None
        assert restored.snapshot_version == 0

    @pytest.mark.asyncio
    async def test_restore_empty(self, repo):
        restored = await repo.restore("trade", "nonexistent")
        assert restored is None
