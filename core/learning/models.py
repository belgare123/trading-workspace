"""
Learning Engine — Data Models (Phase 13).

Модели данных для ML/обучения.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class FeatureType(str, Enum):
    """Типы признаков для ML."""
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    BOOLEAN = "boolean"
    VECTOR = "vector"


class ModelStatus(str, Enum):
    """Статус модели в реестре."""
    TRAINING = "training"
    READY = "ready"
    FAILED = "failed"
    STALE = "stale"
    DEPRECATED = "deprecated"


class TaskType(str, Enum):
    """Тип ML-задачи."""
    REGRESSION = "regression"
    CLASSIFICATION = "classification"
    CLUSTERING = "clustering"
    ANOMALY_DETECTION = "anomaly_detection"


class AnomalyType(str, Enum):
    """Типы обнаруживаемых аномалий."""
    VOLUME_SPIKE = "volume_spike"
    PRICE_JUMP = "price_jump"
    VOLATILITY_SHIFT = "volatility_shift"
    LIQUIDITY_DROP = "liquidity_drop"
    PATTERN_BREAK = "pattern_break"
    CORRELATION_REVERSAL = "correlation_reversal"


@dataclass
class Feature:
    """Признак для ML-модели."""
    name: str
    value: float
    feature_type: FeatureType = FeatureType.NUMERIC

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "value": self.value, "type": self.feature_type.value}


@dataclass
class FeatureSet:
    """Набор признаков для одного наблюдения."""
    features: list[Feature] = field(default_factory=list)
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def get(self, name: str) -> float:
        for f in self.features:
            if f.name == name:
                return f.value
        return 0.0

    def to_dict(self) -> dict[str, Any]:
        return {f.name: f.value for f in self.features}

    def add(self, name: str, value: float) -> None:
        self.features.append(Feature(name=name, value=value))

    def __len__(self) -> int:
        return len(self.features)


@dataclass
class TrainingExample:
    """Один пример для обучения."""
    features: FeatureSet
    label: float
    weight: float = 1.0
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()


@dataclass
class ModelMetadata:
    """Метаданные обученной модели."""
    name: str
    task: TaskType
    version: str = "1.0.0"
    status: ModelStatus = ModelStatus.TRAINING
    description: str = ""
    features_used: list[str] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)
    score: float = 0.0  # RMSE, accuracy, etc.
    params: dict[str, Any] = field(default_factory=dict)
    train_count: int = 0
    created_at: float = 0.0
    updated_at: float = 0.0
    path: str = ""  # Путь к файлу с весами

    def __post_init__(self) -> None:
        now = time.time()
        if self.created_at == 0.0:
            self.created_at = now
        if self.updated_at == 0.0:
            self.updated_at = now

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "task": self.task.value,
            "version": self.version,
            "status": self.status.value,
            "score": self.score,
            "train_count": self.train_count,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class Anomaly:
    """Зафиксированная аномалия."""
    anomaly_type: AnomalyType
    severity: float  # 0..1
    symbol: str = ""
    description: str = ""
    expected_value: float = 0.0
    actual_value: float = 0.0
    confidence: float = 1.0
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "anomaly_type": self.anomaly_type.value,
            "severity": self.severity,
            "symbol": self.symbol,
            "description": self.description,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
            "confidence": self.confidence,
        }


@dataclass
class LearningEvent:
    """Событие обучения."""
    event_type: str
    model_name: str = ""
    anomaly: Anomaly | None = None
    predictions: dict[str, float] | None = None
    message: str = ""
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "model_name": self.model_name,
            "anomaly": self.anomaly.to_dict() if self.anomaly else None,
            "predictions": self.predictions,
            "message": self.message,
            "timestamp": self.timestamp,
        }
