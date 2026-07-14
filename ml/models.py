"""
ML Workbench — Data Models.

Defines the ML training lifecycle: models, training runs, experiments,
evaluation metrics, and promotion pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


# ── Enums ──────────────────────────────────────────────────────────

class ModelStatus(str, Enum):
    DRAFT = "draft"
    TRAINING = "training"
    READY = "ready"
    PRODUCTION = "production"
    FAILED = "failed"
    ARCHIVED = "archived"

    def sort_key(self) -> int:
        return {
            ModelStatus.DRAFT: 0,
            ModelStatus.TRAINING: 1,
            ModelStatus.READY: 2,
            ModelStatus.PRODUCTION: 3,
            ModelStatus.FAILED: 4,
            ModelStatus.ARCHIVED: 5,
        }[self]


class ExperimentStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ── Metrics ────────────────────────────────────────────────────────

@dataclass
class ClassificationMetrics:
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    roc_auc: float = 0.0

    def to_dict(self) -> dict[str, float]:
        return {
            "accuracy": self.accuracy,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "roc_auc": self.roc_auc,
        }


@dataclass
class TrainingMetrics:
    epoch: int = 0
    total_epochs: int = 100
    loss: float = 0.0
    accuracy: float = 0.0
    val_loss: float = 0.0
    val_accuracy: float = 0.0
    learning_rate: float = 0.001

    def to_dict(self) -> dict[str, float | int]:
        return {
            "epoch": self.epoch,
            "total_epochs": self.total_epochs,
            "loss": self.loss,
            "accuracy": self.accuracy,
            "val_loss": self.val_loss,
            "val_accuracy": self.val_accuracy,
            "learning_rate": self.learning_rate,
        }


# ── Domain Models ──────────────────────────────────────────────────

@dataclass
class Hyperparams:
    learning_rate: float = 0.001
    batch_size: int = 32
    epochs: int = 100
    optimizer: str = "adam"
    loss_fn: str = "binary_crossentropy"
    dropout: float = 0.2
    hidden_layers: list[int] = field(default_factory=lambda: [64, 32])

    def to_dict(self) -> dict[str, Any]:
        return {
            "learning_rate": self.learning_rate,
            "batch_size": self.batch_size,
            "epochs": self.epochs,
            "optimizer": self.optimizer,
            "loss_fn": self.loss_fn,
            "dropout": self.dropout,
            "hidden_layers": self.hidden_layers,
        }


@dataclass
class DatasetInfo:
    name: str = ""
    version: str = "1.0"
    rows: int = 0
    features: list[str] = field(default_factory=list)
    target: str = ""
    description: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "rows": self.rows,
            "features": self.features,
            "target": self.target,
            "description": self.description,
        }


@dataclass
class ConfusionMatrix:
    labels: list[str] = field(default_factory=list)
    matrix: list[list[int]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "labels": self.labels,
            "matrix": self.matrix,
        }


@dataclass
class FeatureImportance:
    name: str = ""
    importance: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "importance": self.importance}


@dataclass
class Model:
    id: str = ""
    name: str = ""
    description: str = ""
    version: str = "1.0.0"
    status: ModelStatus = ModelStatus.DRAFT
    model_type: str = "classifier"
    framework: str = "pytorch"
    accuracy: float = 0.0
    last_trained: str = ""
    tags: list[str] = field(default_factory=list)
    hyperparams: Hyperparams = field(default_factory=Hyperparams)
    dataset: DatasetInfo = field(default_factory=DatasetInfo)
    metrics: ClassificationMetrics = field(default_factory=ClassificationMetrics)
    confusion_matrix: ConfusionMatrix = field(default_factory=ConfusionMatrix)
    feature_importance: list[FeatureImportance] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "status": self.status.value,
            "model_type": self.model_type,
            "framework": self.framework,
            "accuracy": self.accuracy,
            "last_trained": self.last_trained,
            "tags": self.tags,
            "hyperparams": self.hyperparams.to_dict(),
            "dataset": self.dataset.to_dict(),
            "metrics": self.metrics.to_dict(),
            "confusion_matrix": self.confusion_matrix.to_dict(),
            "feature_importance": [fi.to_dict() for fi in self.feature_importance],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class TrainingRun:
    id: str = ""
    model_id: str = ""
    model_name: str = ""
    status: str = "running"
    progress: float = 0.0
    current_epoch: int = 0
    total_epochs: int = 100
    metrics: TrainingMetrics = field(default_factory=TrainingMetrics)
    started_at: str = ""
    eta: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "model_id": self.model_id,
            "model_name": self.model_name,
            "status": self.status,
            "progress": self.progress,
            "current_epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "metrics": self.metrics.to_dict(),
            "started_at": self.started_at,
            "eta": self.eta,
        }


@dataclass
class Experiment:
    id: str = ""
    name: str = ""
    model_id: str = ""
    model_name: str = ""
    status: ExperimentStatus = ExperimentStatus.COMPLETED
    dataset_name: str = ""
    accuracy: float = 0.0
    duration_seconds: float = 0.0
    hyperparams: Hyperparams = field(default_factory=Hyperparams)
    started_at: str = ""
    completed_at: str = ""
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "model_id": self.model_id,
            "model_name": self.model_name,
            "status": self.status.value,
            "dataset_name": self.dataset_name,
            "accuracy": self.accuracy,
            "duration_seconds": self.duration_seconds,
            "hyperparams": self.hyperparams.to_dict(),
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "tags": self.tags,
        }
