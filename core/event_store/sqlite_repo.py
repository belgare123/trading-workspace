"""SQLiteEventRepository — реализация EventRepository через SQLite."""

from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, AsyncIterator

from core.event_store.models import (
    EventNotFoundError,
    EventStoreError,
    StoredEvent,
)
from core.event_store.repository import EventQuery

logger = logging.getLogger(__name__)

# Максимальный размер payload в байтах (50MB для совместимости с SQLite)
MAX_PAYLOAD_BYTES = 50 * 1024 * 1024

# Размер пачки для iter_all
_ITER_BATCH = 500

# Default path under user data
_DEFAULT_DB_DIR = Path.home() / "AppData" / "Local" / "hermes" / "event_store"
_DEFAULT_DB_PATH = _DEFAULT_DB_DIR / "events.db"


class SQLiteEventRepository:
    """SQLite-реализация EventRepository.

    Schema:

    .. code-block:: sql

        CREATE TABLE events (
            event_id          TEXT PRIMARY KEY,
            aggregate         TEXT NOT NULL,
            aggregate_id      TEXT NOT NULL,
            aggregate_version INTEGER NOT NULL,
            topic             TEXT NOT NULL,
            timestamp         REAL NOT NULL,
            correlation_id    TEXT NOT NULL DEFAULT '',
            causation_id      TEXT NOT NULL DEFAULT '',
            source            TEXT NOT NULL DEFAULT '',
            payload           BLOB,
            metadata          TEXT NOT NULL DEFAULT '{}'
        );

        CREATE INDEX idx_events_aggregate ON events(aggregate, aggregate_id);
        CREATE INDEX idx_events_topic    ON events(topic);
        CREATE INDEX idx_events_corr     ON events(correlation_id);
        CREATE INDEX idx_events_ts       ON events(timestamp);
    """

    def __init__(self, db_path: str | Path | None = None):
        self._db_path = Path(db_path or _DEFAULT_DB_PATH)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: sqlite3.Connection | None = None
        self._lock = __import__("threading").Lock()

    # ── Connection management ──

    async def connect(self) -> None:
        """Открыть соединение (если не открыто)."""
        if self._conn is not None:
            return
        self._conn = sqlite3.connect(str(self._db_path))
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        await self._migrate()

    async def _migrate(self) -> None:
        conn = self._conn
        if conn is None:
            raise EventStoreError("Not connected")
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                event_id          TEXT PRIMARY KEY,
                aggregate         TEXT NOT NULL,
                aggregate_id      TEXT NOT NULL,
                aggregate_version INTEGER NOT NULL,
                topic             TEXT NOT NULL,
                timestamp         REAL NOT NULL,
                correlation_id    TEXT NOT NULL DEFAULT '',
                causation_id      TEXT NOT NULL DEFAULT '',
                source            TEXT NOT NULL DEFAULT '',
                payload           BLOB,
                metadata          TEXT NOT NULL DEFAULT '{}'
            );
            CREATE INDEX IF NOT EXISTS idx_events_aggregate
                ON events(aggregate, aggregate_id);
            CREATE INDEX IF NOT EXISTS idx_events_topic
                ON events(topic);
            CREATE INDEX IF NOT EXISTS idx_events_corr
                ON events(correlation_id);
            CREATE INDEX IF NOT EXISTS idx_events_ts
                ON events(timestamp);
        """)
        conn.commit()

    def _ensure_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            raise EventStoreError(
                "SQLiteEventRepository not connected. Call .connect() first."
            )
        return self._conn

    async def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    # ── Write ──

    async def append(self, event: StoredEvent, conn: Any = None) -> StoredEvent:
        db = conn or self._ensure_conn()
        with self._lock:
            # Auto compute aggregate_version
            if event.aggregate_version == 0:
                cur = db.execute(
                    "SELECT COALESCE(MAX(aggregate_version), 0) + 1 AS next_ver "
                    "FROM events WHERE aggregate_id = ?",
                    (event.aggregate_id,),
                )
                row = cur.fetchone()
                next_ver = row["next_ver"] if row else 1
                event = StoredEvent(
                    event_id=event.event_id,
                    aggregate=event.aggregate,
                    aggregate_id=event.aggregate_id,
                    aggregate_version=next_ver,
                    topic=event.topic,
                    timestamp=event.timestamp,
                    correlation_id=event.correlation_id,
                    causation_id=event.causation_id,
                    source=event.source,
                    payload=event.payload,
                    metadata=event.metadata,
                )

            db.execute(
                """INSERT OR IGNORE INTO events
                   (event_id, aggregate, aggregate_id, aggregate_version,
                    topic, timestamp, correlation_id, causation_id, source,
                    payload, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    event.event_id,
                    event.aggregate,
                    event.aggregate_id,
                    event.aggregate_version,
                    event.topic,
                    event.timestamp,
                    event.correlation_id,
                    event.causation_id,
                    event.source,
                    event.payload,
                    json.dumps(event.metadata, default=str),
                ),
            )
            if conn is None:
                db.commit()
        return event

    async def append_batch(self, events: list[StoredEvent], conn: Any = None) -> list[StoredEvent]:
        db = conn or self._ensure_conn()
        result: list[StoredEvent] = []
        for ev in events:
            result.append(await self.append(ev, conn=db))
        if conn is None:
            db.commit()
        return result

    # ── Read ──

    async def read(self, query: EventQuery) -> list[StoredEvent]:
        db = self._ensure_conn()
        clauses: list[str] = []
        params: list[Any] = []

        if query.aggregate is not None:
            clauses.append("aggregate = ?")
            params.append(query.aggregate)
        if query.aggregate_id is not None:
            clauses.append("aggregate_id = ?")
            params.append(query.aggregate_id)
        if query.topic is not None:
            clauses.append("topic = ?")
            params.append(query.topic)
        if query.correlation_id:
            clauses.append("correlation_id = ?")
            params.append(query.correlation_id)
        if query.causation_id:
            clauses.append("causation_id = ?")
            params.append(query.causation_id)
        if query.source:
            clauses.append("source = ?")
            params.append(query.source)
        if query.from_version is not None:
            clauses.append("aggregate_version >= ?")
            params.append(query.from_version)
        if query.to_version is not None:
            clauses.append("aggregate_version <= ?")
            params.append(query.to_version)
        if query.from_timestamp is not None:
            clauses.append("timestamp >= ?")
            params.append(query.from_timestamp)
        if query.to_timestamp is not None:
            clauses.append("timestamp <= ?")
            params.append(query.to_timestamp)

        where = " AND ".join(clauses) if clauses else "1=1"
        order_clause = "ASC" if query.order == "asc" else "DESC"
        sql = (
            f"SELECT * FROM events WHERE {where} "
            f"ORDER BY aggregate_version {order_clause}, timestamp {order_clause} "
            f"LIMIT ? OFFSET ?"
        )
        params.extend([query.limit, query.offset])

        rows = db.execute(sql, params).fetchall()
        return [self._row_to_event(r) for r in rows]

    async def read_one(self, event_id: str) -> StoredEvent:
        db = self._ensure_conn()
        row = db.execute(
            "SELECT * FROM events WHERE event_id = ?", (event_id,)
        ).fetchone()
        if row is None:
            raise EventNotFoundError(f"Event {event_id} not found")
        return self._row_to_event(row)

    async def count(self, query: EventQuery) -> int:
        db = self._ensure_conn()
        clauses: list[str] = []
        params: list[Any] = []

        if query.aggregate is not None:
            clauses.append("aggregate = ?")
            params.append(query.aggregate)
        if query.aggregate_id is not None:
            clauses.append("aggregate_id = ?")
            params.append(query.aggregate_id)
        if query.topic is not None:
            clauses.append("topic = ?")
            params.append(query.topic)
        if query.correlation_id:
            clauses.append("correlation_id = ?")
            params.append(query.correlation_id)
        if query.source:
            clauses.append("source = ?")
            params.append(query.source)

        where = " AND ".join(clauses) if clauses else "1=1"
        row = db.execute(
            f"SELECT COUNT(*) AS cnt FROM events WHERE {where}", params
        ).fetchone()
        return row["cnt"] if row else 0

    async def latest_version(self, aggregate_id: str) -> int:
        db = self._ensure_conn()
        row = db.execute(
            "SELECT COALESCE(MAX(aggregate_version), 0) AS max_ver "
            "FROM events WHERE aggregate_id = ?",
            (aggregate_id,),
        ).fetchone()
        return row["max_ver"] if row else 0

    async def tail(self, limit: int = 50) -> list[StoredEvent]:
        db = self._ensure_conn()
        rows = db.execute(
            "SELECT * FROM events ORDER BY timestamp DESC, aggregate_version DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [self._row_to_event(r) for r in rows]

    async def iter_all(self, query: EventQuery) -> AsyncIterator[StoredEvent]:
        """Ленивый итератор с пагинацией по aggregate_version."""
        import asyncio

        limit = query.limit
        offset = query.offset
        while True:
            batch_query = query.clone(limit=_ITER_BATCH, offset=offset)
            batch = await self.read(batch_query)
            if not batch:
                break
            for ev in batch:
                yield ev
                await asyncio.sleep(0)  # даём циклу событий喘息
            offset += len(batch)
            # Если запросили меньше чем _ITER_BATCH — это последняя страница
            if len(batch) < _ITER_BATCH:
                break

    # ── Helpers ──

    @staticmethod
    def _row_to_event(row: sqlite3.Row) -> StoredEvent:
        payload = row["payload"]
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        metadata_raw = row["metadata"]
        metadata: dict[str, Any] = {}
        if metadata_raw:
            try:
                metadata = json.loads(metadata_raw)
            except (json.JSONDecodeError, TypeError):
                metadata = {"_raw": metadata_raw}
        return StoredEvent(
            event_id=row["event_id"],
            aggregate=row["aggregate"],
            aggregate_id=row["aggregate_id"],
            aggregate_version=row["aggregate_version"],
            topic=row["topic"],
            timestamp=row["timestamp"],
            correlation_id=row["correlation_id"],
            causation_id=row["causation_id"],
            source=row["source"],
            payload=payload if isinstance(payload, bytes) else b"",
            metadata=metadata,
        )

    # ── Transaction support ──

    async def transaction(self) -> sqlite3.Connection:
        """Начать транзакцию и вернуть connection для передачи в append()."""
        db = self._ensure_conn()
        db.execute("BEGIN")
        return db

    async def commit(self, conn: sqlite3.Connection | None = None) -> None:
        if conn:
            conn.commit()

    async def rollback(self, conn: sqlite3.Connection | None = None) -> None:
        if conn:
            conn.rollback()
