"""
Quality Engine — Phase 10.

Система рейтинга стратегий (Rating Passport).

Компоненты:
  10.1  Models       — MetricName, RatingLevel, ConfidenceGrade, RatingPassport
  10.2  Metrics      — 12 метрик: WinRate, PF, Expectancy, Sharpe, Sortino,
                       MaxDD, Recovery, AvgRR, AvgHold, SignalPrecision, FPR, Confidence
  10.3  Passport     — PassportGenerator (сырые сделки → паспорт)
  10.4  Rating       — RatingCalculator (метрики → ★★★★★)
  10.5  Confidence   — ConfidenceCalculator (A/B/C/D)
  10.6  Ranker       — Сравнение и сортировка стратегий
  10.7  History      — Тренды метрик во времени
  10.8  Events       — Quality Events
  10.9  Bus          — Quality Event Bus
  10.10 Engine       — Orchestrator
"""

from core.quality.bus import QualityBus
from core.quality.confidence import ConfidenceCalculator
from core.quality.engine import QualityEngine
from core.quality.events import (
    QUALITY_DECLINING,
    QUALITY_PASSPORT_READY,
    QUALITY_RATING_CHANGED,
    QUALITY_UPDATED,
)
from core.quality.history import QualityHistory
from core.quality.models import (
    ConfidenceGrade,
    MetricName,
    MetricValue,
    QualityEvent,
    RatingLevel,
    RatingPassport,
)
from core.quality.passport import PassportGenerator
from core.quality.ranker import Ranker
from core.quality.rating import RatingCalculator

__all__ = [
    # Models
    "MetricName",
    "MetricValue",
    "RatingLevel",
    "RatingPassport",
    "ConfidenceGrade",
    "QualityEvent",
    # Core
    "PassportGenerator",
    "RatingCalculator",
    "ConfidenceCalculator",
    "Ranker",
    "QualityHistory",
    "QualityBus",
    "QualityEngine",
    # Events
    "QUALITY_UPDATED",
    "QUALITY_RATING_CHANGED",
    "QUALITY_DECLINING",
    "QUALITY_PASSPORT_READY",
]
