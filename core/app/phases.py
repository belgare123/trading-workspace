"""
Phase — фазы инициализации приложения.

Phase определяет порядок инициализации компонентов.
Перенесён из core/di/container.py в core/app/ как часть App Lifecycle.
"""

from __future__ import annotations

from enum import Enum, auto


class Phase(Enum):
    """Фазы инициализации приложения (порядок важен)."""
    INFRASTRUCTURE = auto()
    STORAGE = auto()
    FEATURES = auto()
    BATCH_UPDATER = auto()
    STATE = auto()
    CONTEXT = auto()
    DECISION = auto()
    STRATEGY = auto()
    SERVICES = auto()
    TELEGRAM = auto()
    WARMUP = auto()
    RUN = auto()

    def __lt__(self, other):
        if not isinstance(other, Phase):
            return NotImplemented
        order = list(Phase)
        return order.index(self) < order.index(other)

    @classmethod
    def order(cls) -> list[Phase]:
        """Полный порядок фаз."""
        return list(cls)

    def next(self) -> Phase | None:
        """Следующая фаза или None, если текущая — последняя."""
        order = list(Phase)
        idx = order.index(self)
        if idx + 1 < len(order):
            return order[idx + 1]
        return None

    def prev(self) -> Phase | None:
        """Предыдущая фаза или None, если текущая — первая."""
        order = list(Phase)
        idx = order.index(self)
        if idx > 0:
            return order[idx - 1]
        return None
