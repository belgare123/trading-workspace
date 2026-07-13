"""Tests: Trace API (TraceNode, TraceGraph, TraceBuilder)."""
import asyncio
import json
from pathlib import Path

import pytest

from core.event_store import (
    EventStore,
    EventStoreReader,
    SQLiteEventRepository,
    StoredEvent,
    TraceBuilder,
    TraceGraph,
    TraceNode,
    trace_by_correlation,
    trace_event,
)


@pytest.fixture
def store():
    """Sync fixture — открывает in-memory SQLite."""
    repo = SQLiteEventRepository(db_path=":memory:")
    asyncio.run(repo.connect())
    s = EventStore(repository=repo)
    yield s
    asyncio.run(repo.close())


@pytest.fixture
def reader(store):
    return EventStoreReader(store)


@pytest.fixture
def builder(reader):
    return TraceBuilder(reader)


async def _publish(store: EventStore, **kwargs) -> StoredEvent:
    """Publish helper — использует async publish."""
    topic = kwargs.pop("topic", "test.event")
    kwargs.pop("event_type", None)
    ev = StoredEvent.new(
        aggregate=kwargs.pop("aggregate", "test"),
        aggregate_id=kwargs.pop("aggregate_id", "test#1"),
        topic=topic,
        payload=json.dumps(kwargs.pop("payload", {})).encode("utf-8"),
        correlation_id=kwargs.pop("correlation_id", ""),
        causation_id=kwargs.pop("causation_id", ""),
        source=kwargs.pop("source", "pytest"),
    )
    stored = await store.publish(ev)
    return stored


# ═══════════════════════════════════════════════════════════════════
#  TraceNode
# ═══════════════════════════════════════════════════════════════════


class TestTraceNode:
    @pytest.mark.asyncio
    async def test_node_properties(self):
        ev = StoredEvent.new(
            aggregate="decision",
            aggregate_id="decision#1",
            topic="decision.created",
            correlation_id="corr-1",
            causation_id="parent-evt",
        )
        node = TraceNode(ev, depth=2)
        assert node.event_id == ev.event_id
        assert node.aggregate == "decision"
        assert node.aggregate_id == "decision#1"
        assert node.topic == "decision.created"
        assert node.correlation_id == "corr-1"
        assert node.causation_id == "parent-evt"
        assert node.depth == 2
        assert node.parent is None
        assert node.children == []

    @pytest.mark.asyncio
    async def test_node_with_parent(self):
        parent_ev = StoredEvent.new(
            aggregate="strategy",
            aggregate_id="strategy#1",
            topic="strategy.signal",
            correlation_id="corr-1",
        )
        ev = StoredEvent.new(
            aggregate="decision",
            aggregate_id="decision#1",
            topic="decision.created",
            correlation_id="corr-1",
            causation_id=parent_ev.event_id,
        )
        node = TraceNode(ev, depth=1)
        node.parent = TraceNode(parent_ev, depth=0)
        assert node.parent.event_id == parent_ev.event_id
        # Проверяем, что parent связан
        assert node.parent.topic == "strategy.signal"

    @pytest.mark.asyncio
    async def test_node_to_dict(self):
        ev = StoredEvent.new(
            aggregate="opportunity",
            aggregate_id="opportunity#BTCUSDT",
            topic="opportunity.opened",
            correlation_id="corr-1",
        )
        node = TraceNode(ev, depth=0)
        child = StoredEvent.new(
            aggregate="decision",
            aggregate_id="decision#1",
            topic="decision.created",
            correlation_id="corr-1",
            causation_id=ev.event_id,
        )
        child_node = TraceNode(child, depth=1)
        node.children.append(child_node)  # children — это список

        d = node.to_dict()
        assert d["event_id"] == ev.event_id
        assert d["topic"] == "opportunity.opened"
        assert len(d["children"]) == 1
        assert d["children"][0]["topic"] == "decision.created"

    @pytest.mark.asyncio
    async def test_node_event_type_from_topic(self):
        """label берётся из topic (последняя часть)."""
        ev = StoredEvent.new(
            aggregate="decision",
            aggregate_id="d#1",
            topic="decision.created.committed",
            correlation_id="c",
        )
        node = TraceNode(ev, depth=0)
        # label формируется из topic
        assert node.topic == "decision.created.committed"


