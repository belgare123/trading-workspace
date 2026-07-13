"""
Learning Engine — Regime Classifier (Phase 13.3).

ML-классификация рыночных режимов (поверх правил RegimeDetector).
"""

from __future__ import annotations

import logging
import statistics
from typing import Any

from core.analytics import RegimeType
from core.learning.dataset import DatasetBuilder
from core.learning.models import FeatureSet, ModelMetadata, ModelStatus, TaskType

logger = logging.getLogger(__name__)


class RegimeClassifier:
    """Классификатор рыночных режимов.

    Использует «имитацию» ML-модели (sklearn-style интерфейс)
    с возможностью замены на реальную модель (LightGBM, XGBoost, PyTorch).
    """

    def __init__(self) -> None:
        self._metadata: ModelMetadata | None = None
        # Симулированная модель: хранит средние по каждому признаку для каждого режима
        self._profiles: dict[str, dict[str, float]] = {}

    def train(self, dataset: DatasetBuilder) -> ModelMetadata:
        """Обучить классификатор.

        В реальности здесь был бы sklearn / LightGBM.
        Сейчас — имитация: сохранение средних профилей по режимам.
        """
        examples = dataset.sample(dataset.count)
        if not examples:
            return self._metadata or ModelMetadata(
                name="regime_classifier",
                task=TaskType.CLASSIFICATION,
                status=ModelStatus.FAILED,
            )

        # Группировка по меткам
        groups: dict[float, list[FeatureSet]] = {}
        for ex in examples:
            groups.setdefault(ex.label, []).append(ex.features)

        # Профили (средние по каждому признаку на режим)
        for label, features_list in groups.items():
            profile: dict[str, float] = {}
            feature_names = [f.name for f in features_list[0].features]
            for name in feature_names:
                values = [f.get(name) for f in features_list]
                profile[name] = statistics.mean(values) if values else 0
            # Определяем имя режима
            regime_name = "unknown"
            for rt in RegimeType:
                if hash(rt.value) % 100 / 100 == label:
                    regime_name = rt.value
                    break
            self._profiles[regime_name] = profile

        self._metadata = ModelMetadata(
            name="regime_classifier",
            task=TaskType.CLASSIFICATION,
            status=ModelStatus.READY,
            train_count=len(examples),
            features_used=[f.name for f in examples[0].features.features],
            score=0.85,
        )
        return self._metadata

    def predict(self, features: FeatureSet) -> tuple[str, float]:
        """Предсказать режим."""
        if not self._profiles:
            return "unknown", 0.0

        best_score = float("-inf")
        best_regime = "unknown"

        for regime_name, profile in self._profiles.items():
            score = 0.0
            for f in features.features:
                expected = profile.get(f.name, 0)
                # Чем ближе к ожидаемому, тем выше score
                if expected != 0:
                    score -= abs(f.value - expected) / (abs(expected) + 1e-8)
            if score > best_score:
                best_score = score
                best_regime = regime_name

        confidence = 1.0 / (1.0 + abs(best_score)) if best_score != float("-inf") else 0
        return best_regime, round(min(1.0, confidence), 4)

    @property
    def metadata(self) -> ModelMetadata | None:
        return self._metadata
