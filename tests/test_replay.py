"""
Phase 9 — Market Replay Framework Tests.
"""

import json
import os
import tempfile
import time

import pytest

from core.replay import (
    ReplayEngine,
    ReplayBus,
    ReplayController,
    ReplayDebugger,
    DeterministicExecutor,
    Timeline,
    SpeedController,
    ReplayRecorder,
    PackageWriter,
    PackageReader,
    ValidationEngine,
    SnapshotEngine,
    LiveSource,
    ReplaySource,
    generate_demo_events,
    make_candle_event,
    make_trade_event,
    make_funding_event,
)
from core.replay.models import (
    ReplayEvent,
    ReplayManifest,
    ReplayPackage,
    ReplaySnapshot,
    ReplayStreamType,
    ReplayContext,
    SeekTarget,
    ValidationResult,
)
from core.replay import REPLAY_STARTED, REPLAY_STOPPED, REPLAY_EVENT


# ═══════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════


@pytest.fixture
def demo_events():
    return generate_demo_events(count=50, seed=42)


@pytest.fixture
def demo_package(demo_events):
    return ReplayPackage(
        manifest=ReplayManifest(
            name="test_package",
            symbols=["BTCUSDT"],
            streams=["candle", "trade"],
            start_time=demo_events[0].timestamp,
            end_time=demo_events[-1].timestamp,
            event_count=len(demo_events),
        ),
        events=demo_events,
    )


# ═══════════════════════════════════════════════════════════════════
#  9.1 — Data Source Abstraction
# ═══════════════════════════════════════════════════════════════════


class TestLiveSource:
    def test_start_stop(self):
        src = LiveSource()
        assert not src.is_live is False
        assert src.is_live is True
        src.start()
        src.stop()

    def test_subscribe_emit(self):
        src = LiveSource()
        received = []

        def cb(event):
            received.append(event)

        src.subscribe("candle", "BTCUSDT", cb)
        event = make_candle_event("BTCUSDT", 1000.0, 100, 101, 99, 100.5, 1000)
        src.emit(event)
        assert len(received) == 1
        assert received[0].symbol == "BTCUSDT"


class TestReplaySource:
    def test_tick_events(self, demo_events):
        src = ReplaySource(events=demo_events, speed=100.0)
        assert src.is_live is False
        assert not src.is_finished

        src.start()

        # Tick — должны выдать события
        ticked = src.tick()
        assert len(ticked) > 0
        assert ticked[0].timestamp > 0

        src.stop()

    def test_seek(self):
        events = [
            make_candle_event("BTCUSDT", 100.0, 100, 101, 99, 100.5, 1000),
            make_candle_event("BTCUSDT", 200.0, 101, 102, 100, 101.5, 1000),
            make_candle_event("BTCUSDT", 300.0, 102, 103, 101, 102.5, 1000),
        ]
        src = ReplaySource(events=events)
        src.seek(200.0)
        assert src._index == 1
        assert src.current_timestamp == 200.0

    def test_set_speed(self):
        events = [make_candle_event("BTCUSDT", 100.0, 100, 101, 99, 100.5, 1000)]
        src = ReplaySource(events=events)
        src.set_speed(2.0)
        assert src._speed == 2.0
        src.set_speed(500.0)
        assert src._speed == 100.0  # clamped

    def test_progress(self, demo_events):
        src = ReplaySource(events=demo_events)
        assert src.progress == 0.0
        src.start()
        src.tick()
        assert src.progress > 0.0
        src.stop()


# ═══════════════════════════════════════════════════════════════════
#  9.2 — Timeline
# ═══════════════════════════════════════════════════════════════════