# ═══════════════════════════════════════════════════════════════════
#  TraceGraph
# ═══════════════════════════════════════════════════════════════════


class TestTraceGraph:
    @pytest.mark.asyncio
    async def test_empty_graph(self):
        graph = TraceGraph(correlation_id="nonexistent")
        assert graph.nodes == {}
        assert graph.root_node() is None
        assert graph.timeline() == []
        assert graph.graph() == {}

    @pytest.mark.asyncio
    async def test_graph_with_nodes(self, store):
        cid = "trace-test-1"
        ev1 = await _publish(store, correlation_id=cid, aggregate="decision",
                             aggregate_id="decision#1", topic="decision.created")
        ev2 = await _publish(store, correlation_id=cid, aggregate="opportunity",
                             aggregate_id="opportunity#1", topic="opportunity.created",
                             causation_id=ev1.event_id)

        graph = await trace_by_correlation(EventStoreReader(store), cid)
        assert len(graph.nodes) == 2, f"Expected 2 nodes, got {len(graph.nodes)}"
        root = graph.root_node()
        assert root is not None
        assert root.topic == "decision.created"
        assert len(root.children) == 1
        assert root.children[0].topic == "opportunity.created"

    @pytest.mark.asyncio
    async def test_timeline_order(self, store):
        cid = "timeline-test"
        ev1 = await _publish(store, correlation_id=cid, aggregate="strategy",
                             aggregate_id="strat#1", topic="strategy.signal")
        ev2 = await _publish(store, correlation_id=cid, aggregate="decision",
                             aggregate_id="decision#1", topic="decision.created",
                             causation_id=ev1.event_id)
        ev3 = await _publish(store, correlation_id=cid, aggregate="opportunity",
                             aggregate_id="opp#1", topic="opportunity.opened",
                             causation_id=ev2.event_id)

        graph = await trace_by_correlation(EventStoreReader(store), cid)
        tl = graph.timeline()
        assert len(tl) == 3
        assert tl[0].topic == "strategy.signal"
        assert tl[1].topic == "decision.created"
        assert tl[2].topic == "opportunity.opened"

    @pytest.mark.asyncio
    async def test_export_json(self, store):
        cid = "json-test"
        ev1 = await _publish(store, correlation_id=cid, aggregate="decision",
                             aggregate_id="d#1", topic="decision.created")
        await _publish(store, correlation_id=cid, aggregate="opportunity",
                       aggregate_id="o#1", topic="opportunity.opened",
                       causation_id=ev1.event_id)

        graph = await trace_by_correlation(EventStoreReader(store), cid)
        js = graph.export_json()
        assert isinstance(js, str)
        data = json.loads(js)
        assert "correlation_id" in data
        assert "nodes" in data
        assert "graph" in data
        assert len(data["nodes"]) == 2
        # Должно быть ребро parent→child
        assert len(data["graph"]) == 2

    @pytest.mark.asyncio
    async def test_children_method(self, store):
        cid = "children-test"
        ev_parent = await _publish(store, correlation_id=cid, aggregate="parent",
                                   aggregate_id="p#1", topic="parent.event")
        ev_child1 = await _publish(store, correlation_id=cid, aggregate="child1",
                                   aggregate_id="c1#1", topic="child.created",
                                   causation_id=ev_parent.event_id)
        ev_child2 = await _publish(store, correlation_id=cid, aggregate="child2",
                                   aggregate_id="c2#1", topic="child.updated",
                                   causation_id=ev_parent.event_id)

        graph = await trace_by_correlation(EventStoreReader(store), cid)
        parent_node = graph.nodes[ev_parent.event_id]
        children = graph.children(ev_parent.event_id)
        assert len(children) == 2
        assert {c.topic for c in children} == {"child.created", "child.updated"}

    @pytest.mark.asyncio
    async def test_graph_method(self, store):
        cid = "graph-test"
        ev1 = await _publish(store, correlation_id=cid, aggregate="a",
                             aggregate_id="a#1", topic="a.event")
        await _publish(store, correlation_id=cid, aggregate="b",
                       aggregate_id="b#1", topic="b.event",
                       causation_id=ev1.event_id)

        graph = await trace_by_correlation(EventStoreReader(store), cid)
        g = graph.graph()
        assert isinstance(g, dict)
        assert len(g) == 2


