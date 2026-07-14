"""Stress tests: Replay Engine under high volume.

Tests cover high-event-count scenarios for core replay components.
"""
from __future__ import annotations

import asyncio

import pytest

from core.event_store import EventStore, SQLiteEventRepository
from core.replay import ReplayEngine, ReplayRecorder, Timeline, generate_demo_events


@pytest.fixture
def events_1000():
    """~1243 events: 1000 candles + trades/tickers/liquidations."""
    return generate_demo_events(count=1000, seed=42)


@pytest.fixture
def store():
    repo = SQLiteEventRepository(db_path=":memory:")
    asyncio.run(repo.connect())
    s = EventStore(repository=repo)
    yield s
    asyncio.run(repo.close())


# ═══════════════════════════════════════════════════════════════════
#  Timeline — high event count
# ═══════════════════════════════════════════════════════════════════


class TestTimelineStress:

    def test_tick_all(self, events_1000):
        tl = Timeline(events_1000)
        total = len(tl.events)
        assert total > 1000

        evs = tl.tick()
        assert len(evs) == total
        assert tl.state.is_finished

    def test_tick_one_by_one(self, events_1000):
        tl = Timeline(events_1000)
        count = 0
        while True:
            ev = tl.tick_one()
            if ev is None:
                break
            count += 1
        assert count == len(tl.events)

    def test_seek_middle_and_reset(self, events_1000):
        tl = Timeline(events_1000)
        target = events_1000[len(events_1000) // 2].timestamp
        idx = tl.seek(target)
        assert idx > 0
        assert idx < len(events_1000)
        assert tl.state.current_index == idx

        tl.reset()
        assert tl.state.current_index == 0

    def test_sequential_ticks(self, events_1000):
        """Tick 5 times, verify each returns increasing timestamps."""
        tl = Timeline(events_1000)
        last_ts = 0.0
        for _ in range(5):
            evs = tl.tick()
            if tl.state.is_finished:
                break
            if evs:
                assert evs[0].timestamp >= last_ts
                last_ts = evs[-1].timestamp


# ═══════════════════════════════════════════════════════════════════
#  ReplayEngine — 1000 events
# ═══════════════════════════════════════════════════════════════════


class TestEngineStress:

    def test_load_and_count(self, store, events_1000):
        engine = ReplayEngine(event_store=store)
        engine.load(events_1000)
        assert len(engine.timeline.events) == len(events_1000)

    def test_run_all(self, store, events_1000):
        engine = ReplayEngine(event_store=store)
        engine.load(events_1000)
        total = engine.run(speed=1000.0)
        assert total == len(events_1000)
        assert engine.events_processed == len(events_1000)

    def test_start_stop(self, store, events_1000):
        engine = ReplayEngine(event_store=store)
        engine.load(events_1000)
        engine.start(speed=100.0)
        assert engine.is_running
        engine.stop()
        assert not engine.is_running

    def test_pause_resume(self, store, events_1000):
        engine = ReplayEngine(event_store=store)
        engine.load(events_1000)
        engine.start(speed=100.0)
        engine.pause()
        assert engine.is_paused
        engine.resume()
        assert not engine.is_paused
        engine.run(speed=100.0)
        assert engine.events_processed == len(events_1000)


# ═══════════════════════════════════════════════════════════════════
#  ReplayRecorder — 1000 events
# ═══════════════════════════════════════════════════════════════════


class TestRecorderStress:

    def test_record_1000_events(self, events_1000):
        recorder = ReplayRecorder("stress", symbols=["BTCUSDT"])
        recorder.start()
        for ev in events_1000:
            recorder.record(ev)
        pkg = recorder.stop()
        assert pkg.event_count == len(events_1000)
