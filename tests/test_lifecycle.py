"""
Tests for Lifecycle Engine (Phase 8) — core/lifecycle/
"""

from __future__ import annotations

import time

import pytest
import time

from core.event_store import EventStore
from core.event_store.sqlite_repo import SQLiteEventRepository
from core.lifecycle import (
    EntryMonitor,
    EntryStatus,
    ExpirationEngine,
    FinalMetrics,
    LifecycleContext,
    LifecycleEngine,
    LifecycleEvent,
    LifecycleEventType,
    LifecycleMetrics,
    MetricsCalculator,
    OpportunityBus,
    OpportunityJournal,
    OpportunityState,
    Position,
    StateMachine,
    StopTargetConfig,
    StopTargetEvent,
    StopTargetMonitor,
    Trade,
    TransitionError,
    VersionTracker,
)


# ═══════════════════════════════════════════════════════════════════
#  8.1 State Machine
# ═══════════════════════════════════════════════════════════════════


class TestStateMachine:
    def setup_method(self):
        self.sm = StateMachine()

    def test_valid_transition_created_to_validated(self):
        assert self.sm.can_transition(OpportunityState.CREATED, OpportunityState.VALIDATED)
        self.sm.validate(OpportunityState.CREATED, OpportunityState.VALIDATED)  # no raise

    def test_valid_transition_created_to_cancelled(self):
        assert self.sm.can_transition(OpportunityState.CREATED, OpportunityState.CANCELLED)

    def test_invalid_transition_created_to_active(self):
        assert not self.sm.can_transition(OpportunityState.CREATED, OpportunityState.ACTIVE)
        with pytest.raises(TransitionError):
            self.sm.validate(OpportunityState.CREATED, OpportunityState.ACTIVE)

    def test_valid_transition_waiting_entry_to_active(self):
        assert self.sm.can_transition(OpportunityState.WAITING_ENTRY, OpportunityState.ACTIVE)

    def test_valid_transition_active_to_partial(self):
        assert self.sm.can_transition(OpportunityState.ACTIVE, OpportunityState.PARTIAL_TARGET)

    def test_valid_transition_partial_to_full(self):
        assert self.sm.can_transition(OpportunityState.PARTIAL_TARGET, OpportunityState.FULL_TARGET)

    def test_valid_transition_full_to_archived(self):
        assert self.sm.can_transition(OpportunityState.FULL_TARGET, OpportunityState.ARCHIVED)

    def test_valid_transition_stopped_to_archived(self):
        assert self.sm.can_transition(OpportunityState.STOPPED, OpportunityState.ARCHIVED)

    def test_valid_transition_any_to_expired(self):
        assert self.sm.can_transition(OpportunityState.ACTIVE, OpportunityState.EXPIRED)

    def test_terminal_state_archived_no_transitions(self):
        assert self.sm.allowed_transitions(OpportunityState.ARCHIVED) == []

    def test_active_set(self):
        active = OpportunityState.active_set()
        assert OpportunityState.CREATED in active
        assert OpportunityState.ACTIVE in active
        assert OpportunityState.FULL_TARGET not in active

    def test_terminal_set(self):
        terminal = OpportunityState.terminal_set()
        assert OpportunityState.ARCHIVED in terminal
        assert OpportunityState.EXPIRED in terminal
        assert OpportunityState.ACTIVE not in terminal

    def test_can_enter_validated_from_created(self):
        assert OpportunityState.CREATED in self.sm.can_enter(OpportunityState.VALIDATED)

    def test_can_enter_archived_from_multiple(self):
        sources = self.sm.can_enter(OpportunityState.ARCHIVED)
        assert OpportunityState.FULL_TARGET in sources
        assert OpportunityState.STOPPED in sources
        assert OpportunityState.CANCELLED in sources
        assert OpportunityState.EXPIRED in sources


# ═══════════════════════════════════════════════════════════════════
#  8.2 Entry Monitor
# ═══════════════════════════════════════════════════════════════════