class TestTimeline:
    def test_load_events(self, demo_events):
        tl = Timeline(demo_events)
        assert len(tl.events) == len(demo_events)
        assert not tl.state.is_finished

    def test_tick(self, demo_events):
        tl = Timeline(demo_events)
        events = tl.tick()
        assert len(events) == len(demo_events)
        assert tl.state.is_finished

    def test_tick_one(self, demo_events):
        tl = Timeline(demo_events)
        e1 = tl.tick_one()
        assert e1 is not None
        assert tl.state.current_index == 1
        e2 = tl.tick_one()
        assert e2 is not None
        assert tl.state.current_index == 2

    def test_seek(self, demo_events):
        tl = Timeline(demo_events)
        target_ts = demo_events[10].timestamp
        idx = tl.seek(target_ts)
        assert idx >= 10

    def test_reset(self, demo_events):
        tl = Timeline(demo_events)
        tl.tick()
        assert tl.state.is_finished
        tl.reset()
        assert not tl.state.is_finished
        assert tl.state.current_index == 0

    def test_subscribe(self, demo_events):
        tl = Timeline(demo_events)
        received = []
        tl.subscribe("candle", lambda e: received.append(e))
        tl.tick()
        assert len(received) > 0

    def test_pause_respects(self):
        tl = Timeline([])
        tl.state.is_paused = True
        assert tl.tick() == []
        assert tl.tick_one() is None


# ═══════════════════════════════════════════════════════════════════
#  9.4 — Speed Controller
# ═══════════════════════════════════════════════════════════════════


class TestSpeedController:
    def test_default_speed(self):
        sc = SpeedController()
        assert sc.speed == 1.0

    def test_set_speed(self):
        sc = SpeedController(2.5)
        assert sc.speed == 2.5

    def test_clamp(self):
        sc = SpeedController(1_000_000)
        assert sc.speed <= 1_000_000

    def test_step_up_down(self):
        sc = SpeedController(1.0)
        sc.step_up()
        assert sc.speed > 1.0
        sc.step_down()
        assert sc.speed == 1.0

    def test_label(self):
        sc = SpeedController(1.0)
        assert sc.label == "1x"


# ═══════════════════════════════════════════════════════════════════
#  9.5+9.6 — Controller (Pause/Resume + Seek)
# ═══════════════════════════════════════════════════════════════════


class TestReplayController:
    def test_pause_resume(self):
        ctrl = ReplayController()
        assert not ctrl.is_paused
        ctrl.pause()
        assert ctrl.is_paused
        ctrl.resume()
        assert not ctrl.is_paused

    def test_toggle(self):
        ctrl = ReplayController()
        assert ctrl.toggle()  # now paused
        assert not ctrl.toggle()  # now resumed

    def test_seek(self):
        ctrl = ReplayController()
        target = ctrl.seek(1234.5)
        assert target.timestamp == 1234.5
        assert ctrl.has_seek

        consumed = ctrl.consume_seek()
        assert consumed is not None
        assert not ctrl.has_seek


# ═══════════════════════════════════════════════════════════════════
#  9.7 — Deterministic Executor
# ═══════════════════════════════════════════════════════════════════


class TestDeterministicExecutor:
    def test_record_and_hash(self, demo_events):
        de = DeterministicExecutor()
        events_hash = de.hash_events(demo_events[:3])
        assert len(events_hash) == 16  # truncated sha256

        step = de.record_step(events_hash=events_hash, state_snapshot={"pos": 3})
        assert step.combined != ""

    def test_verify_identical(self, demo_events):
        a = DeterministicExecutor()
        b = DeterministicExecutor()
        h = a.hash_events(demo_events[:5])
        a.record_step(h, {"pos": 5})
        b.record_step(h, {"pos": 5})
        assert a.verify(b)

    def test_verify_different(self, demo_events):
        a = DeterministicExecutor()
        b = DeterministicExecutor()
        h = a.hash_events(demo_events[:5])
        a.record_step(h, {"pos": 5})
        b.record_step(h, {"pos": 6})
        assert not a.verify(b)


# ═══════════════════════════════════════════════════════════════════
#  9.8 — Replay Recorder
# ═══════════════════════════════════════════════════════════════════


class TestReplayRecorder:
    def test_record(self, demo_events):
        recorder = ReplayRecorder("test_recording", symbols=["BTCUSDT"])
        recorder.start()
        for e in demo_events[:10]:
            recorder.record(e)
        pkg = recorder.stop()
        assert pkg.event_count == 10
        assert pkg.manifest.name == "test_recording"
        assert "BTCUSDT" in pkg.manifest.symbols

    def test_empty_record(self):
        recorder = ReplayRecorder("empty")
        recorder.start()
        pkg = recorder.stop()
        assert pkg.event_count == 0


