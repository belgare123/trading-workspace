# ⚡ Trading Workspace Platform

**Modular algorithmic trading platform** — real-time market data pipeline, pluggable strategies, decision engine, portfolio management, ML learning engine, marketplace ecosystem, and full workspace UI.

> **v0.15.0** — Phase 15: Marketplace Platform.

[![Python](https://img.shields.io/badge/python-3.11-blue)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-861%20passed-brightgreen)](tests/)

---

## Quick Start

```bash
# Install
pip install -e .

# Verify
python -c "from screener_sdk import BaseStrategy; print('SDK OK')"

# Browse marketplace
tw search momentum
tw info ict-concepts
tw install momentum-pro

# Run backtest
python run_backtest.py --strategy momentum-pro --symbol BTCUSDT --days 30

# Launch dashboard
python workspace/main.py
# → http://localhost:9120
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Architecture Guide](docs/architecture-guide.md) | Full platform architecture, module map, data flow |
| [Developer Guide](docs/developer-guide.md) | Writing your first strategy |
| [Plugin Guide](docs/plugin-guide.md) | Publishing packages to the marketplace |
| [API Reference](docs/api-reference.md) | SDK reference + CLI reference + programmatic API |
| [Sequence Diagrams](docs/sequence-diagrams.md) | Signal lifecycle, replay, quality, learning flows |
| [Extension Guide](docs/extension-guide.md) | Adding new engines, apps, features, CLI commands |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Workspace UI                          │
│  FastAPI + Jinja2 — 10 apps (Store, Monitor, Scanner…)   │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│                      Core Engine                          │
│                                                           │
│  Exchanges → Features → Strategies → Decision → Lifecycle│
│  Quality → Analytics → Portfolio → Learning → Replay     │
│                                                           │
│  DI Container (core/di/)  ·  EventBus (core/decision/)    │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│                      Marketplace                          │
│  Registry · Package Manager · CLI · Trust · Passports     │
│  Benchmarks · Compatibility · Channels · Community        │
└──────────────────────────────────────────────────────────┘
```

## Phases

| Phase | Component | Status |
|-------|-----------|--------|
| 0–3 | Data Ingestion, Features, Strategies | ✅ |
| 4–6 | Decision Engine, Plugin System | ✅ |
| 7 | Opportunity Lifecycle | ✅ |
| 8 | Market Replay | ✅ |
| 9 | Quality Engine (12 metrics) | ✅ |
| 10 | Analytics (10 regimes) | ✅ |
| 11 | Portfolio (dynamic weighting) | ✅ |
| 12 | Learning (ML/AI) | ✅ |
| 13–14 | Workspace Platform (FastAPI + 10 apps) | ✅ |
| **15** | **Marketplace Platform (12 components)** | **✅** |
| 15.1 | Stabilization (audit, perf, docs, examples) | 🔄 |

## Project Structure

```
trading-workspace/
├── core/               # Core engine (strategy, decision, lifecycle, replay, learning, …)
├── marketplace/        # Marketplace (registry, package manager, trust, CLI)
├── workspace/          # Web dashboard (FastAPI + Jinja2)
├── screener_sdk/       # Public SDK for strategy authors
├── exchanges/          # Exchange adapters (Bybit, Binance, OKX)
├── strategies/         # Local strategy packages
├── docs/               # Documentation
├── tests/              # Test suite (861+ tests)
├── run_backtest.py     # Backtesting CLI
├── run_hyperopt.py     # Hyperparameter optimization
└── tw                  # Marketplace CLI
```

## Tests

```bash
# Run full test suite
pytest tests/ -v

# Run specific module
pytest tests/test_marketplace.py -v
```

## License

MIT
