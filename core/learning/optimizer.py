"""
Learning Engine — ML Optimizer (Phase 13.6).

ML-оптимизация параметров стратегий.
"""

from __future__ import annotations

import logging
import random
from typing import Any, Callable

from core.learning.dataset import DatasetBuilder
from core.learning.models import FeatureSet, ModelMetadata, ModelStatus, TaskType

logger = logging.getLogger(__name__)

ParamSpace = dict[str, tuple[float, float]]  # name -> (min, max)
ParamSet = dict[str, float]


class ParamOptimizer:
    """Оптимизатор параметров стратегий.

    Использует простой генетический алгоритм / случайный поиск
    для подбора оптимальных параметров стратегии.
    """

    def __init__(self) -> None:
        self._best_params: ParamSet = {}
        self._best_score: float = float("-inf")

    def random_search(
        self,
        param_space: ParamSpace,
        eval_fn: Callable[[ParamSet], float],
        iterations: int = 100,
        seed: int = 42,
    ) -> tuple[ParamSet, float]:
        """Случайный поиск оптимальных параметров.

        Args:
            param_space: Пространство параметров {name: (min, max)}.
            eval_fn: Функция оценки (чем выше, тем лучше).
            iterations: Количество итераций.
            seed: Seed для воспроизводимости.

        Returns:
            (лучшие_параметры, лучший_счёт).
        """
        rng = random.Random(seed)
        best_score = float("-inf")
        best_params: ParamSet = {}

        for i in range(iterations):
            params: ParamSet = {}
            for name, (min_v, max_v) in param_space.items():
                params[name] = rng.uniform(min_v, max_v)

            try:
                score = eval_fn(params)
            except Exception as e:
                logger.debug("Iteration %d failed: %s", i, e)
                continue

            if score > best_score:
                best_score = score
                best_params = params.copy()

        self._best_params = best_params
        self._best_score = best_score
        return best_params, best_score

    def grid_search(
        self,
        param_space: ParamSpace,
        eval_fn: Callable[[ParamSet], float],
        steps: int = 10,
    ) -> tuple[ParamSet, float]:
        """Поиск по сетке (только для 1-2 параметров)."""
        if len(param_space) > 2:
            logger.warning("Grid search with >2 params may be slow (%d)", len(param_space))

        import itertools

        names = list(param_space.keys())
        ranges = []
        for name in names:
            min_v, max_v = param_space[name]
            step = (max_v - min_v) / steps
            ranges.append([min_v + step * i for i in range(steps + 1)])

        best_score = float("-inf")
        best_params: ParamSet = {}

        for combo in itertools.product(*ranges):
            params = dict(zip(names, combo))
            try:
                score = eval_fn(params)
            except Exception:
                continue
            if score > best_score:
                best_score = score
                best_params = params

        self._best_params = best_params
        self._best_score = best_score
        return best_params, best_score

    @property
    def best_params(self) -> ParamSet:
        return dict(self._best_params)

    @property
    def best_score(self) -> float:
        return self._best_score
