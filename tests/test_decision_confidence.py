"""Tests for Confidence Engine (7.5)."""

from core.decision.confidence import ConfidenceEngine, MarketRegime
from core.decision.models import ConsensusResult, SignalDirection, StrategyWeight


class TestConfidenceEngine:
    def setup_method(self):
        self.engine = ConfidenceEngine()

    def test_basic_confidence(self):
        final = self.engine.compute(raw_confidence=0.72)
        assert 0.0 <= final <= 1.0
        # Без дополнительных факторов confidence ≤ исходного
        assert final <= 0.72

    def test_consensus_boost(self):
        consensus = ConsensusResult(
            direction=SignalDirection.LONG,
            participating=["Momentum", "ICT", "Liquidity"],
            agreement=0.8,
            weight_map={"Momentum": 1.0, "ICT": 1.0, "Liquidity": 1.0},
        )
        final_with = self.engine.compute(
            raw_confidence=0.7, consensus=consensus
        )
        final_without = self.engine.compute(raw_confidence=0.7)
        assert final_with >= final_without

    def test_quality_factor_boost(self):
        sw = StrategyWeight(strategy="Momentum", win_rate=0.81, weight=1.42)
        final = self.engine.compute(raw_confidence=0.7, strategy_weight=sw)
        assert final > 0.7  # win_rate > 0.6 даёт boost

    def test_quality_factor_penalty(self):
        sw = StrategyWeight(strategy="Bad", win_rate=0.3, weight=0.5)
        final = self.engine.compute(raw_confidence=0.7, strategy_weight=sw)
        assert final < 0.7  # win_rate < 0.4 даёт penalty

    def test_regime_trending(self):
        final = self.engine.compute(
            raw_confidence=0.7, regime=MarketRegime.TRENDING
        )
        assert final == 0.7  # trending = 1.0 factor

    def test_regime_volatile(self):
        final = self.engine.compute(
            raw_confidence=0.7, regime=MarketRegime.VOLATILE
        )
        assert final < 0.7  # volatile = 0.8 factor

    def test_volatility_penalty(self):
        final_low = self.engine.compute(raw_confidence=0.7, volatility=0.05)
        final_high = self.engine.compute(raw_confidence=0.7, volatility=0.6)
        assert final_high < final_low

    def test_full_pipeline(self):
        """Все факторы вместе."""
        consensus = ConsensusResult(
            direction=SignalDirection.LONG,
            participating=["A", "B", "C", "D"],
            agreement=0.85,
            weight_map={"A": 1.0, "B": 1.0, "C": 1.0, "D": 1.0},
        )
        sw = StrategyWeight(strategy="A", win_rate=0.75, weight=1.3)
        final = self.engine.compute(
            raw_confidence=0.65,
            consensus=consensus,
            strategy_weight=sw,
            regime=MarketRegime.TRENDING,
            volatility=0.12,
        )
        assert 0.0 <= final <= 1.0
        # С несколькими стратегиями + high win rate → boost
        assert final > 0.65
