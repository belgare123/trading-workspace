"""
Learning Engine — Model Registry (Phase 13.7).

Реестр обученных ML-моделей.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from core.learning.models import ModelMetadata, ModelStatus, TaskType

logger = logging.getLogger(__name__)


class ModelRegistry:
    """Реестр ML-моделей: сохранение, загрузка, управление версиями."""

    def __init__(self, storage_dir: str = "") -> None:
        self._storage_dir = storage_dir
        self._models: dict[str, ModelMetadata] = {}
        self._active_models: dict[str, str] = {}  # task -> model_name

    def register(self, metadata: ModelMetadata) -> None:
        """Зарегистрировать модель."""
        self._models[metadata.name] = metadata
        logger.info("Model '%s' registered (v%s)", metadata.name, metadata.version)

    def get(self, name: str) -> ModelMetadata | None:
        return self._models.get(name)

    def set_active(self, task_name: str, model_name: str) -> None:
        """Установить активную модель для задачи."""
        if model_name not in self._models:
            raise ValueError(f"Model '{model_name}' not registered")
        self._active_models[task_name] = model_name

    def get_active(self, task_name: str) -> ModelMetadata | None:
        name = self._active_models.get(task_name)
        if name is None:
            return None
        return self._models.get(name)

    def list(self, status: ModelStatus | None = None) -> list[ModelMetadata]:
        if status is None:
            return list(self._models.values())
        return [m for m in self._models.values() if m.status == status]

    def save(self, name: str, path: str | None = None) -> None:
        """Сохранить метаданные модели."""
        metadata = self._models.get(name)
        if metadata is None:
            raise KeyError(f"Model '{name}' not found")
        save_path = path or self._storage_dir
        if not save_path:
            save_path = "."
        os.makedirs(save_path, exist_ok=True)
        filepath = os.path.join(save_path, f"{name}_metadata.json")
        with open(filepath, "w") as f:
            json.dump(metadata.to_dict(), f, indent=2)
        logger.info("Model '%s' metadata saved to %s", name, filepath)

    def load(self, path: str) -> ModelMetadata | None:
        """Загрузить метаданные модели."""
        try:
            with open(path) as f:
                data = json.load(f)
            metadata = ModelMetadata(
                name=data["name"],
                task=TaskType(data["task"]),
                version=data.get("version", "1.0.0"),
                status=ModelStatus(data.get("status", "ready")),
                features_used=data.get("features_used", []),
                score=data.get("score", 0.0),
                train_count=data.get("train_count", 0),
            )
            self._models[metadata.name] = metadata
            return metadata
        except Exception as e:
            logger.error("Failed to load model from %s: %s", path, e)
            return None

    @property
    def count(self) -> int:
        return len(self._models)
