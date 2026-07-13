"""Tests for Signal Normalizer (7.1)."""

import pytest

from core.decision.models import SignalDirection
from core.decision.normalizer import NormalizationError, SignalNormalizer


class TestSignalNormalizer:
    def setup_method(self):
        self.n = SignalNormalizer()

    def test_normalize_simple_momentum(self):
        """Momentum: {direction: 'long', score: 65, confidence: 0.72}"""
        raw = {"direction": "long", "score": 65, "confidence": 0.72}
        sig = self.n.normalize("Momentum", raw)
        assert sig.strategy == "Momentum"
        assert sig.direction == SignalDirection.LONG
        assert sig.score == 65.0
        assert sig.confidence == 0.72

    def test_normalize_ict(self):
        """ICT: {direction: 'buy', strength: 84}"""
        raw = {"direction": "buy", "strength": 84}
        sig = self.n.normalize("ICT", raw)
        assert sig.direction == SignalDirection.LONG
        assert sig.score == 84.0
        # strength=84 интерпретируется как confidence 0.84
        assert sig.confidence == 0.84

    def test_normalize_short_sell(self):
        raw = {"direction": "sell", "confidence": 0.8}
        sig = self.n.normalize("Test", raw)
        assert sig.direction == SignalDirection.SHORT
        assert sig.confidence == 0.8

    def test_normalize_with_evidence(self):
        raw = {
            "direction": "long",
            "evidence": [
                {"label": "EMA Cross", "weight": 0.35, "value": True},
                {"label": "RSI", "weight": 0.15, "value": 72},
            ],
        }
        sig = self.n.normalize("Momentum", raw)
        assert len(sig.evidence) == 2
        assert sig.evidence[0].label == "EMA Cross"
        assert sig.evidence[0].weight == 0.35
        assert sig.evidence[1].label == "RSI"

    def test_normalize_with_indicators(self):
        raw = {
            "direction": "short",
            "indicators": {"RSI": 72, "MACD": "bearish", "Volume": 15000},
        }
        sig = self.n.normalize("ICT", raw)
        assert len(sig.evidence) == 3
        labels = {e.label for e in sig.evidence}
        assert "RSI" in labels
        assert "MACD" in labels

    def test_normalize_with_reasons(self):
        raw = {
            "direction": "long",
            "reasons": ["EMA cross", "RSI oversold", "Volume spike"],
        }
        sig = self.n.normalize("Test", raw)
        assert len(sig.evidence) == 3
        assert sig.evidence[0].label == "EMA cross"

    def test_confidence_clamping(self):
        n = SignalNormalizer()
        # confidence > 1 → считаем что проценты
        sig = n.normalize("T", {"direction": "long", "confidence": 85})
        assert sig.confidence == 0.85

        sig = n.normalize("T", {"direction": "long", "confidence": -5})
        assert sig.confidence == 0.0

    def test_invalid_direction(self):
        with pytest.raises(NormalizationError):
            self.n.normalize("T", {"direction": "invalid_direction_xyz"})

    def test_with_side_field(self):
        raw = {"side": "buy", "conf": 0.9, "score": 100}
        sig = self.n.normalize("M", raw)
        assert sig.direction == SignalDirection.LONG
        assert sig.confidence == 0.9
        assert sig.score == 100.0

    def test_meta_extraction(self):
        raw = {"direction": "long", "extra_field": "value", "another": 42}
        sig = self.n.normalize("T", raw)
        assert "extra_field" in sig.meta
        assert sig.meta["extra_field"] == "value"
        assert sig.meta["another"] == 42
        assert "direction" not in sig.meta
