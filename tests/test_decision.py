"""Tests for Decision Engine (Phase 7) — core/decision/engine.py + models.py.

Covers:
  - DecisionEngine.process() pipeline
  - DecisionResult
"""

from __future__ import annotations

from core.decision.engine import DecisionEngine, DecisionResult
from core.decision.models import NormalizedSignal, Opportunity, SignalDirection


class TestDecisionEngine:
    """Tests for the DecisionEngine pipeline."""

    def setup_method(self):
        self.engine = DecisionEngine()

    def test_accept_single_signal(self):
        raw = {"Momentum": {"direction": "long", "score": 65, "confidence": 0.72}}
        result = self.engine.process(raw, current_price=64500.0, symbol="BTCUSDT")
        assert result.accepted
        assert result.opportunity is not None
        assert result.opportunity.direction == SignalDirection.LONG
        assert result.opportunity.symbol == "BTCUSDT"
        assert "Momentum" in result.opportunity.strategies

    def test_reject_empty(self):
        result = self.engine.process({}, current_price=100.0)
        assert not result.accepted
        assert "No signals" in result.reason

    def test_consensus_conflict(self):
        raw = {
            "A": {"direction": "long", "confidence": 0.5},
            "B": {"direction": "short", "confidence": 0.5},
        }
        result = self.engine.process(raw, current_price=100.0)
        assert not result.accepted
        assert result.consensus is not None
        assert result.consensus.is_conflict

    def test_policy_strict_rejects_single(self):
        raw = {"Momentum": {"direction": "long", "confidence": 0.85}}
        result = self.engine.process(raw, current_price=100.0, policy="strict")
        assert not result.accepted

    def test_policy_aggressive_accepts_low(self):
        raw = {"Momentum": {"direction": "long", "confidence": 0.4}}
        result = self.engine.process(raw, current_price=100.0, policy="aggressive")
        assert result.accepted

    def test_policy_moderate_default(self):
        raw = {"Momentum": {"direction": "long", "confidence": 0.6}}
        result = self.engine.process(raw, current_price=100.0)
        assert result.accepted
        assert result.opportunity is not None

    def test_result_bool(self):
        raw = {"Momentum": {"direction": "long", "confidence": 0.72}}
        result = self.engine.process(raw, current_price=100.0)
        assert bool(result) is True

    def test_result_bool_rejected(self):
        result = DecisionResult(accepted=False)
        assert bool(result) is False

    def test_process_signal_single(self):
        sig = self.engine.process_signal("Momentum", {"direction": "long", "confidence": 0.8})
        assert isinstance(sig, NormalizedSignal)
        assert sig.strategy == "Momentum"
        assert sig.direction == SignalDirection.LONG

    def test_report_outcome_updates_weight(self):
        self.engine.report_outcome("Momentum", won=True)
        w = self.engine.weight_engine.get_weight("Momentum")
        assert w > 1.0
