#!/usr/bin/env python
"""EventStore Trace Demo — демонстрация корреляционных трасс.

Записывает цепочку событий (signal → decision → order → fill)
через correlation_id и строит TraceGraph.

Run:
    python examples/trace_demo/run.py
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from core.event_store import (
    EventStore,
    EventStoreReader,
    SQLiteEventRepository,
    StoredEvent,
    TraceBuilder,
)


async def main():
    print("=" * 55)
    print("  EventStore Trace Demo")
    print("=" * 55)

    # Setup
    repo = SQLiteEventRepository(db_path=":memory:")
    await repo.connect()
    store = EventStore(repository=repo)
    reader = EventStoreReader(store)

    # Chain of events sharing a correlation_id
    correlation_id = "trace_demo_001"

    print("\n1. Publishing event chain...")

    events = [
        StoredEvent.new(
            aggregate="signal", aggregate_id="signal#mom_001",
            topic="signal.momentum",
            payload=b'{"type": "momentum", "direction": "long"}',
            source="strategy:momentum-pro",
            correlation_id=correlation_id,
        ),
        StoredEvent.new(
            aggregate="decision", aggregate_id="decision#001",
            topic="decision.entry",
            payload=b'{"action": "enter", "size": 0.1}',
            source="decision:consensus",
            correlation_id=correlation_id,
            causation_id="signal#mom_001",
        ),
        StoredEvent.new(
            aggregate="order", aggregate_id="order#001",
            topic="order.created",
            payload=b'{"symbol": "BTCUSDT", "side": "buy", "qty": 0.1}',
            source="execution:bybit",
            correlation_id=correlation_id,
            causation_id="decision#001",
        ),
        StoredEvent.new(
            aggregate="order", aggregate_id="order#001",
            topic="order.filled",
            payload=b'{"symbol": "BTCUSDT", "side": "buy", "qty": 0.1, "price": 65000}',
            source="execution:bybit",
            correlation_id=correlation_id,
            causation_id="order#001",
        ),
    ]

    for ev in events:
        stored = await store.publish(ev)
        print(f"   ✓ {stored.topic:28s}  v{stored.aggregate_version}  "
              f"corr={stored.correlation_id[:12]}...")

    # Trace by correlation_id
    print("\n2. Building trace graph...")
    builder = TraceBuilder(reader)
    graph = await builder.build(correlation_id)

    print(f"   Nodes: {len(graph.nodes)}")
    print(f"   Root:  {graph.root.topic if graph.root else 'N/A'}")

    # Timeline
    print("\n3. Timeline (chronological):")
    for node in graph.timeline():
        pad = "  " * node.depth
        print(f"   {pad}├─ {node.topic:28s}  "
              f"v{node.event.aggregate_version}  "
              f"depth={node.depth}")

    # Export JSON
    print("\n4. Export JSON:")
    exported = graph.export_json()
    print(f"   {exported[:500]}...")

    await repo.close()
    print("\n✅ Trace demo complete")


if __name__ == "__main__":
    asyncio.run(main())
