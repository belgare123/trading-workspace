# Trading Workspace — Extension Guide

## Adding a New Service to the Platform

This guide explains how to extend the platform with custom services, engines, and applications.

---

## Service Types

### 1. New Engine (Core)

Add a new processing engine to the pipeline.

**Example: Create a `DivergenceEngine`**

```python
# core/divergence/engine.py
"""Divergence detection engine."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class DivergenceSignal:
    symbol: str
    type: str  # "regular_bullish", "regular_bearish", "hidden_bullish", "hidden_bearish"
    strength: float  # 0.0–1.0
    price_divergence: float
    indicator_divergence: float
    timestamp: float
    metadata: dict[str, Any] = field(default_factory=dict)


class DivergenceEngine:
    """Detects RSI/MACD divergences against price action."""

    def __init__(self, lookback: int = 14) -> None:
        self.lookback = lookback
        self.divergences: dict[str, list[DivergenceSignal]] = {}

    async def detect(
        self,
        symbol: str,
        prices: list[float],
        indicator: list[float],
        timestamp: float,
    ) -> list[DivergenceSignal]:
        """Detect divergences between price and indicator."""
        signals = []
        if len(prices) < self.lookback or len(indicator) < self.lookback:
            return signals

        # Regular bullish: price makes lower low, indicator makes higher low
        if (prices[-1] < prices[-self.lookback]
                and indicator[-1] > indicator[-self.lookback]):
            signals.append(DivergenceSignal(
                symbol=symbol,
                type="regular_bullish",
                strength=0.8,
                price_divergence=prices[-self.lookback] - prices[-1],
                indicator_divergence=indicator[-1] - indicator[-self.lookback],
                timestamp=timestamp,
            ))

        # Regular bearish: price makes higher high, indicator makes lower high
        elif (prices[-1] > prices[-self.lookback]
              and indicator[-1] < indicator[-self.lookback]):
            signals.append(DivergenceSignal(
                symbol=symbol,
                type="regular_bearish",
                strength=0.8,
                price_divergence=prices[-1] - prices[-self.lookback],
                indicator_divergence=indicator[-self.lookback] - indicator[-1],
                timestamp=timestamp,
            ))

        return signals

    def get_divergences(self, symbol: str) -> list[DivergenceSignal]:
        return self.divergences.get(symbol, [])
```

### 2. Register with DI Container

```python
# In core/app/bootstrap.py (Phase 0: Core Infrastructure)

from core.divergence.engine import DivergenceEngine

def register_core(container):
    # ... existing registrations ...

    # Register the new engine
    container.register_instance("divergence_engine", DivergenceEngine(lookback=20))
```

### 3. Wire into Pipeline

```python
# In core/decision/engine.py — integrate with decision pipeline

class DecisionEngine:
    def __init__(self, divergence_engine: DivergenceEngine | None = None):
        self.divergence_engine = divergence_engine

    async def enrich(self, signal: Signal, context: StrategyContext) -> Signal:
        """Enrich signals with divergence data."""
        if not self.divergence_engine:
            return signal

        prices = context.features.get("close", [])
        indicator = context.features.get("rsi", [])
        if not prices or not indicator:
            return signal

        divergences = await self.divergence_engine.detect(
            signal.symbol, prices, indicator, signal.timestamp,
        )
        if divergences:
            signal.metadata["divergences"] = [d.type for d in divergences]
            signal.metadata["divergence_strength"] = max(d.strength for d in divergences)

        return signal
```

---

## 2. New Workspace App

Add a new dashboard page to the Workspace UI.

**Example: Add a Divergence Monitor app**

### 2.1 Create the app module

```python
# workspace/apps/divergence/app.py
"""Divergence Monitor — live divergence detection display."""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/divergence", tags=["divergence"])


@router.get("/", response_class=HTMLResponse)
async def divergence_page(request: Request):
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Divergence Monitor</title>
        <link rel="stylesheet" href="/static/css/app.css">
    </head>
    <body>
        <div class="app-container">
            <h1>Divergence Monitor</h1>
            <div id="divergence-list"></div>
        </div>
        <script src="/static/js/divergence.js"></script>
    </body>
    </html>
    """)


@router.get("/api/data")
async def divergence_data():
    """API endpoint for live divergence data."""
    from core.app.application import get_application
    app = get_application()
    engine = app.container.get("divergence_engine")

    result = {}
    for symbol in engine.divergences:
        result[symbol] = [
            {"type": d.type, "strength": d.strength, "time": d.timestamp}
            for d in engine.divergences[symbol][-20:]  # Last 20
        ]
    return {"divergences": result}
```

### 2.2 Register in Workspace

```python
# In workspace/main.py

from workspace.apps.divergence.app import router as divergence_router

app.include_router(divergence_router)

# Register in sidebar
WORKSPACE_APPS.append({
    "name": "divergence",
    "label": "Divergence",
    "icon": "📊",
    "url": "/divergence",
    "category": "monitoring",
})
```

