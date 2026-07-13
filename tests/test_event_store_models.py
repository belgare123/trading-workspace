"""Tests for Event Store models — sync tests only."""

from __future__ import annotations

from core.event_store.models import StoredEvent


class TestStoredEvent:
    def test_new_generates_uuid_and_timestamp(self):
        ev = StoredEvent.new(
            aggregate="decision",
            aggregate_id="decision#abc",
            topic="decision.accepted",
        )
        assert ev.event_id
        assert len(ev.event_id) == 36  # UUID
        assert ev.aggregate == "decision"
        assert ev.aggregate_id == "decision#abc"
        assert ev.topic == "decision.accepted"
        assert ev.timestamp > 0
        assert ev.correlation_id == ""
        assert ev.causation_id == ""
        assert ev.source == ""
        assert ev.payload == b""

    def test_new_with_all_fields(self):
        ev = StoredEvent.new(
            aggregate="opportunity",
            aggregate_id="opportunity#xyz",
            topic="opportunity.created",
            correlation_id="chain-001",
            causation_id="parent-uuid",
            source="DecisionEngine",
            payload=b'{"key": "value"}',
            metadata={"version": 1},
            timestamp=1000.0,
            event_id="fixed-uuid-123456789012345678901234567890123456",
            aggregate_version=5,
        )
        assert ev.event_id == "fixed-uuid-123456789012345678901234567890123456"
        assert ev.aggregate_version == 5
        assert ev.timestamp == 1000.0
        assert ev.correlation_id == "chain-001"

    def test_to_dict_roundtrip(self):
        ev = StoredEvent.new(
            aggregate="quality",
            aggregate_id="quality#m1",
            topic="quality.updated",
            payload=b'{"score": 0.85}',
            metadata={"rating": "A"},
            correlation_id="chain-002",
        )
        d = ev.to_dict()
        restored = StoredEvent.from_dict(d)
        assert restored.event_id == ev.event_id
        assert restored.aggregate == ev.aggregate
        assert restored.payload == ev.payload
        assert restored.metadata == ev.metadata
        assert restored.correlation_id == ev.correlation_id

    def test_make_helpers(self):
        assert StoredEvent.make_opportunity_id("abc") == "opportunity#abc"
        assert StoredEvent.make_market_id("BTCUSDT") == "market#BTCUSDT"
        assert StoredEvent.make_portfolio_id() == "portfolio#default"
        assert StoredEvent.make_portfolio_id("main") == "portfolio#main"
        assert StoredEvent.make_decision_id("d1") == "decision#d1"
        assert StoredEvent.make_model_id("Momentum") == "model#Momentum"
