"""
Learning Engine -- Orchestrator (Phase 13.11).

Central coordinator for the Learning Engine.
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics import MarketProfile
from core.learning.bus import LearningBus
from core.learning.classifier import RegimeClassifier
from core.learning.dataset import DatasetBuilder
from core.learning.detector import AnomalyDetector
from core.learning.features import FeatureExtractor
from core.learning.models import (
    Anomaly,
    FeatureSet,
    LearningEvent,
    ModelMetadata,
    ModelStatus,
)
from core.learning.optimizer import ParamOptimizer, ParamSpace
from core.learning.predictor import PerformancePredictor
from core.learning.registry import ModelRegistry
from core.learning.trainer import Trainer
from core.quality import RatingPassport

logger = logging.getLogger(__name__)


class LearningEngine:
    """Orchestrate ML training pipeline.

    Pipeline:
      Raw Data -> FeatureExtractor -> DatasetBuilder
        -> Trainer (RegimeClassifier / PerformancePredictor)
          -> ModelRegistry
            -> Predictions & Anomaly Detection
    """

    def __init__(self, event_store: EventStore) -> None:
        self._extractor = FeatureExtractor()
        self._dataset = DatasetBuilder(self._extractor)
        self._trainer = Trainer()
        self._classifier = self._trainer.classifier
        self._predictor = self._trainer.predictor
        self._detector = AnomalyDetector()
        self._optimizer = ParamOptimizer()
        self._bus = LearningBus(event_store=event_store)
        self._anomalies: list[Anomaly] = []

    def extract_features(
        self,
        candles: list[dict] | None = None,
        profile: MarketProfile | None = None,
        passport: RatingPassport | None = None,
    ) -> FeatureSet:
        """Extract features from available sources."""
        sets = []
        if candles:
            sets.append(FeatureExtractor.from_candles(candles))
        if profile:
            sets.append(FeatureExtractor.from_market_profile(profile))
        if passport:
            sets.append(FeatureExtractor.from_passport(passport))
        return FeatureExtractor.merge(*sets) if sets else FeatureSet()

    def add_example(
        self,
        features: FeatureSet,
        label: float,
        weight: float = 1.0,
    ) -> None:
        """Add a training example to the dataset."""
        self._dataset.add(features, label, weight)
        self._bus.emit(LearningEvent(
            event_type="learning.dataset_updated",
            message=f"Dataset: {self._dataset.count} examples",
        ))

    def train_classifier(self) -> ModelMetadata:
        """Train the regime classifier."""
        return self._trainer.train_classifier(self._dataset)

    def train_predictor(self) -> ModelMetadata:
        """Train the performance predictor."""
        return self._trainer.train_predictor(self._dataset)

    def predict_regime(self, features: FeatureSet) -> tuple[str, float]:
        """Predict market regime via ML."""
        return self._classifier.predict(features)

    def predict_performance(self, features: FeatureSet) -> dict[str, float]:
        """Predict strategy metrics."""
        result = self._predictor.predict(features)
        self._bus.emit_prediction(result, "perf_predictor")
        return result

    def detect_anomalies(
        self,
        price: float | None = None,
        volume: float | None = None,
        atr_ratio: float | None = None,
        volume_ratio: float | None = None,
        symbol: str = "",
    ) -> list[Anomaly]:
        """Run anomaly detection across all channels."""
        anomalies: list[Anomaly] = []
        if price is not None:
            a = self._detector.detect_price(price, symbol)
            if a:
                anomalies.append(a)
        if volume is not None:
            a = self._detector.detect_volume(volume, symbol)
            if a:
                anomalies.append(a)
        if atr_ratio is not None:
            a = self._detector.detect_volatility_shift(atr_ratio, symbol)
            if a:
                anomalies.append(a)
        if volume_ratio is not None:
            a = self._detector.detect_liquidity_drop(volume_ratio, symbol)
            if a:
                anomalies.append(a)
        for a in anomalies:
            self._anomalies.append(a)
            self._bus.emit_anomaly(a, "anomaly_detector")
        return anomalies

    def optimize_params(
        self,
        param_space: ParamSpace,
        eval_fn: Any,
        method: str = "random",
        **kwargs: Any,
    ) -> tuple[dict[str, float], float]:
        """Optimize strategy parameters."""
        if method == "grid":
            result = self._optimizer.grid_search(param_space, eval_fn, **kwargs)
        else:
            result = self._optimizer.random_search(param_space, eval_fn, **kwargs)
        self._bus.emit(LearningEvent(
            event_type="learning.params_optimized",
            message=f"Best score: {result[1]:.4f}",
        ))
        return result

    @property
    def bus(self) -> LearningBus:
        return self._bus

    @property
    def dataset(self) -> DatasetBuilder:
        return self._dataset

    @property
    def registry(self) -> ModelRegistry:
        return self._trainer.registry

    @property
    def classifier(self) -> RegimeClassifier:
        return self._classifier

    @property
    def predictor(self) -> PerformancePredictor:
        return self._predictor

    @property
    def detector(self) -> AnomalyDetector:
        return self._detector

    @property
    def recent_anomalies(self, limit: int = 10) -> list[Anomaly]:
        return self._anomalies[-limit:]
