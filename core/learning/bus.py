"""Learning Engine — Event Bus (Phase 13.10). Тонкий фасад над EventStore."""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

from core.event_store import (
    AGGREGATE_LEARNING,
    EventStore,
    StoredEvent,
)
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
    """Шина событий Learning Engine — тонкий фасад над EventStore."""

    def __init__(self, event_store: EventStore) -> None:
        self._store = event_store

    def subscribe(self, event_type: str, callback: BusCallback) -> None:
        self._store.on_sync(_make_learning_wrapper(event_type, callback))
        logger.debug("Subscribed %s (via EventStore)", event_type)

    def unsubscribe(self, event_type: str, callback: BusCallback) -> None:
        logger.warning("unsubscribe() not supported via EventStore")

    def emit(self, event: LearningEvent) -> None:
        stored = self._to_stored(event)
        self._store.publish_sync(stored)

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

    def _to_stored(self, event: LearningEvent) -> StoredEvent:
        return StoredEvent.new(
            aggregate=AGGREGATE_LEARNING,
            aggregate_id=f"learning#{event.model_name or 'unknown'}",
            topic=f"learning.{event.event_type}",
            source="learning_engine",
            payload=json.dumps(event.to_dict()).encode("utf-8"),
        )


def _make_learning_wrapper(event_type: str, callback: BusCallback) -> Callable[[StoredEvent], None]:
    """Wrap StoredEvent → LearningEvent."""
    def wrapper(stored: StoredEvent) -> None:
        if stored.topic != f"learning.{event_type}":
            return
        try:
            raw = json.loads(stored.payload.decode("utf-8"))
            event = LearningEvent(
                event_type=raw.get("event_type", event_type),
                model_name=raw.get("model_name", ""),
                message=raw.get("message", ""),
                **{k: v for k, v in raw.items() if k not in ("event_type", "model_name", "message", "timestamp")},
                timestamp=raw.get("timestamp", 0.0),
            )
            callback(event)
        except Exception:
            logger.exception("LearningBus handler failed via EventStore")
    return wrapper