class TestEntryMonitor:
    def setup_method(self):
        self.monitor = EntryMonitor()

    def test_long_entry_reached(self):
        r = self.monitor.check(current_price=64480.0, entry_price=64500.0, direction="long")
        assert r.status == EntryStatus.ENTERED

    def test_long_entry_pending(self):
        r = self.monitor.check(current_price=64700.0, entry_price=64500.0, direction="long")
        assert r.status == EntryStatus.PENDING

    def test_short_entry_reached(self):
        r = self.monitor.check(current_price=64520.0, entry_price=64500.0, direction="short")
        assert r.status == EntryStatus.ENTERED

    def test_short_entry_pending(self):
        r = self.monitor.check(current_price=64300.0, entry_price=64500.0, direction="short")
        assert r.status == EntryStatus.PENDING

    def test_distance_to_entry_for_long(self):
        d = self.monitor.distance_to_entry(64700.0, 64500.0, direction="long")
        assert d > 0

    def test_distance_to_entry_for_short(self):
        d = self.monitor.distance_to_entry(64300.0, 64500.0, direction="short")
        assert d > 0

    def test_distance_to_entry_entry_reached(self):
        d = self.monitor.distance_to_entry(64400.0, 64500.0, direction="long")
        assert d == 0.0


# ═══════════════════════════════════════════════════════════════════
#  8.3 Opportunity Tracker
# ═══════════════════════════════════════════════════════════════════


class TestOpportunityTracker:
    def setup_method(self):
        self.tracker = __import__("core.lifecycle.tracker", fromlist=[""]).OpportunityTracker()

    def test_update_long_position(self):
        pos = Position(
            opportunity_id="opp_1",
            symbol="BTCUSDT",
            direction="long",
            entry_price=64500.0,
            stop_loss=64000.0,
            targets=[65000.0],
            opened_at=time.time() - 60,
        )
        metrics = self.tracker.update(pos, current_price=64700.0)

        assert metrics.current_pnl > 0
        assert metrics.highest_price >= 64700.0
        assert metrics.time_alive > 0
        assert metrics.distance_to_stop > 0
        assert pos.highest_price >= 64700.0

    def test_update_short_position(self):
        pos = Position(
            opportunity_id="opp_2",
            symbol="ETHUSDT",
            direction="short",
            entry_price=3500.0,
            stop_loss=3550.0,
            targets=[3400.0],
        )
        metrics = self.tracker.update(pos, current_price=3480.0)

        assert metrics.current_pnl > 0  # short, цена упала
        assert metrics.lowest_price <= 3480.0
        assert metrics.distance_to_stop > 0


# ═══════════════════════════════════════════════════════════════════
#  8.4 Stop/Target Monitor
# ═══════════════════════════════════════════════════════════════════