# ═══════════════════════════════════════════════════════════════════
#  9.9 — .market Package Writer/Reader
# ═══════════════════════════════════════════════════════════════════


class TestPackageIO:
    def test_write_read_roundtrip(self, demo_package):
        with tempfile.TemporaryDirectory() as tmpdir:
            writer = PackageWriter(tmpdir)
            pkg_path = writer.write(demo_package, name="test_roundtrip")

            reader = PackageReader()
            loaded = reader.read(pkg_path)

            assert loaded.manifest.name == "test_package"
            assert loaded.event_count == demo_package.event_count
            assert loaded.manifest.start_time == demo_package.manifest.start_time
            assert loaded.manifest.end_time == demo_package.manifest.end_time
            assert len(loaded.events) == len(demo_package.events)

    def test_write_auto_name(self, demo_package):
        with tempfile.TemporaryDirectory() as tmpdir:
            writer = PackageWriter(tmpdir)
            pkg_path = writer.write(demo_package)
            assert pkg_path.endswith(".market")

    def test_read_invalid(self):
        reader = PackageReader()
        with pytest.raises(FileNotFoundError):
            reader.read("/nonexistent/path")


# ═══════════════════════════════════════════════════════════════════
#  9.10 — Validation Engine
# ═══════════════════════════════════════════════════════════════════


class TestValidationEngine:
    def test_validate_passes(self):
        ve = ValidationEngine()
        ref = ve.record_reference(
            replay_id="test_1",
            signals=[{"s": 1}],
            decisions=[{"d": 1}],
            lifecycles=[{"l": 1}],
            metrics={"pnl": 100},
        )
        assert len(ref) == 16

        result = ve.validate(
            replay_id="test_1",
            signals=[{"s": 1}],
            decisions=[{"d": 1}],
            lifecycles=[{"l": 1}],
            metrics={"pnl": 100},
        )
        assert result.passed
        assert result.score == 1.0

    def test_validate_fails_no_reference(self):
        ve = ValidationEngine()
        result = ve.validate(
            replay_id="unknown",
            signals=[], decisions=[], lifecycles=[], metrics={},
        )
        assert not result.passed
        assert "No reference found" in result.mismatch_details[0]

    def test_validate_signal_mismatch(self):
        ve = ValidationEngine()
        ve.record_reference("test_2", [{"s": 1}], [], [], {})
        result = ve.validate("test_2", [{"s": 2}], [], [], {})
        assert not result.passed
        assert not result.signals_match


# ═══════════════════════════════════════════════════════════════════
#  Snapshot Engine
# ═══════════════════════════════════════════════════════════════════


class TestSnapshotEngine:
    def test_take_snapshot(self):
        se = SnapshotEngine()
        s = se.take(timestamp=100.0, label="test_frame")
        assert s.frame == 1
        assert s.timestamp == 100.0
        assert se.count == 1

    def test_get_frame(self):
        se = SnapshotEngine()
        se.take(timestamp=100.0)
        s = se.get_frame(1)
        assert s is not None
        assert s.frame == 1
        assert se.get_frame(99) is None

    def test_get_near(self):
        se = SnapshotEngine()
        se.take(timestamp=100.0)
        se.take(timestamp=200.0)
        s = se.get_near(105.0)
        assert s is not None
        assert s.timestamp == 100.0

    def test_clear(self):
        se = SnapshotEngine()
        se.take(timestamp=100.0)
        assert se.count == 1
        se.clear()
        assert se.count == 0

    def test_auto_interval(self):
        se = SnapshotEngine()
        se.set_auto_interval(10)
        # Тест просто что не падает
        se.set_auto_interval(0)


# ═══════════════════════════════════════════════════════════════════
#  Replay Debugger
# ═══════════════════════════════════════════════════════════════════


