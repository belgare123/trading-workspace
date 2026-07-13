"""
Phase 13 -- Learning Engine Tests.
"""

import time

import pytest

from core.analytics import MarketProfile, RegimeType
from core.learning import LearningEngine
from core.learning.classifier import RegimeClassifier
from core.learning.dataset import DatasetBuilder
from core.learning.detector import AnomalyDetector, AnomalyType
from core.learning.features import FeatureExtractor
from core.learning.models import (
    Anomaly,
    Feature,
    FeatureSet,
    ModelMetadata,
    ModelStatus,
    TaskType,
    TrainingExample,
)
from core.learning.optimizer import ParamOptimizer
from core.learning.predictor import PerformancePredictor
from core.learning.registry import ModelRegistry
from core.quality import RatingPassport, RatingLevel, ConfidenceGrade


# ── FeatureExtractor ────────────────────────────────────────────────

class TestFeatureExtractor:
    def test_from_candles(self):
        candles = [
            {"open": 100, "high": 105, "low": 99, "close": 102, "volume": 1000},
            {"open": 102, "high": 108, "low": 101, "close": 107, "volume": 1200},
            {"open": 107, "high": 110, "low": 105, "close": 109, "volume": 900},
        ]
        fs = FeatureExtractor.from_candles(candles)
        assert len(fs) > 0
        assert fs.get("return_mean") != 0
        assert fs.get("vol_mean") > 0

    def test_from_candles_empty(self):
        fs = FeatureExtractor.from_candles([])
        assert len(fs) == 0

    def test_from_market_profile(self):
        from core.analytics.models import LiquidityProfile, MarketProfile, MarketRegime, RegimeType, VolatilityProfile
        profile = MarketProfile(
            symbol="BTCUSDT",
            regime=MarketRegime(regime=RegimeType.TRENDING_BULL, confidence=0.8, strength=0.6),
            volatility=VolatilityProfile(current_atr=100, atr_ratio=1.5, bb_width=0.02),
            liquidity=LiquidityProfile(volume_ratio=1.2, imbalance=0.1),
            buyer_strength=0.6,
            seller_strength=0.4,
        )
        fs = FeatureExtractor.from_market_profile(profile)
        assert len(fs) > 0
        assert fs.get("market_regime") != 0

    def test_merge(self):
        a = FeatureSet()
        a.add("x", 1.0)
        b = FeatureSet()
        b.add("y", 2.0)
        merged = FeatureExtractor.merge(a, b)
        assert len(merged) == 2
        assert merged.get("x") == 1.0
        assert merged.get("y") == 2.0


# ── DatasetBuilder ─────────────────────────────────────────────────

class TestDatasetBuilder:
    def test_add_and_count(self):
        db = DatasetBuilder()
        fs = FeatureSet()
        fs.add("a", 1.0)
        db.add(fs, 0.5)
        assert db.count == 1

    def test_split(self):
        db = DatasetBuilder()
        for i in range(20):
            fs = FeatureSet()
            fs.add("x", float(i))
            db.add(fs, float(i % 2))
        train, test = db.split(0.8, seed=42)
        assert len(train) + len(test) == 20
        assert 0 < len(test) < 20

    def test_to_arrays(self):
        db = DatasetBuilder()
        for i in range(3):
            fs = FeatureSet()
            fs.add("x", float(i))
            db.add(fs, float(i * 2))
        X, y = db.to_arrays()
        assert len(X) == 3
        assert len(y) == 3
        assert y[0] == 0.0


# ── RegimeClassifier ────────────────────────────────────────────────

