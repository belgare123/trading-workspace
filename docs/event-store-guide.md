# Event Store Guide

> **v0.15.0** — Persisted Event Journal for Trading Workspace Platform

## Overview

Event Store — центральный persisted журнал событий. Все подсистемы (Lifecycle, Quality, Learning, Replay) пишут и читают через единый интерфейс.

```
Decision ─┐
Lifecycle ─┤
Quality ───┤→ EventStore → SQLite (WAL mode)
Learning ──┤
Replay ────┘
```

## Architecture

```
EventStore (facade)
  ├── publish(event) → StoredEvent      # запись
  ├── publish_sync(event) → StoredEvent # синхронная запись
  └── read(query) → list[StoredEvent]  # чтение

SQLiteEventRepository (storage)
  ├── connect() / close()
  ├── append(event) / append_sync()
  ├── query(query)
  └── Transaction support

EventStoreReader (read-optimized facade)
  ├── by_topic(topic)
  ├── by_aggregate(aggregate, id)
  ├── by_correlation(correlation_id)
  ├── range(from_ts, to_ts)
  └── paginated(limit, offset)

TraceBuilder (graph traversal)
  ├── build(correlation_id) → TraceGraph
  └── build_from_event(event_id) → TraceGraph

AggregateRepository (event sourcing)
  ├── load(type, id) → AggregateStream
  ├── append(type, id, events, expected_version)
  ├── save_snapshot(snapshot)
  ├── load_snapshot(type, id)
  ├── delete_snapshot(type, id)
  ├── cleanup_snapshots(max_age_days)
  └── restore(type, id) → current_state
```

## Storage

SQLite с WAL mode:

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA busy_timeout=5000;
```

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_events_aggregate` | `(aggregate, aggregate_id)` | Stream loading |
| `idx_events_agg_ver` | `(aggregate, aggregate_id, aggregate_version)` | Version queries |
| `idx_events_topic` | `(topic)` | Topic subscriptions |
| `idx_events_corr` | `(correlation_id)` | Trace queries |
| `idx_events_ts` | `(timestamp)` | Time-range queries |
| `idx_snapshots_ts` | `(timestamp)` | Snapshot cleanup |

## Usage

### Write

```python
from core.event_store import StoredEvent, EventStore
from core.event_store.sqlite_repo import SQLiteEventRepository

repo = SQLiteEventRepository(db_path="data/events.db")
await repo.connect()

store = EventStore(repository=repo)

event = StoredEvent.new(
    aggregate="market",
    aggregate_id="BTCUSDT",
    topic="market.candle",
    payload=b'{"open": 65000, "close": 65100}',
    source="exchange",
)
stored = await store.publish(event)
```

### Read

```python
from core.event_store import EventStoreReader
from core.event_store.repository import EventQuery

reader = EventStoreReader(store)

# By topic
events = await reader.by_topic("market.candle", limit=10)

# By time range
events = await reader.range(from_ts=1700000000, to_ts=1700003600)

# Correlation trace
events = await store.read(
    EventQuery(correlation_id="order_abc123")
)
```

### Replay from Event Store

```python
from core.replay import Timeline

events = await reader.by_topic("market.candle", since=start_ts, until=end_ts)
tl = Timeline(events)
tl.run()  # или tick() для пошагового
```

### Aggregate Streams

```python
from core.event_store import AggregateRepository

agg_repo = AggregateRepository(store)

stream = await agg_repo.load("order", "order#123")
latest = stream.latest  # последнее событие

# Append with optimistic concurrency
await agg_repo.append("order", "order#123", [new_event], expected_version=5)

# Snapshot
await agg_repo.save_snapshot(AggregateSnapshot(
    aggregate_type="order", aggregate_id="order#123",
    version=42, state={"status": "filled"}, timestamp=time.time()
))

# Restore (snapshot + remaining events)
state = await agg_repo.restore("order", "order#123")
```

### Trace Graph

```python
from core.event_store import TraceBuilder

builder = TraceBuilder(reader)
graph = await builder.build(correlation_id="trade_flow_abc")
graph.export_json()  # для визуализации
```

## Concurrency

Event Store поддерживает высокую конкурентность:

- **WAL mode** — concurrent reads не блокируют writes
- **100 concurrent appends** — все проходят, версии корректны
- **100 concurrent reads** — без блокировок
- **50 write + 50 read mixed** — стабильно

## Performance Baseline (v0.15.0)

| Metric | Throughput |
|--------|-----------|
| Event append (single) | ~2,665/s |
| Concurrent batch (100) | ~25,563/s |
| Replay (1000 events) | ~2,118/s |
| Aggregate restore (50 events) | ~1,567/s |
| Trace build (50 events) | ~1,624/s |

## Snapshot Policy

```python
# Очистка снимков старше 30 дней
await agg_repo.cleanup_snapshots(max_age_days=30.0)
```

Схема хранения — `PRIMARY KEY (aggregate_type, aggregate_id)` с `INSERT OR REPLACE`,
поэтому хранится только последний снимок на агрегат.

## CLI (quick check)

```bash
# Count events
python -c "from core.event_store import SQLiteEventRepository; import asyncio; r = SQLiteEventRepository(db_path='data/events.db'); asyncio.run(r.connect()); print(asyncio.run(r.count()))"

# Latest events
python -c "
import asyncio, json
from core.event_store import SQLiteEventRepository, EventStore, StoredEvent
r = SQLiteEventRepository(db_path='data/events.db')
asyncio.run(r.connect())
s = EventStore(repository=r)
q = ...  # EventQuery
print(json.dumps([asyncio.run(s.read(q))], default=str))
"
```
