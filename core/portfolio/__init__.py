"""
Portfolio Engine — Phase 12.

Динамическое управление портфелем стратегий под рыночный режим.

Компоненты:
  12.1  Models           — StrategySlot, PortfolioState, PortfolioConfig,
                           PortfolioAllocation, PortfolioEvent
  12.2  Registry         — StrategyRegistry (регистрация/управление)
  12.3  RegimeAllocator  — Распределение стратегий по режиму
  12.4  WeightEngine     — Динамическое взвешивание (режим + качество)
  12.5  StrategySelector — Выбор лучших стратегий
  12.6  PortfolioOptimizer — Оптимизация (риски, диверсификация)
  12.7  Metrics          — PortfolioMetricsCollector
  12.8  Events           — 7 событий
  12.9  Bus              — PortfolioBus
  12.10 Engine           — PortfolioEngine (оркестратор)
"""

from core.portfolio.allocator import RegimeAllocator
from core.portfolio.bus import PortfolioBus
from core.portfolio.engine import PortfolioEngine
from core.portfolio.events import (
    PORTFOLIO_REBALANCED,
    PORTFOLIO_REGIME_CHANGED,
    PORTFOLIO_RISK_WARNING,
    PORTFOLIO_STRATEGY_DISABLED,
    PORTFOLIO_STRATEGY_ENABLED,
    PORTFOLIO_UPDATED,
    PORTFOLIO_WEIGHT_CHANGED,
)
from core.portfolio.metrics import PortfolioMetricsCollector, PortfolioMetricsSnapshot
from core.portfolio.models import (
    PortfolioAction,
    PortfolioAllocation,
    PortfolioConfig,
    PortfolioEvent,
    PortfolioState,
    RiskLevel,
    StrategyRole,
    StrategySlot,
)
from core.portfolio.optimizer import PortfolioOptimizer
from core.portfolio.registry import StrategyRegistry
from core.portfolio.selector import StrategySelector
from core.portfolio.weight import WeightEngine

__all__ = [
    # Models
    "StrategySlot",
    "StrategyRole",
    "PortfolioState",
    "PortfolioConfig",
    "PortfolioAllocation",
    "PortfolioAction",
    "RiskLevel",
    "PortfolioEvent",
    # Core
    "StrategyRegistry",
    "RegimeAllocator",
    "WeightEngine",
    "StrategySelector",
    "PortfolioOptimizer",
    "PortfolioMetricsCollector",
    "PortfolioMetricsSnapshot",
    "PortfolioBus",
    "PortfolioEngine",
    # Events
    "PORTFOLIO_UPDATED",
    "PORTFOLIO_REBALANCED",
    "PORTFOLIO_REGIME_CHANGED",
    "PORTFOLIO_STRATEGY_ENABLED",
    "PORTFOLIO_STRATEGY_DISABLED",
    "PORTFOLIO_WEIGHT_CHANGED",
    "PORTFOLIO_RISK_WARNING",
]