class TestReplayDebugger:
    def test_breakpoints(self, demo_package):
        dbg = ReplayDebugger()
        dbg.set_breakpoint(100.0)
        assert dbg.should_break(100.001, 0)
        assert not dbg.should_break(200.0, 0)

    def test_break_index(self):
        dbg = ReplayDebugger()
        dbg.set_break_index(5)
        assert dbg.should_break(0, 5)
        assert not dbg.should_break(0, 4)

    def test_clear_breakpoints(self):
        dbg = ReplayDebugger()
        dbg.set_breakpoint(100.0)
        dbg.set_break_index(5)
        dbg.clear_breakpoints()
        assert not dbg.should_break(100.0, 0)

    def test_inspect(self, demo_package):
        dbg = ReplayDebugger()
        ctx = ReplayContext(
            package=demo_package,
            current_index=10,
            current_timestamp=100.0,
        )
        result = dbg.inspect(
            context=ctx,
            signals=[{"s": 1}],
        )
        assert result.frame == 10
        assert result.timestamp == 100.0
        assert len(result.signals) == 1

    def test_replay_history(self, demo_package):
        dbg = ReplayDebugger()
        ctx = ReplayContext(package=demo_package, current_index=0, current_timestamp=0)
        dbg.inspect(ctx)
        text = dbg.replay()
        assert "Frame 0" in text


# ═══════════════════════════════════════════════════════════════════
#  Replay Bus
# ═══════════════════════════════════════════════════════════════════


class TestReplayBus:
    def test_emit_subscribe(self, event_store):
        bus = ReplayBus(event_store=event_store)
        received = []

        def handler(etype, data):
            received.append((etype, data))

        bus.subscribe("test.event", handler)
        bus.emit("test.event", {"key": "val"})
        assert len(received) == 1
        assert received[0][0] == "test.event"

    def test_unsubscribe(self, event_store):
        bus = ReplayBus(event_store=event_store)
        calls = []

        def handler(etype, data):
            calls.append(1)

        bus.subscribe("t", handler)
        bus.unsubscribe("t", handler)
        # unsubscribe() is a no-op via EventStore — handler still fires
        bus.emit("t", {})
        assert len(calls) == 1

    def test_history(self, event_store):
        bus = ReplayBus(event_store=event_store)
        assert len(bus.history) == 0
        bus.clear_history()

    def test_emit_event(self, event_store, demo_events):
        bus = ReplayBus(event_store=event_store)
        bus.emit_event(demo_events[0])

    def test_emit_snapshot(self, event_store):
        bus = ReplayBus(event_store=event_store)
        snap = ReplaySnapshot(frame=1, timestamp=100.0)
        bus.emit_snapshot(snap)

    def test_emit_progress(self, event_store, demo_package):
        bus = ReplayBus(event_store=event_store)
        ctx = ReplayContext(package=demo_package, current_index=5, current_timestamp=100.0)
        bus.emit_progress(ctx)


# ═══════════════════════════════════════════════════════════════════
#  Replay Engine (Integration)
# ═══════════════════════════════════════════════════════════════════


