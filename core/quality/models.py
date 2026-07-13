"""
Quality Engine — Data Models (Phase 10).

Rating passport for strategies:
  - 12 metrics (WinRate, PF, Sharpe, Sortino, etc.)
  - Rating scale ★★★★★
  - Confidence: A/B/C/D
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class MetricName(Enum):
    """12 метрик качества стратегии."""
    WIN_RATE = "win_rate"
    PROFIT_FACTOR = "profit_factor"
    EXPECTANCY = "expectancy"
    SHARPE = "sharpe"
    SORTINO = "sortino"
    MAX_DRAWDOWN = "max_drawdown"
    RECOVERY_FACTOR = "recovery_factor"
    AVG_R_RATIO = "avg_r_ratio"
    AVG_HOLD = "avg_hold"
    SIGNAL_PRECISION = "signal_precision"
    FALSE_POSITIVE_RATE = "false_positive_rate"
    CONFIDENCE = "confidence"


class RatingLevel(Enum):
    """Рейтинговые уровни."""
    S = "S"      # ★★★★★ Elite
    A = "A"      # ★★★★☆ Strong
    B = "B"      # ★★★☆☆ Good
    C = "C"      # ★★☆☆☆ Average
    D = "D"      # ★☆☆☆☆ Poor
    F = "F"      # Untested / insufficient data

    @property
    def stars(self) -> str:
        mapping = {
            RatingLevel.S: "★★★★★",
            RatingLevel.A: "★★★★☆",
            RatingLevel.B: "★★★☆☆",
            RatingLevel.C: "★★☆☆☆",
            RatingLevel.D: "★☆☆☆☆",
            RatingLevel.F: "☆☆☆☆☆",
        }
        return mapping[self]

    @property
    def numeric(self) -> float:
        mapping = {
            RatingLevel.S: 5.0,
            RatingLevel.A: 4.0,
            RatingLevel.B: 3.0,
            RatingLevel.C: 2.0,
            RatingLevel.D: 1.0,
            RatingLevel.F: 0.0,
        }
        return mapping[self]

    @classmethod
    def from_score(cls, score: float) -> RatingLevel:
        if score >= 4.5:
            return cls.S
        elif score >= 3.5:
            return cls.A
        elif score >= 2.5:
            return cls.B
        elif score >= 1.5:
            return cls.C
        elif score >= 0.5:
            return cls.D
        return cls.F


class ConfidenceGrade(Enum):
    """Уровень доверия к стратегии на основе данных."""
    A = "A"  # >100 сделок, >3 месяцев
    B = "B"  # 50-100 сделок, >1 месяца
    C = "C"  # 10-49 сделок
    D = "D"  # <10 сделок


@dataclass
class MetricValue:
    """Значение одной метрики."""
    name: MetricName
    value: float
    weight: float = 1.0
    grade: str = ""
    label: str = ""

    def __post_init__(self) -> None:
        if not self.label:
            self.label = self.name.value.replace("_", " ").title()

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name.value,
            "value": round(self.value, 4),
            "weight": self.weight,
            "grade": self.grade,
            "label": self.label,
        }


@dataclass
class RatingPassport:
    """Паспорт стратегии — полная картина качества.

    Momentum
    ★★★★☆
    Winrate      58%
    PF           1.72
    Max DD       8%
    Avg RR       2.4
    Trades       1842
    Confidence   A
    """
    strategy_name: str
    strategy_type: str = ""
    rating: RatingLevel = RatingLevel.F
    overall_score: float = 0.0
    metrics: dict[MetricName, MetricValue] = field(default_factory=dict)
    confidence: ConfidenceGrade = ConfidenceGrade.D
    total_trades: int = 0
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    @property
    def stars(self) -> str:
        return self.rating.stars

    def get(self, metric: MetricName) -> float:
        return self.metrics.get(metric, MetricValue(name=metric, value=0.0)).value

    def summary_lines(self) -> list[str]:
        lines = [f"{self.strategy_name}  {self.stars}"]
        for m in MetricName:
            if m in self.metrics:
                mv = self.metrics[m]
                lines.append(f"  {mv.label:20s}  {mv.value:.2f}")
        lines.append(f"  {'Confidence':20s}  {self.confidence.value}")
        lines.append(f"  {'Trades':20s}  {self.total_trades}")
        return lines

    def to_dict(self) -> dict[str, Any]:
        return {
            "strategy_name": self.strategy_name,
            "strategy_type": self.strategy_type,
            "rating": self.rating.value,
            "stars": self.stars,
            "overall_score": round(self.overall_score, 2),
            "confidence": self.confidence.value,
            "total_trades": self.total_trades,
            "timestamp": self.timestamp,
            "metrics": {k.value: v.to_dict() for k, v in self.metrics.items()},
        }


@dataclass
class QualityEvent:
    """Событие качества."""
    event_type: str
    strategy_name: str
    passport: RatingPassport | None = None
    rating_before: RatingLevel | None = None
    rating_after: RatingLevel | None = None
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "strategy_name": self.strategy_name,
            "rating_before": self.rating_before.value if self.rating_before else None,
            "rating_after": self.rating_after.value if self.rating_after else None,
            "timestamp": self.timestamp,
        }
