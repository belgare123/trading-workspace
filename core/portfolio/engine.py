"""
Portfolio Engine — Orchestrator (Phase 12.9).

Центральный координатор Portfolio Engine.

Pipeline:
  Market Regime (Analytics Engine)
    → RegimeAllocator (какие стратегии подходят)
    → StrategySelector (выбор лучших)
    → WeightEngine (динамические веса)
    → PortfolioOptimizer (риски, диверсификация)
    → Bus (события)
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics import AnalyticsEngine, MarketRegime, RegimeType
from core.portfolio.allocator import RegimeAllocator
from core.event_store import EventStore
from core.event_store.sqlite_repo import SQLiteEventRepository
from core.portfolio.bus import PortfolioBus
from core.portfolio.metrics import PortfolioMetricsCollector
from core.portfolio.models import (
    PortfolioAction,
    PortfolioAllocation,
    PortfolioConfig,
    PortfolioState,
    RiskLevel,
    StrategySlot,
)
from core.portfolio.optimizer import PortfolioOptimizer
from core.portfolio.registry import StrategyRegistry
from core.portfolio.selector import StrategySelector
from core.portfolio.weight import WeightEngine
from core.quality import QualityEngine, RatingPassport

logger = logging.getLogger(__name__)


class PortfolioEngine:
    """Orchestrator Portfolio Engine."""

    def __init__(
        self,
        config: PortfolioConfig | None = None,
        bus: PortfolioBus | None = None,
        analytics: AnalyticsEngine | None = None,
        quality: QualityEngine | None = None,
    ) -> None:
        self._config = config or PortfolioConfig()
        self._bus = bus or PortfolioBus(
            event_store=EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        )
        self._analytics = analytics
        self._quality = quality

        self._registry = StrategyRegistry()
        self._allocator = RegimeAllocator(self._config)
        self._selector = StrategySelector(self._config)
        self._weights = WeightEngine(self._config)
        self._optimizer = PortfolioOptimizer(self._config)
        self._metrics = PortfolioMetricsCollector()

        self._last_regime: RegimeType | None = None
        self._current_weights: dict[str, float] = {}

    # ── Public API ──

    @property
    def bus(self) -> PortfolioBus:
        return self._bus

    @property
    def registry(self) -> StrategyRegistry:
        return self._registry

    @property
    def config(self) -> PortfolioConfig:
        return self._config

    @property
    def state(self) -> PortfolioState:
        return self._registry.state

    # ── Strategy Registration ──

    def register_strategy(
        self,
        name: str,
        role: str = "opp",
        base_weight: float = 1.0,
        allowed_regimes: list[str] | None = None,
        excluded_regimes: list[str] | None = None,
        min_rating: str = "C",
    ) -> StrategySlot:
        """Зарегистрировать стратегию в портфеле."""
        from core.portfolio.models import StrategyRole as SR
        role_map = {"core": SR.CORE, "opp": SR.OPPORTUNISTIC,
                     "hedge": SR.HEDGE, "satellite": SR.SATELLITE}
        regime_map = {r.value: r for r in RegimeType}

        return self._registry.register(
            name=name,
            role=role_map.get(role, SR.OPPORTUNISTIC),
            base_weight=base_weight,
            allowed_regimes=[regime_map[r] for r in (allowed_regimes or []) if r in regime_map],
            excluded_regimes=[regime_map[r] for r in (excluded_regimes or []) if r in regime_map],
            min_rating=min_rating,
        )

    def unregister_strategy(self, name: str) -> None:
        self._registry.unregister(name)

    # ── Core Pipeline ──

    def update(
        self,
        market_regime: MarketRegime | None = None,
        regime: RegimeType | None = None,
        regimes: list[RegimeType] | None = None,
    ) -> dict[str, float]:
        """Обновить портфель на основе текущего режима.

        Returns:
            Словарь {имя_стратегии: вес}.
        """
        # Определение режима
        actual_regime = self._resolve_regime(market_regime, regime)
        if actual_regime is None:
            actual_regime = RegimeType.UNKNOWN

        # Смена режима
        if self._last_regime and self._last_regime != actual_regime:
            self._metrics.record_regime_change()
            self._bus.emit_regime_change(actual_regime.value)

        # Обновление состояния
        for slot in self.state.slots.values():
            slot.is_active = (slot.name in self._current_weights
                              and self._current_weights.get(slot.name, 0) > 0)
        self._last_regime = actual_regime

        # Pipeline
        allocations = self._allocator.allocate(
            self.state, actual_regime,
        )

        # Оптимизация
        allocations = self._optimizer.optimize(self.state, allocations)

        # Расчет весов (уважаем решения аллокатора)
        weights: dict[str, float] = {}
        for alloc in allocations:
            if alloc.weight <= 0.0:
                weights[alloc.slot_name] = 0.0
                continue
            slot = self._registry.get(alloc.slot_name)
            if slot is None:
                continue
            passport = self._get_passport(alloc.slot_name)
            weight = self._weights.calculate(slot, market_regime or MarketRegime(), passport)
            weights[alloc.slot_name] = weight

        # Нормализация
        weights = WeightEngine.normalize(weights)
        self._current_weights = weights

        # Событие
        self._bus.emit_rebalance(allocations)

        # Метрики
        self._metrics.snapshot(
            weights=weights,
            rebalances=self._optimizer.rebalance_count,
        )

        return weights

    def get_weight(self, strategy_name: str) -> float:
        return self._current_weights.get(strategy_name, 0.0)

    def get_weights(self) -> dict[str, float]:
        return dict(self._current_weights)

    def get_metrics(self) -> dict[str, Any]:
        snapshots = self._metrics.get_history()
        return snapshots[-1].to_dict() if snapshots else {}

    def get_metrics_history(self) -> list[dict[str, Any]]:
        return [s.to_dict() for s in self._metrics.get_history()]

    def set_config(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            if hasattr(self._config, key):
                setattr(self._config, key, value)

    def clear(self) -> None:
        self._registry.clear()
        self._optimizer.reset()
        self._metrics.clear()
        self._current_weights.clear()
        self._last_regime = None

    # ── Internal ──

    def _resolve_regime(
        self,
        market_regime: MarketRegime | None,
        regime: RegimeType | None,
    ) -> RegimeType | None:
        if market_regime is not None:
            return market_regime.regime
        if regime is not None:
            return regime
        # Попробовать взять из Analytics Engine
        if self._analytics is not None:
            try:
                profiles = self._analytics.get_all_profiles()
                if profiles:
                    return profiles[-1].regime.regime
            except Exception:
                pass
        return RegimeType.UNKNOWN

    def _get_passport(self, name: str) -> RatingPassport | None:
        if self._quality is None:
            return None
        try:
            return self._quality.get_passport(name)
        except Exception:
            return None
