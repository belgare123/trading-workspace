"""Core package — ядро Trading Workspace Platform."""

from __future__ import annotations

from core.api import Event, MarketDataBus, SignalResult, get_bus

__version__ = "0.15.0"

__all__ = [
    "Event",
    "MarketDataBus",
    "SignalResult",
    "get_bus",
    "__version__",
]
