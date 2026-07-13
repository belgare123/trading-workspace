"""
Learning Engine — Event Bus (Phase 13.10).
"""

from __future__ import annotations

import logging
from typing import Callable

from core.learning.events import (
    LEARNING_ANOMALY_DETECTED,
    LEARNING_DATASET_UPDATED,
    LEARNING_MODEL_TRAINED,
    LEARNING_MODEL_UPDATED,
    LEARNING_PARAMS_OPTIMIZED,
    LEARNING_PREDICTION_READY,
)
from core.learning.models import LearningEvent

logger = logging.getLogger(__name__)

BusCallback = Callable[[LearningEvent], None]


class LearningBus:
    """Шина событий Learning Engine."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[BusCallback]] = {}

    def subscribe(self, event_type: str, callback: BusCallback) -> None:
        self._subscribers.setdefault(event_type, []).append(callback)

    def unsubscribe(self, event_type: str, callback: BusCallback) -> None:
        subs = self._subscribers.get(event_type, [])
        if callback in subs:
            subs.remove(callback)

    def emit(self, event: LearningEvent) -> None:
        for cb in self._subscribers.get(event.event_type, []):
            try:
                cb(event)
            except Exception as e:
                logger.error("Bus subscriber error for %s: %s", event.event_type, e)

    def emit_model_trained(self, model_name: str, score: float, message: str = "") -> None:
        self.emit(LearningEvent(
            event_type=LEARNING_MODEL_TRAINED,
            model_name=model_name,
            message=message or f"Model {model_name} trained (score: {score})",
        ))

    def emit_anomaly(self, anomaly: Any, model_name: str = "") -> None:
        self.emit(LearningEvent(
            event_type=LEARNING_ANOMALY_DETECTED,
            model_name=model_name,
            anomaly=anomaly,
        ))

    def emit_prediction(self, predictions: dict[str, float], model_name: str = "") -> None:
        self.emit(LearningEvent(
            event_type=LEARNING_PREDICTION_READY,
            model_name=model_name,
            predictions=predictions,
        ))
