"""Tests for Decision Events (7.8)."""

from core.decision.events import (
    DecisionEvent,
    DecisionEventType,
    EventBus,
    conflict_detected_event,
    consensus_changed_event,
    decision_taken_event,
    opportunity_created_event,
    opportunity_rejected_event,
)
from core.decision.models import (
    ConflictType,
    ConsensusResult,
    Opportunity,
    SignalDirection,
)


class TestEventBus:
    def setup_method(self):
        self.bus = EventBus()
        self.events = []

    def _handler(self, event: DecisionEvent) -> None:
        self.events.append(event)

    def test_subscribe_and_emit(self):
        self.bus.on(DecisionEventType.OPPORTUNITY_CREATED, self._handler)
        event = DecisionEvent(
            type=DecisionEventType.OPPORTUNITY_CREATED,
            data={"id": "test123"},
        )
        self.bus.emit(event)
        assert len(self.events) == 1
        assert self.events[0].data["id"] == "test123"

    def test_unsubscribe(self):
        self.bus.on(DecisionEventType.OPPORTUNITY_CREATED, self._handler)
        self.bus.off(DecisionEventType.OPPORTUNITY_CREATED, self._handler)
        self.bus.emit(DecisionEvent(type=DecisionEventType.OPPORTUNITY_CREATED))
        assert len(self.events) == 0

    def test_multiple_handlers(self):
        results = []

        def h1(e):
            results.append("h1")

        def h2(e):
            results.append("h2")

        self.bus.on(DecisionEventType.CONFLICT_DETECTED, h1)
        self.bus.on(DecisionEventType.CONFLICT_DETECTED, h2)
        self.bus.emit(DecisionEvent(type=DecisionEventType.CONFLICT_DETECTED))
        assert len(results) == 2

    def test_handler_error_isolation(self):
        """Ошибка в одном handler не ломает другие."""

        def bad(e):
            raise RuntimeError("bad handler")

        def good(e):
            self.events.append("good")

        self.bus.on(DecisionEventType.OPPORTUNITY_CREATED, bad)
        self.bus.on(DecisionEventType.OPPORTUNITY_CREATED, good)
        self.bus.emit(DecisionEvent(type=DecisionEventType.OPPORTUNITY_CREATED))
        assert "good" in self.events

    def test_clear(self):
        self.bus.on(DecisionEventType.OPPORTUNITY_CREATED, self._handler)
        self.bus.clear()
        self.bus.emit(DecisionEvent(type=DecisionEventType.OPPORTUNITY_CREATED))
        assert len(self.events) == 0


class TestDecisionEvent:
    def test_create(self):
        event = DecisionEvent(type=DecisionEventType.OPPORTUNITY_CREATED)
        assert event.type == DecisionEventType.OPPORTUNITY_CREATED
        assert event.timestamp > 0
        assert event.source == "decision_engine"

    def test_to_dict(self):
        event = DecisionEvent(
            type=DecisionEventType.CONFLICT_DETECTED,
            data={"num_signals": 2},
        )
        d = event.to_dict()
        assert d["type"] == "conflict_detected"
        assert d["data"]["num_signals"] == 2


class TestEventHelpers:
    def test_opportunity_created_event(self):
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=64500,
            stop_loss=64180,
            strategies=["Momentum"],
        )
        event = opportunity_created_event(opp)
        assert event.type == DecisionEventType.OPPORTUNITY_CREATED
        assert event.data["id"] == opp.id
        assert event.data["direction"] == "long"

    def test_opportunity_rejected_event(self):
        opp = Opportunity(
            direction=SignalDirection.SHORT,
            entry_price=50000,
            stop_loss=50500,
        )
        event = opportunity_rejected_event(opp, reason="Low confidence")
        assert event.type == DecisionEventType.OPPORTUNITY_REJECTED
        assert event.data["reason"] == "Low confidence"

    def test_conflict_detected_event(self):
        consensus = ConsensusResult(
            direction=SignalDirection.NEUTRAL,
            is_conflict=True,
            conflict_type=ConflictType.DIRECTION,
            participating=["A", "B"],
            details="Direction conflict",
        )
        event = conflict_detected_event([], consensus)
        assert event.type == DecisionEventType.CONFLICT_DETECTED
        assert event.data["conflict_type"] is not None

    def test_decision_taken_event(self):
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
            symbol="BTCUSDT",
        )
        event = decision_taken_event(opp, decision="enter_long")
        assert event.type == DecisionEventType.DECISION_TAKEN
        assert event.data["decision"] == "enter_long"
        assert event.data["symbol"] == "BTCUSDT"