class TestRegimeClassifier:
    def test_train_and_predict(self):
        clf = RegimeClassifier()
        db = DatasetBuilder()
        for i in range(20):
            fs = FeatureSet()
            fs.add("trend", float(i) / 10)
            fs.add("volatility", 0.1 + (i % 3) * 0.1)
            db.add(fs, label=0.5 if i < 10 else 0.8)
        meta = clf.train(db)
        assert meta.status.value == "ready"
        assert meta.train_count == 20

    def test_predict_unknown(self):
        clf = RegimeClassifier()
        fs = FeatureSet()
        fs.add("trend", 0.5)
        regime, conf = clf.predict(fs)
        assert regime == "unknown"
        assert conf == 0.0

    def test_predict_after_train(self):
        clf = RegimeClassifier()
        db = DatasetBuilder()
        for i in range(10):
            fs = FeatureSet()
            fs.add("trend", float(i) / 10)
            fs.add("vol", 0.1)
            db.add(fs, 0.5)
        clf.train(db)
        fs = FeatureSet()
        fs.add("trend", 0.5)
        fs.add("vol", 0.1)
        regime, conf = clf.predict(fs)
        assert isinstance(regime, str)
        assert 0 <= conf <= 1


# ── PerformancePredictor ───────────────────────────────────────────

class TestPerformancePredictor:
    def test_train_and_predict(self):
        pp = PerformancePredictor()
        db = DatasetBuilder()
        for i in range(20):
            fs = FeatureSet()
            fs.add("trend", float(i) / 20)
            fs.add("vol", 0.1 + (i % 5) * 0.02)
            db.add(fs, label=0.5 + float(i) / 40)
        pp.train(db)
        fs = FeatureSet()
        fs.add("trend", 0.5)
        fs.add("vol", 0.15)
        result = pp.predict(fs)
        assert "expected_return" in result
        assert "confidence" in result
        assert "risk" in result

    def test_predict_before_train(self):
        pp = PerformancePredictor()
        fs = FeatureSet()
        fs.add("x", 1.0)
        result = pp.predict(fs)
        assert result["expected_return"] == 0.0
        assert result["confidence"] == 0.0


# ── AnomalyDetector ────────────────────────────────────────────────

class TestAnomalyDetector:
    def test_detect_price_insufficient(self):
        ad = AnomalyDetector()
        result = ad.detect_price(100.0)
        assert result is None  # need 20 samples

    def test_detect_price_anomaly(self):
        ad = AnomalyDetector()
        for _ in range(20):
            ad.detect_price(100.0)
        result = ad.detect_price(200.0)
        assert result is not None
        assert result.anomaly_type == AnomalyType.PRICE_JUMP

    def test_detect_volume_spike(self):
        ad = AnomalyDetector()
        for _ in range(10):
            ad.detect_volume(1000)
        result = ad.detect_volume(10000)
        assert result is not None
        assert result.anomaly_type == AnomalyType.VOLUME_SPIKE

    def test_detect_liquidity_drop(self):
        ad = AnomalyDetector()
        result = ad.detect_liquidity_drop(0.1)
        assert result is not None
        assert result.anomaly_type == AnomalyType.LIQUIDITY_DROP

    def test_no_false_positive(self):
        ad = AnomalyDetector(z_threshold=3.0)
        for i in range(20):
            ad.detect_price(100.0 + (i % 10) * 1.0)  # range 100..109
        result = ad.detect_price(100.5)
        assert result is None

    def test_clear(self):
        ad = AnomalyDetector()
        for _ in range(20):
            ad.detect_price(100.0)
        ad.clear()
        result = ad.detect_price(100.0)
        assert result is None


# ── ParamOptimizer ─────────────────────────────────────────────────

class TestParamOptimizer:
    def test_random_search(self):
        opt = ParamOptimizer()
        space = {"threshold": (0.1, 0.9), "period": (5, 20)}
        best_params, best_score = opt.random_search(
            space,
            lambda p: p["threshold"] * 2 + p["period"] * 0.1,
            iterations=50,
        )
        assert "threshold" in best_params
        assert "period" in best_params
        assert best_score > 0

    def test_grid_search(self):
        opt = ParamOptimizer()
        space = {"threshold": (0.1, 0.5)}
        best_params, best_score = opt.grid_search(space, lambda p: p["threshold"], steps=4)
        assert best_params["threshold"] == 0.5
        assert best_score == 0.5

    def test_best_params_property(self):
        opt = ParamOptimizer()
        space = {"x": (0, 10)}
        opt.random_search(space, lambda p: p["x"], iterations=10)
        assert "x" in opt.best_params


