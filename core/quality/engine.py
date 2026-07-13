"""
Quality Engine — Orchestrator (Phase 10.9).

Центральный координатор Quality Engine.
"""

from __future__ import annotations

import logging
from typing import Any

from core.quality.bus import QualityBus
from core.quality.confidence import ConfidenceCalculator
from core.quality.events import QUALITY_DECLINING, QUALITY_RATING_CHANGED
from core.quality.history import QualityHistory
from core.quality.models import (
    ConfidenceGrade,
    MetricName,
    QualityEvent,
    RatingLevel,
    RatingPassport,
)
from core.quality.passport import PassportGenerator
from core.quality.ranker import Ranker
from core.quality.rating import RatingCalculator

logger = logging.getLogger(__name__)


class QualityEngine:
    """Orchestrator Quality Engine.

    Pipeline:
      trades → PassportGenerator → RatingCalculator → ConfidenceCalculator
              → Ranker → QualityHistory → Bus
    """

    def __init__(
        self,
        bus: QualityBus | None = None,
        history: QualityHistory | None = None,
        storage_dir: str = "",
    ) -> None:
        self._bus = bus or QualityBus()
        self._history = history or QualityHistory(storage_dir=storage_dir)
        self._generator = PassportGenerator()
        self._calculator = RatingCalculator()
        self._ranker = Ranker()
        self._passports: dict[str, RatingPassport] = {}

    @property
    def bus(self) -> QualityBus:
        return self._bus

    @property
    def history(self) -> QualityHistory:
        return self._history

    def evaluate(
        self,
        strategy_name: str,
        trades: list[dict],
        strategy_type: str = "",
    ) -> RatingPassport:
        """Полный цикл оценки стратегии.

        Pipeline:
          trades → PassportGenerator → RatingCalculator → History → Bus

        Args:
            strategy_name: Имя стратегии.
            trades: Список закрытых сделок.
            strategy_type: Тип стратегии.

        Returns:
            RatingPassport с рейтингом.
        """
        # 1. Генерация паспорта
        passport = self._generator.generate(strategy_name, trades, strategy_type)

        # 2. Расчёт рейтинга
        old_passport = self._passports.get(strategy_name)
        passport = self._calculator.calculate(passport)

        # 3. Сохранение
        self._passports[strategy_name] = passport
        self._history.record(passport)

        # 4. События
        self._bus.emit_passport(strategy_name, passport)

        if old_passport and old_passport.rating != passport.rating:
            self._bus.emit_rating_change(strategy_name, old_passport, passport)

        # Проверка ухудшения
        trend = self._history.get_trend(strategy_name)
        if trend.get("change", 0) < -1.0:
            self._bus.emit(QualityEvent(
                event_type=QUALITY_DECLINING,
                strategy_name=strategy_name,
                passport=passport,
            ))

        return passport

    def get_passport(self, strategy_name: str) -> RatingPassport | None:
        return self._passports.get(strategy_name)

    def get_all_passports(self) -> list[RatingPassport]:
        return list(self._passports.values())

    def rank(self, metric: str | None = None, min_trades: int = 10) -> list[RatingPassport]:
        return self._ranker.rank(self.get_all_passports(), metric=metric, min_trades=min_trades)

    def top_n(self, n: int = 5, min_trades: int = 10) -> list[RatingPassport]:
        return self._ranker.top_n(self.get_all_passports(), n=n, min_trades=min_trades)

    def compare(self, a: str, b: str) -> dict:
        pa = self._passports.get(a)
        pb = self._passports.get(b)
        if not pa or not pb:
            return {"error": f"Strategy not found: {a if not pa else b}"}
        return self._ranker.compare(pa, pb)

    def get_trend(self, strategy_name: str) -> dict:
        return self._history.get_trend(strategy_name)

    def get_history(self, strategy_name: str) -> list:
        """Получить историю метрик стратегии."""
        return self._history.get_history(strategy_name)

    def get_declining(self, threshold: float = -1.0) -> list[dict]:
        return self._history.all_declining(threshold=threshold)

    def save_history(self, path: str | None = None) -> str:
        return self._history.save(path)

    def load_history(self, path: str) -> None:
        self._history.load(path)