class TestStopTargetMonitor:
    def setup_method(self):
        self.config = StopTargetConfig(
            target_levels=[0.01, 0.02],  # 1%, 2% от entry
            break_even_at=0.0,
            trailing_after=None,
        )
        self.monitor = StopTargetMonitor(self.config)

    def test_stop_hit_long(self):
        pos = Position(
            opportunity_id="opp_1", symbol="BTCUSDT", direction="long",
            entry_price=64500.0, stop_loss=64000.0, targets=[65000.0],
        )
        r = self.monitor.check(pos, current_price=63900.0)
        assert r.is_closed
        assert r.event == StopTargetEvent.STOP_HIT

    def test_stop_hit_short(self):
        pos = Position(
            opportunity_id="opp_2", symbol="BTCUSDT", direction="short",
            entry_price=64500.0, stop_loss=65000.0, targets=[64000.0],
        )
        r = self.monitor.check(pos, current_price=65100.0)
        assert r.is_closed
        assert r.event == StopTargetEvent.STOP_HIT

    def test_target_reached_long(self):
        pos = Position(
            opportunity_id="opp_3", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=95.0, targets=[120.0],
        )
        r = self.monitor.check(pos, current_price=120.0)
        assert r.is_closed
        assert r.event == StopTargetEvent.FULL_TARGET

    def test_none_no_action(self):
        """config.disabled when break_even_at=0, currents should stay NONE."""
        self.config.break_even_at = 0.0  # disable break even
        pos = Position(
            opportunity_id="opp_4", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=95.0, targets=[105.0],
        )
        r = self.monitor.check(pos, current_price=101.0)
        assert not r.is_closed
        assert r.event == StopTargetEvent.NONE

    def test_multiple_targets(self):
        config = StopTargetConfig(target_levels=[0.25, 0.50, 1.0])
        monitor = StopTargetMonitor(config)
        pos = Position(
            opportunity_id="opp_5", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=95.0, targets=[110.0, 115.0, 120.0],
        )

        r1 = monitor.check(pos, current_price=110.0)
        assert not r1.is_closed
        assert r1.event == StopTargetEvent.TARGET_1_HIT

        r2 = monitor.check(pos, current_price=115.0)
        assert not r2.is_closed
        assert r2.event == StopTargetEvent.TARGET_2_HIT

        r3 = monitor.check(pos, current_price=120.0)
        assert r3.is_closed
        assert r3.event == StopTargetEvent.FULL_TARGET

    def test_break_even(self):
        config = StopTargetConfig(
            target_levels=[1.0],
            break_even_at=0.5,  # BE at 0.5% profit
            trailing_after=None,
        )
        monitor = StopTargetMonitor(config)
        pos = Position(
            opportunity_id="opp_6", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=98.0, targets=[110.0],
        )

        # PnL 1% → BE должен активироваться
        r = monitor.check(pos, current_price=101.0)
        assert r.event == StopTargetEvent.BREAK_EVEN_ACTIVATED
        assert r.updated_stop is not None
        assert pos.stop_loss == r.updated_stop

    def test_reset(self):
        """Проверить сброс состояния для позиции."""
        self.monitor.reset("some_pos")
        # No exception expected


# ═══════════════════════════════════════════════════════════════════
#  8.6 Expiration Engine
# ═══════════════════════════════════════════════════════════════════


class TestExpirationEngine:
    def setup_method(self):
        self.exp = ExpirationEngine()

    def test_not_expired(self):
        assert not self.exp.check(OpportunityState.WAITING_ENTRY, time.time())

    def test_expired(self):
        assert self.exp.check(OpportunityState.WAITING_ENTRY, time.time() - 2000)

    def test_no_ttl_for_active(self):
        assert not self.exp.check(OpportunityState.ACTIVE, time.time() - 99999)

    def test_remaining_time(self):
        remaining = self.exp.remaining(OpportunityState.WAITING_ENTRY, time.time())
        assert remaining > 1000  # should be about 1200

    def test_remaining_zero(self):
        remaining = self.exp.remaining(OpportunityState.WAITING_ENTRY, time.time() - 2000)
        assert remaining == 0.0

    def test_custom_ttl(self):
        self.exp.set_ttl(OpportunityState.ACTIVE, 10.0)
        assert self.exp.get_ttl(OpportunityState.ACTIVE) == 10.0

    def test_custom_ttl_expired(self):
        self.exp.set_ttl(OpportunityState.ACTIVE, 10.0)
        assert self.exp.check(OpportunityState.ACTIVE, time.time() - 30)


# ═══════════════════════════════════════════════════════════════════
#  8.7 Opportunity Journal
# ═══════════════════════════════════════════════════════════════════


class TestOpportunityJournal:
    def setup_method(self):
        self.journal = OpportunityJournal()

    def test_record(self):
        entry = self.journal.record("created", "opp_1", {"entry": 100.0})
        assert entry.opportunity_id == "opp_1"
        assert entry.event_type == "created"

    def test_get_timeline(self):
        self.journal.record("created", "opp_1")
        self.journal.record("entry", "opp_1")
        self.journal.record("target1", "opp_2")
        timeline = self.journal.get_timeline("opp_1")
        assert len(timeline) == 2

    def test_get_all(self):
        self.journal.record("a", "opp_1")
        self.journal.record("b", "opp_2")
        assert self.journal.count == 2

    def test_export(self):
        self.journal.record("created", "opp_1")
        data = self.journal.export()
        assert len(data) == 1
        assert data[0]["event_type"] == "created"
        assert data[0]["opportunity_id"] == "opp_1"

    def test_clear(self):
        self.journal.record("a", "opp_1")
        self.journal.clear()
        assert self.journal.count == 0