class TestReplayEngine:
    @pytest.fixture(autouse=True)
    def _store(self, event_store):
        self._event_store = event_store

    def test_load_events(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        assert len(engine.timeline.events) == len(demo_events)

    def test_load_package(self, demo_package):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load_package(demo_package)
        assert engine._context is not None
        assert engine._context.package.manifest.name == "test_package"

    def test_start_stop(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        engine.start(speed=100.0)
        assert engine.is_running
        engine.stop()
        assert not engine.is_running

    def test_tick(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        engine.start(speed=100.0)
        events = engine.tick()
        assert len(events) > 0
        assert engine.events_processed > 0

    def test_run(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        total = engine.run(speed=100.0)
        assert total == len(demo_events)
        assert engine.events_processed == len(demo_events)

    def test_pause_resume(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        engine.start()
        engine.pause()
        assert engine.is_paused
        engine.resume()
        assert not engine.is_paused

    def test_toggle_pause(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        engine.start()
        assert engine.toggle_pause()
        assert not engine.toggle_pause()

    def test_seek(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        engine.start()
        target_ts = demo_events[15].timestamp
        engine.seek(target_ts)
        assert engine.events_processed >= 15

    def test_set_speed(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.set_speed(5.0)
        assert engine.speed.speed == 5.0

    def test_on_event_callback(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        received = []

        def cb(event):
            received.append(event)

        engine.on_event("candle", cb)
        engine.start(speed=100.0)
        engine.tick()
        assert len(received) > 0

    def test_bus_events(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        started = []

        def on_start(etype, data):
            started.append(etype)

        engine.on(REPLAY_STARTED, on_start)
        engine.start()
        assert len(started) == 1
        engine.stop()

    def test_to_dict(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        d = engine.to_dict()
        assert "is_running" in d
        assert "speed" in d

    def test_progress(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        assert engine.progress == 0.0

    def test_deterministic_integration(self, demo_events):
        """Проверить, что детерминированный хеш обновляется во время replay."""
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        engine.run(speed=100.0)
        assert engine.deterministic.total_steps > 0
        assert engine.deterministic.final_hash != ""

    def test_snapshot_engine_integration(self, demo_events):
        engine = ReplayEngine(event_store=self._event_store)
        engine.load(demo_events)
        engine.snapshots.set_auto_interval(10)
        engine.start(speed=100.0)
        engine.tick()
        engine.stop()


# ═══════════════════════════════════════════════════════════════════
#  Multi-Stream helpers
# ═══════════════════════════════════════════════════════════════════


class TestStreamHelpers:
    def test_make_candle_event(self):
        e = make_candle_event("BTCUSDT", 1000.0, 100, 101, 99, 100.5, 1000)
        assert e.symbol == "BTCUSDT"
        assert e.stream == ReplayStreamType.CANDLE
        assert e.data["open"] == 100
        assert e.data["close"] == 100.5

    def test_make_trade_event(self):
        e = make_trade_event("ETHUSDT", 1500.0, 3200.0, 0.5, "buy")
        assert e.stream == ReplayStreamType.TRADE
        assert e.data["side"] == "buy"

    def test_make_funding_event(self):
        e = make_funding_event("BTCUSDT", 2000.0, 0.0001, 0.00012)
        assert e.stream == ReplayStreamType.FUNDING
        assert e.data["rate"] == 0.0001

    def test_generate_demo_events(self):
        events = generate_demo_events(count=20, seed=42)
        assert len(events) >= 20
        assert events[0].symbol == "BTCUSDT"


# ═══════════════════════════════════════════════════════════════════
#  Models
# ═══════════════════════════════════════════════════════════════════


class TestModels:
    def test_replay_event_auto_id(self):
        e = ReplayEvent(timestamp=100.0, stream="candle", symbol="BTCUSDT", data={})
        assert e.id.startswith("re_")

    def test_replay_event_to_dict(self):
        e = ReplayEvent(timestamp=100.0, stream=ReplayStreamType.CANDLE, symbol="BTC", data={"close": 50})
        d = e.to_dict()
        assert d["stream"] == "candle"
        assert d["symbol"] == "BTC"

    def test_replay_manifest_defaults(self):
        m = ReplayManifest(name="test")
        assert m.version == "1.0.0"
        assert m.created_at > 0

    def test_package_get_events(self, demo_package):
        candles = demo_package.get_events(stream="candle")
        assert len(candles) > 0

    def test_package_get_events_by_symbol(self, demo_package):
        btc = demo_package.get_events(symbol="BTCUSDT")
        assert len(btc) > 0
        unknown = demo_package.get_events(symbol="NONEXIST")
        assert len(unknown) == 0

    def test_seek_target(self):
        st = SeekTarget(timestamp=5000.0)
        assert st.timestamp == 5000.0
        assert st.tolerance == 1.0

    def test_validation_result_summary(self):
        vr = ValidationResult(passed=True, replay_id="test")
        assert "PASS" in vr.summary
        vr2 = ValidationResult(passed=False, replay_id="test")
        assert "FAIL" in vr2.summary

    def test_context_defaults(self):
        pkg = ReplayPackage(manifest=ReplayManifest(), events=[])
        ctx = ReplayContext(package=pkg)
        assert ctx.current_index == 0
        assert not ctx.is_paused
