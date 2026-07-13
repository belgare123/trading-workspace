"""
Learning Engine — Trainer (Phase 13.8).

Оркестрация обучения моделей.
"""

from __future__ import annotations

import logging
from typing import Any

from core.learning.classifier import RegimeClassifier
from core.learning.dataset import DatasetBuilder
from core.learning.models import ModelMetadata, ModelStatus
from core.learning.predictor import PerformancePredictor
from core.learning.registry import ModelRegistry

logger = logging.getLogger(__name__)


class Trainer:
    """Тренер ML-моделей.

    Запускает обучение моделей на датасетах,
    управляет процессом через ModelRegistry.
    """

    def __init__(
        self,
        registry: ModelRegistry | None = None,
    ) -> None:
        self._registry = registry or ModelRegistry()
        self._classifier = RegimeClassifier()
        self._predictor = PerformancePredictor()

    def train_classifier(self, dataset: DatasetBuilder) -> ModelMetadata:
        """Обучить классификатор режимов."""
        logger.info("Training regime classifier on %d examples", dataset.count)
        metadata = self._classifier.train(dataset)
        self._registry.register(metadata)
        self._registry.set_active("regime_classification", metadata.name)
        return metadata

    def train_predictor(self, dataset: DatasetBuilder) -> ModelMetadata:
        """Обучить предиктор метрик."""
        logger.info("Training performance predictor on %d examples", dataset.count)
        metadata = self._predictor.train(dataset)
        self._registry.register(metadata)
        self._registry.set_active("perf_prediction", metadata.name)
        return metadata

    @property
    def classifier(self) -> RegimeClassifier:
        return self._classifier

    @property
    def predictor(self) -> PerformancePredictor:
        return self._predictor

    @property
    def registry(self) -> ModelRegistry:
        return self._registry