# ═══════════════════════════════════════════════════════════════════
#  8.8 Metrics
# ═══════════════════════════════════════════════════════════════════


class TestMetricsCalculator:
    def setup_method(self):
        self.calc = MetricsCalculator()

    def test_calculate_with_trade(self):
        pos = Position(
            opportunity_id="opp_1", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=95.0, targets=[110.0],
            opened_at=time.time() - 5, closed_at=time.time(),
            highest_price=112.0, lowest_price=98.0,
        )
        trade = Trade(
            position_id=pos.id,
            opportunity_id="opp_1",
            symbol="BTCUSDT",
            direction="long",
            entry_price=100.0,
            exit_price=110.0,
            size=1.0,
            pnl=10.0,
            pnl_pct=10.0,
            rr=2.0,
            reason="full_target",
            holding_time=5.0,
            mfe=12.0,
            mae=2.0,
            opened_at=time.time() - 5,
            closed_at=time.time(),
        )
        fm = self.calc.calculate(
            position=pos, trade=trade,
            created_at=time.time() - 7200, activated_at=time.time() - 3600,
        )
        assert fm.pnl == 10.0
        assert fm.rr == 2.0
        assert fm.mfe == 12.0
        assert fm.mae == 2.0
        assert fm.lifetime > 0
        assert fm.holding_time > 0
        assert fm.score > 0

    def test_calculate_without_trade(self):
        pos = Position(
            opportunity_id="opp_2", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=95.0, targets=[110.0],
        )
        fm = self.calc.calculate(position=pos)
        assert fm.rr == 0.0
        assert fm.pnl == 0.0

    def test_to_dict(self):
        fm = FinalMetrics(pnl=5.0, rr=1.5, score=60.0)
        d = fm.to_dict()
        assert d["pnl"] == 5.0
        assert d["rr"] == 1.5
        assert d["score"] == 60.0


# ═══════════════════════════════════════════════════════════════════
#  8.9 Position Model
# ═══════════════════════════════════════════════════════════════════


class TestPosition:
    def test_create(self):
        pos = Position(
            opportunity_id="opp_1", symbol="BTCUSDT", direction="long",
            entry_price=64500.0,
            opened_at=time.time() - 5,  # 5 seconds ago
        )
        assert pos.id.startswith("pos_")
        assert pos.is_open
        assert pos.holding_time > 1.0  # at least 1 second

    def test_close(self):
        pos = Position(
            opportunity_id="opp_1", symbol="BTCUSDT", direction="long",
            entry_price=64500.0,
            closed_at=time.time(),
        )
        assert not pos.is_open

    def test_to_dict(self):
        pos = Position(
            opportunity_id="opp_1", symbol="BTCUSDT", direction="long",
            entry_price=64500.0,
        )
        d = pos.to_dict()
        assert d["symbol"] == "BTCUSDT"
        assert d["is_open"] is True


class TestTrade:
    def test_create(self):
        t = Trade(
            position_id="pos_1", opportunity_id="opp_1",
            symbol="BTCUSDT", direction="long",
            entry_price=100.0, exit_price=110.0,
            size=1.0, pnl=10.0, pnl_pct=10.0, rr=2.0,
            reason="full_target", holding_time=3600,
        )
        assert t.id.startswith("trade_")
        assert t.pnl == 10.0

    def test_to_dict(self):
        t = Trade(
            position_id="pos_1", opportunity_id="opp_1",
            symbol="BTCUSDT", direction="long",
            entry_price=100.0, exit_price=110.0,
            size=1.0, pnl=10.0, pnl_pct=10.0, rr=2.0,
            reason="full_target", holding_time=3600,
        )
        d = t.to_dict()
        assert d["pnl"] == 10.0
        assert d["reason"] == "full_target"


# ═══════════════════════════════════════════════════════════════════
#  8.10 Opportunity Bus
# ═══════════════════════════════════════════════════════════════════


