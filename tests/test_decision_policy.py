"""Tests for Decision Policy (7.7)."""

import pytest

from core.decision.models import Opportunity, SignalDirection
from core.decision.policy import DecisionPolicy, PolicyName


class TestDecisionPolicy:
    def test_strict_policy(self):
        dp = DecisionPolicy("strict")
        assert dp.name == "strict"

    def test_moderate_policy(self):
        dp = DecisionPolicy("moderate")
        assert dp.name == "moderate"

    def test_aggressive_policy(self):
        dp = DecisionPolicy("aggressive")
        assert dp.name == "aggressive"

    def test_invalid_policy(self):
        with pytest.raises(ValueError):
            DecisionPolicy("invalid")

    def test_strict_high_confidence(self):
        """Strict: 2 strategies, confidence 0.85 → accepted."""
        dp = DecisionPolicy("strict")
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
            confidence=0.85,
            strategies=["Momentum", "ICT"],
        )
        result = dp.evaluate(opp)
        assert result.accepted
        assert result.policy == "strict"

    def test_strict_low_confidence(self):
        """Strict: 2 strategies but confidence 0.4 → rejected."""
        dp = DecisionPolicy("strict")
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
            confidence=0.4,
            strategies=["Momentum", "ICT"],
        )
        result = dp.evaluate(opp)
        assert not result.accepted
        assert "confidence" in result.reason.lower()

    def test_strict_single_strategy(self):
        """Strict: 1 strategy → rejected."""
        dp = DecisionPolicy("strict")
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
            confidence=0.9,
            strategies=["Momentum"],
        )
        result = dp.evaluate(opp)
        assert not result.accepted
        assert "strategies" in result.reason.lower()

    def test_moderate_single_strategy(self):
        """Moderate: 1 strategy, confidence 0.6 → accepted."""
        dp = DecisionPolicy("moderate")
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
            confidence=0.6,
            strategies=["Momentum"],
        )
        result = dp.evaluate(opp)
        assert result.accepted

    def test_aggressive_low_confidence(self):
        """Aggressive: confidence 0.4 → accepted."""
        dp = DecisionPolicy("aggressive")
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
            confidence=0.4,
            strategies=["Momentum"],
        )
        result = dp.evaluate(opp)
        assert result.accepted

    def test_aggressive_very_low_confidence(self):
        """Aggressive: confidence 0.2 → rejected."""
        dp = DecisionPolicy("aggressive")
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
            confidence=0.2,
            strategies=["Momentum"],
        )
        result = dp.evaluate(opp)
        assert not result.accepted
