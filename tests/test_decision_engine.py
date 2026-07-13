"""Integration tests for Decision Engine (Phase 7)."""

from core.decision.confidence import MarketRegime
from core.decision.engine import DecisionEngine
from core.decision.models import DecisionEventType, SignalDirection


class TestDecisionEngine:
    def setup_method(self):
        self.engine = DecisionEngine()

    def test_simple_accept(self):
        """Один сигнал LONG → accept."""
        raw = {"Momentum": {"direction": "long", "score": 65, "confidence": 0.72}}
        result = self.engine.process(raw, current_price=64500.0, symbol="BTCUSDT")
        assert result.accepted
        assert result.opportunity is not None
        assert result.opportunity.direction == SignalDirection.LONG
        assert result.opportunity.entry_price == 64500.0
        assert result.opportunity.confidence > 0
        assert "Momentum" in result.opportunity.strategies

    def test_consensus_multiple(self):
        """Три одинаковых сигнала → accept."""
        raw = {
            "Momentum": {"direction": "long", "confidence": 0.72},
            "ICT": {"direction": "long", "confidence": 0.64},
            "Liquidity": {"direction": "long", "confidence": 0.55},
        }
        result = self.engine.process(raw, current_price=100.0)
        assert result.accepted
        assert result.opportunity is not None
        assert len(result.opportunity.strategies) == 3

    def test_conflict_no_trade(self):
        """Противоположные сигналы с близкой уверенностью → reject (conflict)."""
        raw = {
            "Momentum": {"direction": "long", "confidence": 0.55},
            "ICT": {"direction": "short", "confidence": 0.55},
        }
        result = self.engine.process(raw, current_price=100.0)
        assert not result.accepted
        assert result.consensus is not None
        assert result.consensus.is_conflict

    def test_strict_policy_rejects_single(self):
        """Strict requires 2+ strategies."""
        raw = {"Momentum": {"direction": "long", "confidence": 0.85}}
        result = self.engine.process(raw, current_price=100.0, policy="strict")
        assert not result.accepted
        assert "strategies" in result.reason.lower()

    def test_aggressive_policy_accepts_low_confidence(self):
        """Aggressive принимает moderate confidence."""
        raw = {"Momentum": {"direction": "long", "confidence": 0.4}}
        result = self.engine.process(raw, current_price=100.0, policy="aggressive")
        assert result.accepted

    def test_events_emitted(self):
        """Проверка, что события публикуются."""
        events = []

        def handler(e):
            events.append(e)

        self.engine.event_bus.on(DecisionEventType.OPPORTUNITY_CREATED, handler)

        raw = {"Momentum": {"direction": "long", "confidence": 0.72}}
        result = self.engine.process(raw, current_price=100.0)
        assert result.accepted
        assert len(events) == 1
        assert events[0].data["id"] == result.opportunity.id

    def test_rejected_event(self):
        """Rejected сигнал → OPPORTUNITY_REJECTED."""
        events = []

        def handler(e):
            events.append(e)

        self.engine.event_bus.on(DecisionEventType.OPPORTUNITY_REJECTED, handler)

        raw = {"Momentum": {"direction": "long", "confidence": 0.2}}
        result = self.engine.process(raw, current_price=100.0, policy="strict")
        assert not result.accepted
        assert len(events) == 1

    def test_empty_signals(self):
        result = self.engine.process({}, current_price=100.0)
        assert not result.accepted
        assert "No signals" in result.reason

    def test_weight_engine_integration(self):
        """После process, weight engine может обновиться."""
        self.engine.process(
            {"Momentum": {"direction": "long", "confidence": 0.72}},
            current_price=100.0,
        )
        # Отчитываемся о результате
        self.engine.report_outcome("Momentum", won=True)
        w = self.engine.weight_engine.get_weight("Momentum")
        assert w > 1.0  # win → вес повысился

    def test_policy_from_engine_default(self):
        assert self.engine._default_policy == "moderate"

    def test_signal_normalization_via_engine(self):
        sig = self.engine.process_signal("Momentum", {"direction": "long", "confidence": 0.8})
        assert sig.strategy == "Momentum"
        assert sig.direction == SignalDirection.LONG