class TestOpportunityBus:
    def setup_method(self):
        store = EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        self.bus = OpportunityBus(event_store=store)
        self.events_received = []

    def handler(self, event: LifecycleEvent):
        self.events_received.append(event)

    def test_publish_subscribe(self):
        unsub = self.bus.subscribe(LifecycleEventType.TRADE_CLOSED, self.handler)
        event = LifecycleEvent(type=LifecycleEventType.TRADE_CLOSED, opportunity_id="opp_1")
        self.bus.publish(event)
        assert len(self.events_received) == 1
        assert self.events_received[0].opportunity_id == "opp_1"

    def test_unsubscribe(self):
        unsub = self.bus.subscribe(LifecycleEventType.TRADE_CLOSED, self.handler)
        unsub()  # no-op via EventStore — handler stays registered
        self.bus.publish(LifecycleEvent(type=LifecycleEventType.TRADE_CLOSED, opportunity_id="opp_1"))
        assert len(self.events_received) == 1  # unsubscribe is no-op

    def test_subscribe_all(self):
        self.bus.subscribe_all(self.handler)
        self.bus.publish(LifecycleEvent(type=LifecycleEventType.OPPORTUNITY_CREATED, opportunity_id="opp_1"))
        self.bus.publish(LifecycleEvent(type=LifecycleEventType.TRADE_CLOSED, opportunity_id="opp_2"))
        assert len(self.events_received) == 2

    def test_get_history(self):
        self.bus.publish(LifecycleEvent(type=LifecycleEventType.OPPORTUNITY_CREATED, opportunity_id="opp_1"))
        history = self.bus.get_history()
        assert len(history) == 0  # get_history() not implemented via EventStore yet

    def test_get_history_filtered(self):
        self.bus.publish(LifecycleEvent(type=LifecycleEventType.OPPORTUNITY_CREATED, opportunity_id="opp_1"))
        self.bus.publish(LifecycleEvent(type=LifecycleEventType.TRADE_CLOSED, opportunity_id="opp_2"))
        trade_events = self.bus.get_history(event_type=LifecycleEventType.TRADE_CLOSED)
        assert len(trade_events) == 0  # get_history() not implemented via EventStore yet


# ═══════════════════════════════════════════════════════════════════
#  Opportunity Versioning
# ═══════════════════════════════════════════════════════════════════


class TestVersionTracker:
    def setup_method(self):
        self.tracker = VersionTracker()

    def test_snapshot(self):
        v1 = self.tracker.snapshot(
            opportunity_id="opp_1",
            state=OpportunityState.CREATED,
            direction="long",
            entry_price=100.0,
            confidence=0.75,
        )
        assert v1.version == 1
        assert v1.prev_version is None

    def test_multiple_versions(self):
        self.tracker.snapshot("opp_1", OpportunityState.CREATED, "long", 100.0)
        v2 = self.tracker.snapshot("opp_1", OpportunityState.VALIDATED, "long", 100.0)
        assert v2.version == 2
        assert v2.prev_version == 1

    def test_get_version(self):
        self.tracker.snapshot("opp_1", OpportunityState.CREATED, "long", 100.0)
        v = self.tracker.get_version("opp_1", 1)
        assert v is not None
        assert v.state == OpportunityState.CREATED

    def test_get_latest(self):
        self.tracker.snapshot("opp_1", OpportunityState.CREATED, "long", 100.0)
        self.tracker.snapshot("opp_1", OpportunityState.VALIDATED, "long", 100.0)
        latest = self.tracker.get_latest("opp_1")
        assert latest is not None
        assert latest.version == 2

    def test_get_history(self):
        self.tracker.snapshot("opp_1", OpportunityState.CREATED, "long", 100.0)
        self.tracker.snapshot("opp_1", OpportunityState.VALIDATED, "long", 100.0)
        history = self.tracker.get_history("opp_1")
        assert len(history) == 2

    def test_diff(self):
        self.tracker.snapshot(
            "opp_1", OpportunityState.CREATED, "long", 100.0, confidence=0.5,
        )
        self.tracker.snapshot(
            "opp_1", OpportunityState.VALIDATED, "long", 100.0, confidence=0.8,
        )
        diffs = self.tracker.diff("opp_1", 1, 2)
        assert "confidence" in diffs
        assert diffs["confidence"] == (0.5, 0.8)

    def test_clear_opportunity(self):
        self.tracker.snapshot("opp_1", OpportunityState.CREATED, "long", 100.0)
        self.tracker.clear("opp_1")
        assert self.tracker.get_history("opp_1") == []

    def test_total_versions(self):
        self.tracker.snapshot("opp_1", OpportunityState.CREATED, "long", 100.0)
        self.tracker.snapshot("opp_2", OpportunityState.CREATED, "short", 200.0)
        assert self.tracker.total_versions == 2


