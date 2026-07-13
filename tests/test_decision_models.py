"""Tests for Decision Engine Models (Phase 7)."""

from core.decision.models import (
    ConflictType,
    ConsensusResult,
    Evidence,
    NormalizedSignal,
    Opportunity,
    OpportunityStatus,
    SignalDirection,
    StrategyWeight,
)


class TestEvidence:
    def test_create(self):
        e = Evidence(label="RSI", weight=0.3, value=72, detail="Overbought")
        assert e.label == "RSI"
        assert e.weight == 0.3
        assert e.value == 72
        assert e.detail == "Overbought"

    def test_to_dict(self):
        e = Evidence(label="EMA Cross", weight=0.35, value=True)
        d = e.to_dict()
        assert d["label"] == "EMA Cross"
        assert d["weight"] == 0.35
        assert d["value"] is True

    def test_default_weight(self):
        e = Evidence(label="Test")
        assert e.weight == 1.0


class TestNormalizedSignal:
    def test_create_minimal(self):
        s = NormalizedSignal(
            strategy="Momentum",
            direction=SignalDirection.LONG,
            confidence=0.72,
        )
        assert s.strategy == "Momentum"
        assert s.direction == SignalDirection.LONG
        assert s.confidence == 0.72
        assert s.timestamp > 0

    def test_confidence_clamping(self):
        s = NormalizedSignal(strategy="T", direction=SignalDirection.LONG, confidence=1.5)
        assert s.confidence == 1.0

        s = NormalizedSignal(strategy="T", direction=SignalDirection.LONG, confidence=-0.5)
        assert s.confidence == 0.0

    def test_to_dict(self):
        s = NormalizedSignal(
            strategy="ICT",
            direction=SignalDirection.SHORT,
            confidence=0.64,
            score=84,
            evidence=[Evidence("FVG")],
        )
        d = s.to_dict()
        assert d["strategy"] == "ICT"
        assert d["direction"] == "short"
        assert d["confidence"] == 0.64
        assert d["score"] == 84
        assert len(d["evidence"]) == 1

    def test_repr(self):
        s = NormalizedSignal(strategy="M", direction=SignalDirection.LONG, confidence=0.8)
        r = repr(s)
        assert "M" in r
        assert "long" in r


class TestConsensusResult:
    def test_create(self):
        cr = ConsensusResult(
            direction=SignalDirection.LONG,
            confidence=0.72,
            agreement=0.8,
            participating=["Momentum", "ICT"],
            weight_map={"Momentum": 1.0, "ICT": 1.42},
        )
        assert cr.direction == SignalDirection.LONG
        assert cr.agreement == 0.8
        assert not cr.is_conflict

    def test_to_dict(self):
        cr = ConsensusResult(
            direction=SignalDirection.SHORT,
            is_conflict=True,
            conflict_type=ConflictType.DIRECTION,
        )
        d = cr.to_dict()
        assert d["direction"] == "short"
        assert d["is_conflict"] is True
        assert d["conflict_type"] == "direction"


class TestOpportunity:
    def test_create(self):
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=64500.0,
            stop_loss=64180.0,
            targets=[64850.0, 65200.0],
            confidence=0.84,
            strategies=["Momentum"],
        )
        assert opp.id.startswith("opp_")
        assert opp.direction == SignalDirection.LONG
        assert opp.entry_price == 64500.0
        assert opp.stop_loss == 64180.0
        assert opp.status == OpportunityStatus.PENDING
        assert opp.created_at > 0

    def test_is_active(self):
        opp = Opportunity(
            direction=SignalDirection.LONG,
            entry_price=100,
            stop_loss=99,
        )
        assert not opp.is_active

        opp.status = OpportunityStatus.ACTIVE
        assert opp.is_active

    def test_to_dict(self):
        opp = Opportunity(
            direction=SignalDirection.SHORT,
            entry_price=50000.0,
            stop_loss=50500.0,
            targets=[49500.0],
            symbol="BTCUSDT",
        )
        d = opp.to_dict()
        assert d["id"] == opp.id
        assert d["direction"] == "short"
        assert d["symbol"] == "BTCUSDT"
        assert d["status"] == "pending"


class TestStrategyWeight:
    def test_create(self):
        sw = StrategyWeight(strategy="Momentum", weight=1.42, win_rate=0.81)
        assert sw.strategy == "Momentum"
        assert sw.weight == 1.42
        assert sw.win_rate == 0.81
        assert sw.updated_at > 0

    def test_to_dict(self):
        sw = StrategyWeight(strategy="ICT", win_rate=0.64, total_signals=50)
        d = sw.to_dict()
        assert d["strategy"] == "ICT"
        assert d["win_rate"] == 0.64
        assert d["total_signals"] == 50


class TestConflictType:
    def test_values(self):
        assert ConflictType.DIRECTION.value == "direction"
        assert ConflictType.STRENGTH.value == "strength"
        assert ConflictType.TIMING.value == "timing"
        assert ConflictType.UNCERTAINTY.value == "uncertainty"
