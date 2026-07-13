"""
Learning Engine — Dataset Builder (Phase 13.2).

Формирование датасетов для обучения ML-моделей.
"""

from __future__ import annotations

import logging
import random
from typing import Any

from core.learning.features import FeatureExtractor
from core.learning.models import FeatureSet, TrainingExample

logger = logging.getLogger(__name__)


class DatasetBuilder:
    """Сборка датасетов для обучения."""

    def __init__(self, feature_extractor: FeatureExtractor | None = None) -> None:
        self._extractor = feature_extractor or FeatureExtractor()
        self._examples: list[TrainingExample] = []

    def add(
        self,
        features: FeatureSet,
        label: float,
        weight: float = 1.0,
    ) -> None:
        """Добавить один пример."""
        self._examples.append(TrainingExample(
            features=features, label=label, weight=weight,
        ))

    def clear(self) -> None:
        self._examples.clear()

    def split(
        self,
        ratio: float = 0.8,
        seed: int = 42,
    ) -> tuple[list[TrainingExample], list[TrainingExample]]:
        """Разделить на train/test."""
        rng = random.Random(seed)
        shuffled = list(self._examples)
        rng.shuffle(shuffled)
        split_idx = int(len(shuffled) * ratio)
        return shuffled[:split_idx], shuffled[split_idx:]

    def to_arrays(self, examples: list[TrainingExample] | None = None) -> tuple[list[list[float]], list[float]]:
        """Преобразовать примеры в X, y форматы."""
        data = examples or self._examples
        X = [[f.value for f in ex.features.features] for ex in data]
        y = [ex.label for ex in data]
        return X, y

    @property
    def count(self) -> int:
        return len(self._examples)

    def sample(self, n: int = 5) -> list[TrainingExample]:
        return random.sample(self._examples, min(n, len(self._examples)))