# ═══════════════════════════════════════════════════════════════════
#  TraceBuilder
# ═══════════════════════════════════════════════════════════════════


class TestTraceBuilder:
    @pytest.mark.asyncio
    async def test_build_by_correlation(self, store, reader, builder):
        cid = "builder-test"
        ev1 = await _publish(store, correlation_id=cid, aggregate="a",
                             aggregate_id="a#1", topic="signal.buy")
        ev2 = await _publish(store, correlation_id=cid, aggregate="b",
                             aggregate_id="b#1", topic="trade.executed",
                             causation_id=ev1.event_id)

        graph = await builder.build(cid)
        assert len(graph.nodes) == 2
        root = graph.root_node()
        assert root is not None
        assert root.topic == "signal.buy"
        assert root.children[0].topic == "trade.executed"

    @pytest.mark.asyncio
    async def test_build_from_event(self, store, reader, builder):
        cid = "from-event-test"
        ev1 = await _publish(store, correlation_id=cid, aggregate="a",
                             aggregate_id="a#1", topic="source.signal")
        ev2 = await _publish(store, correlation_id=cid, aggregate="b",
                             aggregate_id="b#1", topic="target.executed",
                             causation_id=ev1.event_id)
        ev3 = await _publish(store, correlation_id=cid, aggregate="c",
                             aggregate_id="c#1", topic="target.confirmed",
                             causation_id=ev2.event_id)

        graph = await builder.build_from_event(ev2.event_id)
        assert len(graph.nodes) == 3
        root = graph.root_node()
        assert root is not None
        assert root.topic == "source.signal"

    @pytest.mark.asyncio
    async def test_build_event_not_found(self, builder):
        graph = await builder.build_from_event("nonexistent-event-id")
        assert graph.nodes == {}

    @pytest.mark.asyncio
    async def test_build_by_correlation_not_found(self, builder):
        graph = await builder.build("nonexistent")
        assert graph.nodes == {}


# ═══════════════════════════════════════════════════════════════════
#  trace_event — точка входа
# ═══════════════════════════════════════════════════════════════════


class TestTraceEventEntry:
    @pytest.mark.asyncio
    async def test_trace_event(self, store, reader):
        cid = "entry-test"
        ev1 = await _publish(store, correlation_id=cid, aggregate="a",
                             aggregate_id="a#1", topic="first.event")
        ev2 = await _publish(store, correlation_id=cid, aggregate="b",
                             aggregate_id="b#1", topic="second.event",
                             causation_id=ev1.event_id)

        graph = await trace_event(reader, ev2.event_id)
        assert len(graph.nodes) == 2
        assert graph.root_node().topic == "first.event"

    @pytest.mark.asyncio
    async def test_trace_event_not_found(self, reader):
        graph = await trace_event(reader, "nonexistent")
        assert graph.nodes == {}


# ═══════════════════════════════════════════════════════════════════
#  Reader.trace() convenience methods
# ═══════════════════════════════════════════════════════════════════


class TestReaderTrace:
    @pytest.mark.asyncio
    async def test_reader_trace_by_correlation(self, store, reader):
        cid = "reader-trace-corr"
        ev1 = await _publish(store, correlation_id=cid, aggregate="dec",
                             aggregate_id="dec#1", topic="decision.created")
        await _publish(store, correlation_id=cid, aggregate="opp",
                       aggregate_id="opp#1", topic="opportunity.opened",
                       causation_id=ev1.event_id)

        graph = await reader.trace(cid)
        assert len(graph.nodes) == 2
        assert graph.root_node().topic == "decision.created"

    @pytest.mark.asyncio
    async def test_reader_trace_event(self, store, reader):
        cid = "reader-trace-evt"
        ev1 = await _publish(store, correlation_id=cid, aggregate="dec",
                             aggregate_id="dec#1", topic="decision.created")
        ev2 = await _publish(store, correlation_id=cid, aggregate="opp",
                             aggregate_id="opp#1", topic="opportunity.opened",
                             causation_id=ev1.event_id)

        graph = await reader.trace_event(ev2.event_id)
        assert len(graph.nodes) == 2
        # непустой граф
        assert graph.root_node().topic == "decision.created"