---

## 3. New Strategy Type

### 3.1 Create Strategy Package

```bash
strategies/DivergenceStrategy/
├── manifest.yaml
├── strategy.py
└── requirements.txt
```

### 3.2 Implement

```python
# strategies/DivergenceStrategy/strategy.py
from screener_sdk import BaseStrategy, StrategyContext, Signal, SignalBundle, SignalDirection

class DivergenceStrategy(BaseStrategy):
    """Detects hidden divergences for entry signals."""

    async def analyze(self, symbol: str, context: StrategyContext) -> SignalBundle | None:
        rsi = context.get_feature("rsi")
        price = context.price

        if not rsi:
            return None

        # Strategy uses feature-based divergence detection
        if rsi < 30 and context.has_feature("divergence_bullish"):
            signal = Signal(
                symbol=symbol,
                direction=SignalDirection.LONG,
                confidence=0.85,
                price=price,
                timestamp=context.timestamp,
                source=self.name,
                metadata={"divergence_type": "hidden_bullish"},
            )
            return SignalBundle(self.name, symbol, [signal], context.timestamp)

        return None
```

---

## 4. New Feature

Features are computed by `FeatureEngine`. To add a new indicator:

### 4.1 Create Calculator

```python
# core/features/calculators/divergence_calc.py
"""Divergence feature calculator."""

import numpy as np


def calculate_divergence_score(
    prices: np.ndarray,
    rsi_values: np.ndarray,
    lookback: int = 14,
) -> float:
    """Calculate divergence score: positive = bullish, negative = bearish."""
    if len(prices) < lookback or len(rsi_values) < lookback:
        return 0.0

    price_direction = 1 if prices[-1] > prices[-lookback] else -1
    rsi_direction = 1 if rsi_values[-1] > rsi_values[-lookback] else -1

    if price_direction != rsi_direction:
        # Divergence detected — score based on magnitude
        return float(price_direction * -rsi_direction * abs(
            (prices[-1] / prices[-lookback] - 1) * 100
        ))
    return 0.0
```

### 4.2 Register in FeatureEngine

```python
# In core/features/engine.py
from core.features.calculators.divergence_calc import calculate_divergence_score

class FeatureEngine:
    def _register_calculators(self):
        # ... existing ...
        self._calculators["divergence_score"] = calculate_divergence_score
```

---

## 5. New CLI Command

### 5.1 Add to Package Manager

```python
# In marketplace/package_manager.py

class PackageManager:
    def divergence_check(self, strategy_name: str) -> dict:
        """Check which strategies support divergence detection."""
        pkg = self.registry.get_package(strategy_name)
        if not pkg:
            return {"error": "not found"}

        features = {}
        for version_str, version in pkg.versions.items():
            caps = version.capabilities or []
            features[version_str] = {
                "supports_divergence": "divergence" in caps,
                "divergence_features": [f for f in caps if "divergence" in f.lower()],
            }
        return {"package": strategy_name, "features": features}
```

### 5.2 Add CLI Entry

```python
# In marketplace/cli.py
if args.command == "divergence":
    result = pm.divergence_check(args.name)
    print(json.dumps(result, indent=2, default=str))
```

---

## Architecture Principles

### When Adding New Code

1. **Follow the layer pattern**: `core/` → `marketplace/` → `workspace/` → `screener_sdk/`
2. **Use the DI Container**: register in `bootstrap.py`, resolve via `container.get("name")`
3. **Use the EventBus**: publish events for cross-component communication
4. **Keep SDK clean**: `screener_sdk` re-exports from `core.strategy` — add new models there
5. **Add tests**: minimum one test per public method
6. **Update docs**: at minimum update the relevant guide

### Dependency Direction

```
screener_sdk  →  core.strategy
marketplace   →  core.strategy, core.exchanges
workspace     →  core.*, marketplace.*
core          →  core.* only (no external deps on workspace/marketplace)
```

### Adding Tests

```python
# tests/test_divergence.py
import pytest
from core.divergence.engine import DivergenceEngine, DivergenceSignal


class TestDivergenceEngine:
    async def test_detect_bullish_divergence(self):
        engine = DivergenceEngine(lookback=5)
        prices = [100, 99, 98, 97, 96]      # price making lower lows
        indicator = [30, 31, 32, 33, 34]     # RSI making higher lows

        signals = await engine.detect("BTCUSDT", prices, indicator, 1000.0)
        assert len(signals) == 1
        assert signals[0].type == "regular_bullish"

    async def test_insufficient_data(self):
        engine = DivergenceEngine(lookback=14)
        signals = await engine.detect("BTCUSDT", [100], [30], 1000.0)
        assert len(signals) == 0

    def test_get_divergences_empty(self):
        engine = DivergenceEngine()
        assert engine.get_divergences("BTCUSDT") == []
```