# ── ModelRegistry ──────────────────────────────────────────────────

class TestModelRegistry:
    def test_register_and_get(self):
        reg = ModelRegistry()
        meta = ModelMetadata(name="test", task=TaskType.CLASSIFICATION, status=ModelStatus.READY)
        reg.register(meta)
        assert reg.get("test") is meta

    def test_set_active(self):
        reg = ModelRegistry()
        meta = ModelMetadata(name="m1", task=TaskType.CLASSIFICATION, status=ModelStatus.READY)
        reg.register(meta)
        reg.set_active("classification", "m1")
        assert reg.get_active("classification") is meta

    def test_list_by_status(self):
        reg = ModelRegistry()
        reg.register(ModelMetadata(name="m1", task=TaskType.CLASSIFICATION, status=ModelStatus.READY))
        reg.register(ModelMetadata(name="m2", task=TaskType.REGRESSION, status=ModelStatus.TRAINING))
        ready = reg.list(ModelStatus.READY)
        assert len(ready) == 1
        assert ready[0].name == "m1"


# ── LearningEngine ─────────────────────────────────────────────────

class TestLearningEngine:
    def test_extract_features(self):
        engine = LearningEngine()
        fs = engine.extract_features(candles=[
            {"open": 100, "high": 105, "low": 99, "close": 102, "volume": 1000},
            {"open": 102, "high": 108, "low": 101, "close": 107, "volume": 1200},
        ])
        assert len(fs) > 0
        assert fs.get("return_mean") != 0

    def test_add_example(self):
        engine = LearningEngine()
        fs = FeatureSet()
        fs.add("x", 1.0)
        engine.add_example(fs, 0.5)
        assert engine.dataset.count == 1

    def test_detect_anomalies(self):
        engine = LearningEngine()
        for _ in range(20):
            engine.detect_anomalies(price=100.0)
        anomalies = engine.detect_anomalies(price=200.0)
        assert len(anomalies) > 0

    def test_optimize_params(self):
        engine = LearningEngine()
        space = {"threshold": (0.1, 0.9)}
        best_params, best_score = engine.optimize_params(
            space, lambda p: p["threshold"], method="random", iterations=20,
        )
        assert "threshold" in best_params
        assert best_score > 0

    def test_train_classifier(self):
        engine = LearningEngine()
        for i in range(10):
            fs = FeatureSet()
            fs.add("trend", float(i) / 10)
            fs.add("vol", 0.1)
            engine.add_example(fs, 0.5)
        meta = engine.train_classifier()
        assert meta.status.value == "ready"

    def test_predict_regime(self):
        engine = LearningEngine()
        for i in range(10):
            fs = FeatureSet()
            fs.add("trend", float(i) / 10)
            fs.add("vol", 0.1)
            engine.add_example(fs, 0.5)
        engine.train_classifier()
        fs = FeatureSet()
        fs.add("trend", 0.5)
        fs.add("vol", 0.1)
        regime, conf = engine.predict_regime(fs)
        assert isinstance(regime, str)
        assert 0 <= conf <= 1

    def test_detect_anomalies(self):
        engine = LearningEngine()
        for _ in range(20):
            engine.detect_anomalies(price=100.0)
        anomalies = engine.detect_anomalies(price=200.0)
        assert len(anomalies) > 0

    def test_optimize_params(self):
        engine = LearningEngine()
        space = {"threshold": (0.1, 0.9)}
        best_params, best_score = engine.optimize_params(
            space, lambda p: p["threshold"], iterations=20,
        )
        assert "threshold" in best_params
        assert best_score > 0

    def test_recent_anomalies(self):
        engine = LearningEngine()
        for _ in range(20):
            engine.detect_anomalies(price=100.0)
        engine.detect_anomalies(price=200.0)
        assert len(engine.recent_anomalies) > 0
