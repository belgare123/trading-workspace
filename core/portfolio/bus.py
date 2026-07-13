"""
Portfolio Engine — Event Bus (Phase 12.8).
"""

from __future__ import annotations

import logging
from typing import Callable

from core.portfolio.events import (
    PORTFOLIO_REBALANCED,
    PORTFOLIO_REGIME_CHANGED,
    PORTFOLIO_RISK_WARNING,
    PORTFOLIO_STRATEGY_DISABLED,
    PORTFOLIO_STRATEGY_ENABLED,
    PORTFOLIO_UPDATED,
    PORTFOLIO_WEIGHT_CHANGED,
)
from core.portfolio.models import PortfolioAllocation, PortfolioEvent

logger = logging.getLogger(__name__)

Handler = Callable[[PortfolioEvent], None]


class PortfolioBus:
    """Шина событий Portfolio Engine."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = {}

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def unsubscribe(self, event_type: str, handler: Handler) -> None:
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    def emit(self, event: PortfolioEvent) -> None:
        for handler in self._handlers.get(event.event_type, []):
            try:
                handler(event)
            except Exception:
                logger.exception("PortfolioBus: handler failed for %s", event.event_type)

    def emit_rebalance(self, allocations: list[PortfolioAllocation]) -> None:
        self.emit(PortfolioEvent(
            event_type=PORTFOLIO_REBALANCED,
            message=f"Rebalanced: {len(allocations)} allocations",
        ))

    def emit_regime_change(self, regime_name: str) -> None:
        self.emit(PortfolioEvent(
            event_type=PORTFOLIO_REGIME_CHANGED,
            message=f"Regime changed to {regime_name}",
        ))