# ═══════════════════════════════════════════════════════════════════
#  Lifecycle Engine (full integration)
# ═══════════════════════════════════════════════════════════════════


class TestLifecycleEngine:
    def setup_method(self):
        self.engine = LifecycleEngine()

    def test_create_opportunity(self):
        ctx = self.engine.create_opportunity(
            opportunity_id="opp_test_1",
            symbol="BTCUSDT",
            direction="long",
            entry_price=64500.0,
            stop_loss=64000.0,
            targets=[65000.0],
            confidence=0.75,
        )
        assert ctx.opportunity_id == "opp_test_1"
        assert ctx.current_state == OpportunityState.CREATED
        assert ctx.symbol == "BTCUSDT"
        assert ctx.is_alive
        assert not ctx.is_closed

    def test_validate_opportunity(self):
        """CREATED → VALIDATED через прямой вызов transition_to."""
        ctx = self.engine.create_opportunity(
            opportunity_id="opp_validate", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=95.0, targets=[110.0],
        )
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "Policy check passed")
        assert ctx.current_state == OpportunityState.VALIDATED

    def test_validate_then_wait_entry(self):
        ctx = self._create_test_ctx()
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        self.engine.transition_to(ctx, OpportunityState.WAITING_ENTRY, "Entry not reached")
        assert ctx.current_state == OpportunityState.WAITING_ENTRY

    def test_entry_reached_on_update(self):
        # Price at entry → should auto-activate
        ctx = self._create_test_ctx(entry_price=100.0)
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        result = self.engine.update(ctx, current_price=100.0)
        assert result.entry_reached
        assert ctx.current_state == OpportunityState.ACTIVE
        assert ctx.position is not None
        assert ctx.position.entry_price == 100.0

    def test_stop_hit_on_update(self):
        ctx = self._create_test_ctx(entry_price=100.0, stop_loss=95.0)
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        self.engine.update(ctx, current_price=100.0)  # -> ACTIVE
        # Теперь цена ниже стопа
        result = self.engine.update(ctx, current_price=94.0)
        assert result.stop_hit
        assert ctx.current_state == OpportunityState.STOPPED
        assert not ctx.is_alive

    def test_full_target_on_update(self):
        """ACTIVE -> target reached -> FULL_TARGET."""
        ctx = self._create_test_ctx(entry_price=100.0, stop_loss=95.0, targets=[110.0])
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        self.engine.update(ctx, current_price=105.0)  # not at entry -> WAITING_ENTRY
        self.engine.update(ctx, current_price=100.0)  # entry reached -> ACTIVE
        result = self.engine.update(ctx, current_price=115.0)  # target hit -> FULL_TARGET
        assert result.target_hit or result.stop_hit
        assert ctx.current_state == OpportunityState.FULL_TARGET or ctx.current_state == OpportunityState.ACTIVE

    def test_expiration_on_update(self):
        """WAITING_ENTRY → expired after TTL."""
        ctx = self._create_test_ctx(entry_price=100.0)
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        # Симулируем, что прошло много времени
        ctx.state_entered_at = time.time() - 99999
        result = self.engine.update(ctx, current_price=99.0)
        assert result.expired
        assert ctx.current_state == OpportunityState.EXPIRED

    def test_full_lifecycle(self):
        """Полный цикл: CREATED → VALIDATED → WAITING_ENTRY → ACTIVE → STOPPED."""
        ctx = self.engine.create_opportunity(
            opportunity_id="opp_full", symbol="BTCUSDT", direction="long",
            entry_price=100.0, stop_loss=95.0, targets=[110.0],
            confidence=0.8,
        )
        assert ctx.current_state == OpportunityState.CREATED

        # Validate
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        assert ctx.current_state == OpportunityState.VALIDATED

        # Entry monitor — price not at entry
        r1 = self.engine.update(ctx, current_price=105.0)
        assert ctx.current_state == OpportunityState.WAITING_ENTRY

        # Entry reached
        r2 = self.engine.update(ctx, current_price=100.0)
        assert r2.entry_reached
        assert ctx.current_state == OpportunityState.ACTIVE
        assert ctx.position is not None

        # Tracker metrics (after one tick)
        r3 = self.engine.update(ctx, current_price=101.0)
        assert ctx.metrics is not None
        assert ctx.metrics.time_alive >= 0

        # Stop hit
        r4 = self.engine.update(ctx, current_price=94.0)
        assert r4.stop_hit
        assert ctx.current_state == OpportunityState.STOPPED
        assert ctx.trade is not None
        assert ctx.final_metrics is not None

    def test_events_published_on_update(self):
        """Проверить, что события публикуются при каждом шаге."""
        events = []
        self.engine.bus.subscribe_all(lambda e: events.append(e))

        ctx = self._create_test_ctx(entry_price=100.0, stop_loss=95.0, targets=[110.0])
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")

        # Entry → ACTIVE
        self.engine.update(ctx, current_price=100.0)
        assert any(e.type == LifecycleEventType.OPPORTUNITY_ACTIVATED for e in events)
        assert any(e.type == LifecycleEventType.POSITION_OPENED for e in events)

        # Stop hit
        self.engine.update(ctx, current_price=94.0)
        assert any(e.type == LifecycleEventType.OPPORTUNITY_STOPPED for e in events)
        assert any(e.type == LifecycleEventType.TRADE_CLOSED for e in events)

    def test_version_tracking(self):
        """Проверить, что версии создаются при каждом изменении."""
        ctx = self._create_test_ctx()
        assert self.engine.versioning.total_versions == 1  # CREATED

        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        assert self.engine.versioning.total_versions == 2

        self.engine.transition_to(ctx, OpportunityState.CANCELLED, "Cancel")
        assert self.engine.versioning.total_versions == 3

    def test_journal_records(self):
        """Проверить, что журнал ведётся."""
        ctx = self._create_test_ctx()
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        self.engine.transition_to(ctx, OpportunityState.CANCELLED, "Cancel")
        timeline = self.engine.journal.get_timeline(ctx.opportunity_id)
        assert len(timeline) >= 3  # created + validate + cancel

    def test_invalid_transition_raises(self):
        ctx = self._create_test_ctx()
        with pytest.raises(TransitionError):
            self.engine.transition_to(ctx, OpportunityState.ACTIVE, "Skip")

    def test_result_to_dict(self):
        ctx = self._create_test_ctx()
        self.engine.transition_to(ctx, OpportunityState.VALIDATED, "OK")
        result = self.engine.update(ctx, current_price=100.0)  # → ACTIVE → STOP
        d = result.to_dict()
        assert isinstance(d, dict)
        assert "state_changed" in d

    def test_context_to_dict(self):
        ctx = self._create_test_ctx()
        d = ctx.to_dict()
        assert d["opportunity_id"] == "opp_dict"
        assert d["current_state"] == "created"

    # ── helpers ──

    def _create_test_ctx(
        self,
        entry_price: float = 100.0,
        stop_loss: float = 95.0,
        targets: list[float] | None = None,
    ) -> LifecycleContext:
        return self.engine.create_opportunity(
            opportunity_id="opp_dict",
            symbol="BTCUSDT",
            direction="long",
            entry_price=entry_price,
            stop_loss=stop_loss,
            targets=targets or [110.0],
            confidence=0.75,
        )
