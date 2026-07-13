"""
Decision Engine — Data Models (7.0)

Core data types for the Decision Engine:
  - NormalizedSignal — единый формат сигнала от любой стратегии
  - Evidence — элемент доказательства (на чём основан сигнал)
  - ConsensusResult — результат консенсуса нескольких сигналов
  - Opportunity — готовая торговая возможность
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


# ═══════════════════════════════════════════════════════════════════
#  Enums
# ═══════════════════════════════════════════════════════════════════


class SignalDirection(Enum):
    """Направление сигнала/возможности."""

    LONG = "long"
    SHORT = "short"
    NEUTRAL = "neutral"


class ConflictType(Enum):
    """Тип конфликта между стратегиями."""

    DIRECTION = "direction"           # разные направления
    STRENGTH = "strength"             # одно направление, но разная сила
    TIMING = "timing"                 # разное время входа
    UNCERTAINTY = "uncertainty"       # недостаточно данных для вывода


class OpportunityStatus(Enum):
    """Статус торговой возможности."""

    PENDING = "pending"              # создана, но не активирована
    ACTIVE = "active"                # активна, ждёт исполнения
    EXECUTED = "executed"            # исполнена (вход совершён)
    EXPIRED = "expired"              # истекла без исполнения
    REJECTED = "rejected"            # отклонена Decision Policy
    CANCELLED = "cancelled"          # отменена


class DecisionEventType(Enum):
    """Типы событий Decision Engine."""

    OPPORTUNITY_CREATED = "opportunity_created"
    OPPORTUNITY_UPDATED = "opportunity_updated"
    OPPORTUNITY_REJECTED = "opportunity_rejected"
    OPPORTUNITY_EXPIRED = "opportunity_expired"
    CONFLICT_DETECTED = "conflict_detected"
    CONSENSUS_CHANGED = "consensus_changed"
    DECISION_TAKEN = "decision_taken"


# ═══════════════════════════════════════════════════════════════════
#  Evidence
# ═══════════════════════════════════════════════════════════════════


@dataclass
class Evidence:
    """Одна единица доказательства для сигнала.

    Пример:
      Evidence(label="EMA Cross", weight=0.35, value=True,
               detail="EMA12 crossed above EMA26")
    """

    label: str
    weight: float = 1.0
    value: Any = None
    detail: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "weight": self.weight,
            "value": self.value,
            "detail": self.detail,
        }

    def __repr__(self) -> str:
        return f"Evidence({self.label}, w={self.weight:.2f})"


# ═══════════════════════════════════════════════════════════════════
#  NormalizedSignal
# ═══════════════════════════════════════════════════════════════════


@dataclass
class NormalizedSignal:
    """Нормализованный сигнал от стратегии.

    Все стратегии производят сигналы в этом формате.
    Decision Engine работает только с NormalizedSignal.

    Attributes:
        strategy:   Имя стратегии-источника.
        direction:  LONG / SHORT / NEUTRAL.
        confidence: Уверенность стратегии (0.0–1.0).
        score:      Числовая оценка силы сигнала.
        evidence:   Список доказательств (Evidence).
        timestamp:  Время создания сигнала (unix).
        meta:       Дополнительные данные.
    """

    strategy: str
    direction: SignalDirection
    confidence: float
    score: float = 0.0
    evidence: list[Evidence] = field(default_factory=list)
    timestamp: float = 0.0
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = datetime.utcnow().timestamp()
        self.confidence = max(0.0, min(1.0, self.confidence))

    def to_dict(self) -> dict[str, Any]:
        return {
            "strategy": self.strategy,
            "direction": self.direction.value,
            "confidence": self.confidence,
            "score": self.score,
            "evidence": [e.to_dict() for e in self.evidence],
            "timestamp": self.timestamp,
        }

    def __repr__(self) -> str:
        return (
            f"NormalizedSignal({self.strategy}, {self.direction.value}, "
            f"c={self.confidence:.2f})"
        )


# ═══════════════════════════════════════════════════════════════════
#  StrategyWeight
# ═══════════════════════════════════════════════════════════════════


@dataclass
class StrategyWeight:
    """Вес стратегии для взвешенного консенсуса.

    Attributes:
        strategy:   Имя стратегии.
        weight:     Вес (1.0 = нейтральный, >1 = больше влияние).
        win_rate:   Процент успешных сигналов (0.0–1.0).
        total:      Всего сигналов.
        updated_at: Когда обновлён вес.
    """

    strategy: str
    weight: float = 1.0
    win_rate: float = 0.0
    total_signals: int = 0
    updated_at: float = 0.0

    def __post_init__(self) -> None:
        if self.updated_at == 0.0:
            self.updated_at = datetime.utcnow().timestamp()

    def to_dict(self) -> dict[str, Any]:
        return {
            "strategy": self.strategy,
            "weight": self.weight,
            "win_rate": self.win_rate,
            "total_signals": self.total_signals,
        }


# ═══════════════════════════════════════════════════════════════════
#  ConsensusResult
# ═══════════════════════════════════════════════════════════════════


@dataclass
class ConsensusResult:
    """Результат консенсуса нескольких сигналов.

    Attributes:
        direction:      Итоговое направление.
        confidence:     Итоговая уверенность (0.0–1.0).
        agreement:      Доля согласных стратегий (0.0–1.0).
        participating:  Список стратегий, участвовавших в консенсусе.
        weight_map:     Стратегия → вес (для взвешенного голосования).
        is_conflict:    True если обнаружен неразрешимый конфликт.
        conflict_type:  Тип конфликта (если is_conflict).
        details:        Дополнительная информация.
    """

    direction: SignalDirection
    confidence: float = 0.0
    agreement: float = 0.0
    participating: list[str] = field(default_factory=list)
    weight_map: dict[str, float] = field(default_factory=dict)
    is_conflict: bool = False
    conflict_type: ConflictType | None = None
    details: str = ""

    @property
    def weighted_agreement(self) -> float:
        """Взвешенная доля согласных (с учётом весов стратегий)."""
        if not self.weight_map or not self.participating:
            return self.agreement

        total_weight = sum(self.weight_map.get(s, 1.0)
                          for s in self.participating)
        if total_weight == 0:
            return 0.0
        return self.agreement  # упрощённо

    def to_dict(self) -> dict[str, Any]:
        return {
            "direction": self.direction.value,
            "confidence": self.confidence,
            "agreement": self.agreement,
            "participating": self.participating,
            "weight_map": dict(self.weight_map),
            "is_conflict": self.is_conflict,
            "conflict_type": self.conflict_type.value if self.conflict_type else None,
            "details": self.details,
        }


# ═══════════════════════════════════════════════════════════════════
#  Opportunity
# ═══════════════════════════════════════════════════════════════════


@dataclass
class Opportunity:
    """Готовая торговая возможность.

    Создаётся Opportunity Builder на основе консенсуса.
    """

    direction: SignalDirection
    entry_price: float
    stop_loss: float
    targets: list[float] = field(default_factory=list)
    confidence: float = 0.0
    evidence: list[Evidence] = field(default_factory=list)
    strategies: list[str] = field(default_factory=list)
    consensus: ConsensusResult | None = None
    policy: str = "moderate"
    status: OpportunityStatus = OpportunityStatus.PENDING
    id: str = ""
    symbol: str = ""
    created_at: float = 0.0
    expires_at: float = 0.0
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"opp_{uuid.uuid4().hex[:12]}"
        if self.created_at == 0.0:
            self.created_at = datetime.utcnow().timestamp()

    @property
    def is_active(self) -> bool:
        return self.status == OpportunityStatus.ACTIVE

    @property
    def is_expired(self) -> bool:
        if self.expires_at == 0.0:
            return False
        return datetime.utcnow().timestamp() > self.expires_at

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "direction": self.direction.value,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "targets": self.targets,
            "confidence": self.confidence,
            "status": self.status.value,
            "strategies": self.strategies,
            "evidence": [e.to_dict() for e in self.evidence],
            "symbol": self.symbol,
            "created_at": self.created_at,
        }


# ── (Legacy Decision class removed — replaced by ConsensusResult) ──
