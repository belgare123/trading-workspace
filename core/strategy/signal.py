"""
Signal Model — единый формат результата для всех стратегий.

Стратегия возвращает Signal.
Decision Engine превращает Signal в Opportunity.

Signal
  │
  ▼
Opportunity (weighted, scored, ranked)

Ни одна стратегия не пишет свой формат сигнала.
IStrategy.analyze() возвращает Signal | list[Signal].
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


# ═══════════════════════════════════════════════════════════════════
# Direction
# ═══════════════════════════════════════════════════════════════════


class SignalDirection(str, Enum):
    """Направление сигнала.

    LONG   — ожидание роста цены.
    SHORT  — ожидание падения цены.
    NEUTRAL — нет выраженного направления (информационный сигнал).
    """

    LONG = "long"
    SHORT = "short"
    NEUTRAL = "neutral"

    @property
    def is_directional(self) -> bool:
        return self in (SignalDirection.LONG, SignalDirection.SHORT)

    @property
    def opposite(self) -> SignalDirection:
        if self == SignalDirection.LONG:
            return SignalDirection.SHORT
        if self == SignalDirection.SHORT:
            return SignalDirection.LONG
        return SignalDirection.NEUTRAL


# ═══════════════════════════════════════════════════════════════════
# PriceTarget — структура для тейк-профита
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PriceTarget:
    """Одна цель тейк-профита.

    Attributes:
        price:  Цена цели.
        size:   Доля позиции для закрытия на этой цели (0.0–1.0). По умолчанию 1.0.
        label:  Опциональная метка (e.g. "TP1", "TP2", "resistance").
    """

    price: float
    size: float = 1.0
    label: str = ""

    def __post_init__(self) -> None:
        if self.size <= 0.0 or self.size > 1.0:
            raise ValueError(
                f"PriceTarget size must be in (0, 1], got {self.size}"
            )

    def __repr__(self) -> str:
        label_str = f" ({self.label})" if self.label else ""
        return f"Target{label_str} @ {self.price:.4f} [{self.size:.0%}]"


# ═══════════════════════════════════════════════════════════════════
# RiskAssessment
# ═══════════════════════════════════════════════════════════════════


@dataclass
class RiskAssessment:
    """Оценка риска сигнала.

    Attributes:
        risk_reward_ratio:  Отношение потенциал/риск (e.g. 3.0 = 3:1).
        max_drawdown:       Ожидаемая максимальная просадка (0.0–1.0).
        volatility:         Волатильность на момент сигнала.
        stop_distance:      Расстояние до стопа в процентах от entry.
        atr_multiple:       Множитель ATR для стопа.
        score:              Риск-скор (0 = мин риск, 100 = макс риск).
    """

    risk_reward_ratio: float = 0.0
    max_drawdown: float = 0.0
    volatility: float = 0.0
    stop_distance: float = 0.0
    atr_multiple: float = 0.0
    score: float = 0.0

    @property
    def is_favorable(self) -> bool:
        """Сигнал считается благоприятным по риску."""
        return self.risk_reward_ratio >= 2.0 and self.score < 50.0


# ═══════════════════════════════════════════════════════════════════
# Signal — основной контракт
# ═══════════════════════════════════════════════════════════════════


@dataclass
class Signal:
    """Сигнал — результат работы одной стратегии.

    Attributes:
        direction:   Направление (LONG / SHORT / NEUTRAL).
        score:       Сырой балл стратегии 0–100.
        confidence:  Уверенность стратегии в сигнале 0–100.
        strategy:    Имя стратегии-источника (e.g. "Momentum").
        timestamp:   Время генерации сигнала (UTC).
        reasons:     Список причин для сигнала.
        entry:       Рекомендуемая цена входа.
        stop:        Рекомендуемая цена стоп-лосса.
        targets:     Список тейк-профитов (PriceTarget).
        risk:        Оценка риска.
        symbol:      Тикер/инструмент (e.g. "BTC/USDT").
        timeframe:   Таймфрейм (e.g. "1h", "15m").
        metadata:    Дополнительные данные (произвольные ключи).
        signal_id:   Уникальный ID сигнала.
    """

    direction: SignalDirection
    score: float
    confidence: float = 0.0
    strategy: str = "unknown"
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    reasons: list[str] = field(default_factory=list)
    entry: Optional[float] = None
    stop: Optional[float] = None
    targets: list[PriceTarget] = field(default_factory=list)
    risk: Optional[RiskAssessment] = None
    symbol: str = ""
    timeframe: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    signal_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])

    def __post_init__(self) -> None:
        if not 0 <= self.score <= 100:
            raise ValueError(f"score must be 0–100, got {self.score}")
        if not 0 <= self.confidence <= 100:
            raise ValueError(f"confidence must be 0–100, got {self.confidence}")

    @property
    def is_long(self) -> bool:
        return self.direction == SignalDirection.LONG

    @property
    def is_short(self) -> bool:
        return self.direction == SignalDirection.SHORT

    @property
    def is_actionable(self) -> bool:
        """Сигнал достаточно сильный для действия."""
        return (
            self.direction.is_directional
            and self.score >= 50
            and self.confidence >= 30
        )

    @property
    def has_targets(self) -> bool:
        return len(self.targets) > 0

    @property
    def has_stop(self) -> bool:
        return self.stop is not None

    @property
    def risk_reward(self) -> float:
        """Рассчитать соотношение риск/прибыль на основе entry/stop/targets.

        Базовый расчёт: (avg_target - entry) / (entry - stop).
        Если данных недостаточно — 0.0.
        """
        if not self.has_stop or not self.has_targets or self.entry is None:
            return 0.0
        if self.stop == self.entry:
            return 0.0
        avg_target = sum(t.price for t in self.targets) / len(self.targets)
        reward = abs(avg_target - self.entry)
        risk = abs(self.entry - self.stop)
        if risk == 0.0:
            return 0.0
        return round(reward / risk, 2)

    def to_dict(self) -> dict[str, object]:
        return {
            "signal_id": self.signal_id,
            "strategy": self.strategy,
            "direction": self.direction.value,
            "score": self.score,
            "confidence": self.confidence,
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "entry": self.entry,
            "stop": self.stop,
            "targets": [
                {"price": t.price, "size": t.size, "label": t.label}
                for t in self.targets
            ],
            "reasons": list(self.reasons),
            "timestamp": self.timestamp.isoformat(),
            "is_actionable": self.is_actionable,
            "risk_reward": self.risk_reward,
        }

    def __repr__(self) -> str:
        return (
            f"Signal({self.strategy}"
            f" | {self.direction.value.upper()}"
            f" score={self.score:.0f}"
            f" conf={self.confidence:.0f}"
            f" {self.symbol}"
            f" [{self.timeframe}]"
            f")"
        )


# ═══════════════════════════════════════════════════════════════════
# SignalBundle — набор сигналов от одной стратегии
# ═══════════════════════════════════════════════════════════════════


@dataclass
class SignalBundle:
    """Результат одного вызова analyze() — набор сигналов.

    Стратегия может вернуть несколько сигналов за раз (разные инструменты,
    разные направления, разные таймфреймы).

    Attributes:
        strategy:   Имя стратегии.
        signals:    Список сигналов.
        timestamp:  Время генерации.
        metadata:   Метаданные пакета (время выполнения, число итераций и т.д.).
    """

    strategy: str
    signals: list[Signal] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for s in self.signals:
            if s.strategy == "unknown":
                s.strategy = self.strategy

    @property
    def count(self) -> int:
        return len(self.signals)

    @property
    def actionable(self) -> list[Signal]:
        return [s for s in self.signals if s.is_actionable]

    @property
    def best(self) -> Optional[Signal]:
        """Сигнал с наибольшим score."""
        if not self.signals:
            return None
        return max(self.signals, key=lambda s: s.score)

    def by_direction(self, direction: SignalDirection) -> list[Signal]:
        return [s for s in self.signals if s.direction == direction]


# ═══════════════════════════════════════════════════════════════════
# Opportunity — результат Decision Engine
# ═══════════════════════════════════════════════════════════════════


@dataclass
class Opportunity:
    """Возможность — агрегированный сигнал от Decision Engine.

    После фазы 8 Decision Engine собирает сигналы от всех стратегий,
    взвешивает их, отсеивает противоречивые и создаёт Opportunity.

    Включает все поля Signal + агрегированные данные.
    """

    # ── Данные от Signal ──
    direction: SignalDirection
    score: float
    confidence: float
    symbol: str = ""
    timeframe: str = ""
    entry: Optional[float] = None
    stop: Optional[float] = None
    targets: list[PriceTarget] = field(default_factory=list)
    risk: Optional[RiskAssessment] = None
    reasons: list[str] = field(default_factory=list)

    # ── Агрегация ──
    source_signals: list[Signal] = field(default_factory=list)
    consensus: float = 0.0  # 0.0–1.0 — степень согласия между стратегиями
    strategy_count: int = 0
    top_strategies: list[str] = field(default_factory=list)

    # ── Мета ──
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    opportunity_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not 0 <= self.score <= 100:
            raise ValueError(f"score must be 0–100, got {self.score}")
        if not 0 <= self.confidence <= 100:
            raise ValueError(f"confidence must be 0–100, got {self.confidence}")

    @property
    def is_long(self) -> bool:
        return self.direction == SignalDirection.LONG

    @property
    def is_actionable(self) -> bool:
        return (
            self.direction.is_directional
            and self.score >= 50
            and self.consensus >= 0.5
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "opportunity_id": self.opportunity_id,
            "direction": self.direction.value,
            "score": self.score,
            "confidence": self.confidence,
            "consensus": self.consensus,
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "entry": self.entry,
            "stop": self.stop,
            "targets": [
                {"price": t.price, "size": t.size, "label": t.label}
                for t in self.targets
            ],
            "reasons": list(self.reasons),
            "strategy_count": self.strategy_count,
            "top_strategies": list(self.top_strategies),
            "timestamp": self.timestamp.isoformat(),
            "is_actionable": self.is_actionable,
        }

    def __repr__(self) -> str:
        return (
            f"Opportunity({self.direction.value.upper()}"
            f" score={self.score:.0f}"
            f" conf={self.confidence:.0f}"
            f" consensus={self.consensus:.0%}"
            f" {self.symbol}"
            f")"
        )
