"""Tests for Consensus Engine (7.3) + Conflict Resolver (7.4)."""

import pytest

from core.decision.consensus import ConsensusEngine
from core.decision.models import ConflictType, NormalizedSignal, SignalDirection


class TestConsensusEngine:
    def setup_method(self):
        self.engine = ConsensusEngine()

    def test_simple_consensus(self):
        signals = [
            NormalizedSignal("Momentum", SignalDirection.LONG, 0.72),
            NormalizedSignal("ICT", SignalDirection.LONG, 0.64),
            NormalizedSignal("Liquidity", SignalDirection.LONG, 0.55),
        ]
        result = self.engine.compute(signals)
        assert result.direction == SignalDirection.LONG
        assert result.agreement > 0.9  # все три LONG
        assert not result.is_conflict
        assert len(result.participating) == 3

    def test_direction_conflict(self):
        signals = [
            NormalizedSignal("Momentum", SignalDirection.LONG, 0.82),
            NormalizedSignal("ICT", SignalDirection.SHORT, 0.44),
        ]
        result = self.engine.compute(signals)
        assert result.is_conflict
        assert result.conflict_type == ConflictType.DIRECTION

    def test_weighted_consensus(self):
        """ICT имеет большой вес, перевешивает Momentum."""
        signals = [
            NormalizedSignal("Momentum", SignalDirection.LONG, 0.72),
            NormalizedSignal("ICT", SignalDirection.SHORT, 0.64),
        ]
        weights = {"Momentum": 1.0, "ICT": 2.0}
        result = self.engine.compute(signals, weights=weights)
        # ICT с весом 2.0 против Momentum 1.0 → SHORT (значительный перевес)
        assert result.direction == SignalDirection.SHORT
        assert not result.is_conflict

    def test_empty_signals(self):
        with pytest.raises(Exception):
            self.engine.compute([])

    def test_neutral_signals(self):
        signals = [
            NormalizedSignal("M", SignalDirection.NEUTRAL, 0.5),
            NormalizedSignal("T", SignalDirection.NEUTRAL, 0.5),
        ]
        result = self.engine.compute(signals)
        assert result.direction == SignalDirection.NEUTRAL


class TestConflictResolver:
    def setup_method(self):
        self.engine = ConsensusEngine()

    def _make_signals(self, long_strategies, short_strategies):
        signals = []
        for s in long_strategies:
            signals.append(NormalizedSignal(s, SignalDirection.LONG, 0.8))
        for s in short_strategies:
            signals.append(NormalizedSignal(s, SignalDirection.SHORT, 0.3))
        return signals

    def test_resolve_by_confidence(self):
        """LONG с confidence 0.82 vs SHORT с 0.44 → LONG."""
        signals = [
            NormalizedSignal("Momentum", SignalDirection.LONG, 0.82),
            NormalizedSignal("ICT", SignalDirection.SHORT, 0.44),
        ]
        consensus = self.engine.compute(signals)
        assert consensus.is_conflict

        resolved = self.engine.resolve_conflict(consensus, signals)
        assert not resolved.is_conflict
        assert resolved.direction == SignalDirection.LONG

    def test_resolve_by_evidence_count(self):
        """Одинаковый confidence, но больше evidence → resolve."""
        signals = [
            NormalizedSignal("Momentum", SignalDirection.LONG, 0.6),
            NormalizedSignal("ICT", SignalDirection.SHORT, 0.45),
        ]
        # У LONG больше evidence
        signals[0].evidence = ["EMA", "RSI", "Trend"]  # type: ignore
        signals[1].evidence = ["FVG"]  # type: ignore

        consensus = self.engine.compute(signals)
        # agreement = 1.0/2.0 = 0.5 < 0.6 → conflict
        assert consensus.is_conflict

        resolved = self.engine.resolve_conflict(consensus, signals)
        assert not resolved.is_conflict

    def test_unresolvable_conflict(self):
        """Одинаковый confidence и evidence → NO TRADE."""
        signals = [
            NormalizedSignal("M", SignalDirection.LONG, 0.6),
            NormalizedSignal("T", SignalDirection.SHORT, 0.6),
        ]
        consensus = self.engine.compute(signals)
        resolved = self.engine.resolve_conflict(consensus, signals)
        assert resolved.is_conflict
        assert resolved.direction == SignalDirection.NEUTRAL
