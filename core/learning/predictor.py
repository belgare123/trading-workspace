"""
Learning Engine — Performance Predictor (Phase 13.4).

ML-предсказание метрик эффективности стратегии.
"""

from __future__ import annotations

import logging
import statistics
from typing import Any

from core.learning.dataset import DatasetBuilder
from core.learning.models import FeatureSet, ModelMetadata, ModelStatus, TaskType

logger = logging.getLogger(__name__)


class PerformancePredictor:
    """Предсказатель метрик стратегии.

    Оценивает ожидаемую доходность, риск и качество сигнала.
    """

    def __init__(self) -> None:
        self._metadata: ModelMetadata | None = None
        self._baseline: float = 0.0
        self._feature_weights: dict[str, float] = {}
        self._std: float = 0.1

    def train(self, dataset: DatasetBuilder) -> ModelMetadata:
        """Обучить предиктор."""
        examples = dataset.sample(dataset.count)
        if not examples:
            return self._metadata or ModelMetadata(
                name="perf_predictor", task=TaskType.REGRESSION,
                status=ModelStatus.FAILED,
            )

        labels = [ex.label for ex in examples]
        self._baseline = statistics.mean(labels) if labels else 0
        self._std = statistics.stdev(labels) if len(labels) > 1 else 0.1

        # Feature importance (пропорционально корреляции с label)
        feature_names = [f.name for f in examples[0].features.features]
        for name in feature_names:
            values = [ex.features.get(name) for ex in examples]
            if len(values) > 1 and self._std > 0:
                # Ковариация как proxy для важности
                mean_v = statistics.mean(values)
                mean_l = self._baseline
                cov = sum((v - mean_v) * (l - mean_l) for v, l in zip(values, labels)) / len(values)
                var_v = statistics.variance(values) if len(values) > 1 else 0
                if var_v > 0:
                    self._feature_weights[name] = cov / var_v

        self._metadata = ModelMetadata(
            name="perf_predictor",
            task=TaskType.REGRESSION,
            status=ModelStatus.READY,
            train_count=len(examples),
            features_used=feature_names,
            score=round(self._std / (abs(self._baseline) + 0.001), 4),
        )
        return self._metadata

    def predict(self, features: FeatureSet) -> dict[str, float]:
        """Предсказать метрики.

        Returns:
            {"expected_return": ..., "confidence": ..., "risk": ...}
        """
        if not self._metadata or self._metadata.status != ModelStatus.READY:
            return {"expected_return": 0.0, "confidence": 0.0, "risk": 0.5}

        # Линейная комбинация weighted features + baseline
        pred = self._baseline
        for f in features.features:
            weight = self._feature_weights.get(f.name, 0)
            pred += weight * (f.value - self._baseline)

        confidence = 1.0 / (1.0 + self._std * 10)
        risk = min(1.0, max(0.0, abs(pred) / (abs(self._baseline) + 1e-8)))

        return {
            "expected_return": round(pred, 6),
            "confidence": round(confidence, 4),
            "risk": round(risk, 4),
        }

    @property
    def metadata(self) -> ModelMetadata | None:
        return self._metadata
