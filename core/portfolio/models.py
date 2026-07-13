"""
Portfolio Engine — Data Models (Phase 12).

Стратегические слоты, конфигурация портфеля, состояния.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from core.analytics import RegimeType
from core.quality import RatingLevel


class StrategyRole(str, Enum):
    """Роль стратегии в портфеле."""
    CORE = "core"               # Базовая, всегда включена
    OPPORTUNISTIC = "opp"       # Включается при определённом режиме
    HEDGE = "hedge"             # Хеджирование рисков
    SATELLITE = "satellite"     # Временная, для конкретной ситуации


class PortfolioAction(str, Enum):
    """Действие портфеля."""
    ENABLE = "enable"
    DISABLE = "disable"
    WEIGHT_UP = "weight_up"
    WEIGHT_DOWN = "weight_down"
    REPLACE = "replace"
    NO_CHANGE = "no_change"


class RiskLevel(str, Enum):
    """Уровень риска портфеля."""
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"
    CUSTOM = "custom"


@dataclass
class StrategySlot:
    """Слот стратегии в портфеле.

    Хранит метаданные и текущее состояние стратегии.
    """
    name: str                          # Уникальное имя стратегии
    role: StrategyRole = StrategyRole.OPPORTUNISTIC
    base_weight: float = 1.0           # Базовый вес (0..1)
    current_weight: float = 1.0        # Текущий вес (после коррекции)

    # Режимы, в которых стратегия работает
    allowed_regimes: list[RegimeType] = field(default_factory=list)
    excluded_regimes: list[RegimeType] = field(default_factory=list)

    # Минимальные требования
    min_rating: RatingLevel = RatingLevel.C
    min_confidence: float = 0.3        # Минимальная уверенность анализа

    # Состояние
    enabled: bool = True
    is_active: bool = False            # Был ли сигнал за последнюю свечу

    # Метаданные
    max_position_size: float = 0.0     # 0 = не ограничен
    max_concurrent: int = 3            # Макс одновременных позиций
    cooldown_bars: int = 0             # Пауза после закрытия сделки

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "role": self.role.value,
            "base_weight": self.base_weight,
            "current_weight": self.current_weight,
            "allowed_regimes": [r.value for r in self.allowed_regimes],
            "excluded_regimes": [r.value for r in self.excluded_regimes],
            "min_rating": self.min_rating.value,
            "min_confidence": self.min_confidence,
            "enabled": self.enabled,
            "is_active": self.is_active,
            "max_position_size": self.max_position_size,
            "max_concurrent": self.max_concurrent,
        }


@dataclass
class PortfolioAllocation:
    """Распределение портфеля на текущий момент."""
    slot_name: str
    weight: float                      # 0..1
    action: PortfolioAction = PortfolioAction.NO_CHANGE
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "slot_name": self.slot_name,
            "weight": self.weight,
            "action": self.action.value,
            "reason": self.reason,
        }


@dataclass
class PortfolioState:
    """Текущее состояние портфеля."""
    slots: dict[str, StrategySlot] = field(default_factory=dict)
    allocations: list[PortfolioAllocation] = field(default_factory=list)
    total_weight: float = 1.0
    is_diversified: bool = True

    @property
    def active_slots(self) -> list[StrategySlot]:
        return [s for s in self.slots.values() if s.enabled]

    @property
    def slot_names(self) -> list[str]:
        return list(self.slots.keys())

    def to_dict(self) -> dict[str, Any]:
        return {
            "slots": {n: s.to_dict() for n, s in self.slots.items()},
            "allocations": [
                {"slot": a.slot_name, "weight": a.weight, "action": a.action.value}
                for a in self.allocations
            ],
            "total_weight": self.total_weight,
            "active_count": len(self.active_slots),
        }


@dataclass
class PortfolioConfig:
    """Конфигурация портфеля."""
    name: str = "default"
    risk_level: RiskLevel = RiskLevel.MODERATE
    max_active_strategies: int = 8
    min_strategies: int = 2
    max_weight_per_strategy: float = 0.5     # 50% макс на одну
    min_weight_per_strategy: float = 0.01    # 1% мин
    rebalance_threshold: float = 0.15        # Порог для ребаланса
    regime_stability_bars: int = 5           # Свечей стабильности режима

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "risk_level": self.risk_level.value,
            "max_active_strategies": self.max_active_strategies,
            "min_strategies": self.min_strategies,
            "max_weight_per_strategy": self.max_weight_per_strategy,
        }


@dataclass
class PortfolioEvent:
    """Событие портфеля."""
    event_type: str
    slot_name: str = ""
    regime: RegimeType | None = None
    allocation: PortfolioAllocation | None = None
    message: str = ""
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "slot_name": self.slot_name,
            "regime": self.regime.value if self.regime else None,
            "allocation": self.allocation.to_dict() if self.allocation else None,
            "message": self.message,
            "timestamp": self.timestamp,
        }
