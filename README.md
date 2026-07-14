# ⚡ Trading Workspace Platform

**Modular algorithmic trading platform** — real-time market data pipeline, pluggable strategies, decision engine, portfolio management, ML learning engine, marketplace ecosystem, and workspace UI.

[![Python](https://img.shields.io/badge/python-3.11-blue)]()
[![Version](https://img.shields.io/badge/v1.0.0--stable-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-953%20passed-brightgreen)](tests/)
[![API](https://img.shields.io/badge/API-frozen-blueviolet)]()

---

## Quick Start (2 min)

```bash
# 1. Install
pip install trading-workspace

# 2. Verify
tw search momentum      # browse marketplace
tw install momentum-pro # install a strategy

# 3. Run backtest
python -c "
from screener_sdk import BaseStrategy
from core.replay import Timeline, generate_demo_events

events = generate_demo_events(count=100, seed=42)
tl = Timeline(events)
tl.seek(50)
print(f'Replay: {tl.position}/{len(tl.events)} ticks')
"
# → Replay: 50/100 ticks

# 4. Launch workspace UI (optional)
python -m workspace.main
# → http://localhost:9120
```

---

## Architecture

```
                Trading Platform

                     Runtime
                        │
        ┌───────────────┼───────────────┐
        │               │               │
    Workspace      Trading Lab     Marketplace
        │               │               │
        └───────────────┼───────────────┘
                        │
                   Event Store
```

Full architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Architecture Guide](docs/architecture-guide.md) | Full platform architecture, module map, data flow |
| [Developer Guide](docs/developer-guide.md) | Writing your first strategy in 5 minutes |
| [Plugin Guide](docs/plugin-guide.md) | Publishing packages to the marketplace |
| [Event Store Guide](docs/event-store-guide.md) | Event journal, traces, aggregate streams |
| [API Reference](docs/api-reference.md) | SDK reference + CLI reference + programmatic API |
| [Sequence Diagrams](docs/sequence-diagrams.md) | Signal lifecycle, replay, quality, learning flows |
| [Extension Guide](docs/extension-guide.md) | Adding new engines, apps, features, CLI commands |

---

## Key Features

- **Event-driven** — every mutation logged to Event Store; full audit trail
- **Deterministic Replay** — debug strategies with breakpoints, snapshot states
- **Correlation Traces** — follow any signal from creation → decision → opportunity → trade → close
- **Plugin System** — install strategies, signals, indicators via marketplace CLI
- **ML Learning Engine** — regime classification, performance prediction, anomaly detection
- **Portfolio Management** — dynamic allocation, risk management, P&L tracking
- **Workspace UI** — real-time dashboard, scanner, inspector, replay studio, system monitor

---

## Project Structure

```
trading-workspace/
├── core/            # Engine (strategy, decision, lifecycle, replay, event store, learning, …)
├── marketplace/     # Package registry, CLI, dependency management
├── workspace/       # FastAPI web UI (8 apps: scanner, inspector, strategies, …)
├── screener_sdk/    # Public SDK for strategy authors
├── exchanges/       # Exchange adapters (Binance, Bybit, OKX)
├── tests/           # Test suite (953 tests)
├── docs/            # Documentation
├── examples/        # Runnable demo scripts
├── scripts/         # DevOps and validation scripts
├── SUPPORT.md       # Python/OS compatibility, release lifecycle
└── ARCHITECTURE.md  # Architecture overview (1 page)
```

---

## Tests

```bash
# Full suite
pytest tests/ -q

# Specific module
pytest tests/test_event_store.py -v

# Performance baseline
python scripts/performance_baseline.py

# Long-running stress (1h default, 12h overnight)
python scripts/long_running_stress.py --duration 12
```

---

## Support

- **Python**: 3.11+ (primary: 3.11, community: 3.12)
- **OS**: Windows, Linux, macOS
- **Database**: SQLite (built-in, no external DB required)
- **License**: MIT

See [`SUPPORT.md`](SUPPORT.md) for full compatibility and release lifecycle.

---

## Roadmap

| Generation | Focus |
|------------|-------|
| **v1.0** ✅ | **Trading Platform — Initial Stable Release** (Core stabilized, API frozen, Workspace complete, 953+ tests) |
| Gen 2 🔄 | **Runtime API** — Workspace becomes a client of the Runtime; Multi-Exchange adapters; Marketplace cloud |
| Gen 3 | **Simulation Lab** — Monte Carlo, walk-forward, distributed compute, portfolio simulation |

Full roadmap: [`docs/release-roadmap.md`](docs/release-roadmap.md)
