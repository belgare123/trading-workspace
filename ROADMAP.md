# Roadmap

## Trading Workspace Platform

| # | Phase | Status |
|---|-------|--------|
| 0–9 | Infrastructure → Replay (Plugin Platform, Decision Engine, Lifecycle, Replay) | ✅ |
| 10 | Quality Engine (Passport, ★★★★★, Confidence A/B/C/D) | ✅ |
| 11 | Analytics Engine (10 Market Regimes, Volatility, Liquidity, Dominance) | ✅ |
| 12 | Portfolio Engine (Dynamic weighting, RegimeAllocator, Optimizer) | ✅ |
| 13 | Learning Engine (ML: Classifier, Predictor, Anomaly, Optimizer) | ✅ |
| **14** | **Workspace Platform** (10 apps: Scanner, Opportunities, Strategies, Replay Studio, Inspector, Learning Center, Plugin Store, System Monitor, API Explorer, Settings) | ✅ |
| 15 | Marketplace | ⏳ |
| 16 | Multi-Exchange Runtime | ⏳ |
| 17 | Simulation Lab | ⏳ |

## Deprecation: bootstrap.py

| Version | Status |
|---------|--------|
| v0.14.x | `bootstrap.py` работает с `DeprecationWarning`. Entry point: `run.py` (через `Application.launch()`) |
| v1.0.0  | `bootstrap.py` удаляется |
