# ⚡ Trading Workspace Platform

**Modular algorithmic trading platform** — real-time market data pipeline, pluggable strategies, decision engine, portfolio management, ML learning engine, and a full workspace UI.

> **v0.14.0** — Phase 14: Workspace Platform.

[![Python](https://img.shields.io/badge/python-3.11-blue)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Architecture

```
                    ┌─────────────────────────┐
                    │     Telegram Bot        │
                    │  (notifications, cmds)  │
                    └───────────┬─────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────────┐
│                        WORKSPACE (Phase 14)                      │
│  ┌──────────┬──────────┬──────────┬──────────┬─────────────────┐ │
│  │ Scanner  │ Opport.  │ Strategy │ Replay   │  Inspector      │ │
│  │ (signals)│ (trades) │ (mgmt)   │ (studio) │  (features)     │ │
│  ├──────────┼──────────┼──────────┼──────────┼─────────────────┤ │
│  │ Learning │ Plugins  │ Monitor  │  API Exp │  Settings       │ │
│  │ (ML hub) │ (store)  │ (system) │ (explore)│  (config)       │ │
│  └──────────┴──────────┴──────────┴──────────┴─────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    CORE ENGINE        │
│  ┌──────────────────┬──────────────────┬──────────────────┐ │
│  │  Decision Engine │  Portfolio       │  Learning        │ │
│  │  (Phase 0–3)     │  (Phase 12)      │  (Phase 13)      │ │
│  ├──────────────────┼──────────────────┼──────────────────┤ │
│  │  Quality Engine  │  Analytics       │  Lifecycle       │ │
│  │  (Phase 10)      │  (Phase 11)      │  (Phase 8)       │ │
│  └──────────────────┴──────────────────┴──────────────────┘ │
│                    │         │              │
│                    ▼         ▼              ▼
│              ┌─────────────────────────────────┐
│              │  Market Data Bus + Plugin Runtime│
│              │  (Service Registry, DI, Events)  │
│              └─────────────────────────────────┘
```

## Features

| Feature | Status |
|---------|--------|
| Market Data Bus (WebSocket REST) | ✅ |
| Pluggable Strategy Pipeline | ✅ |
| Plugin Platform (10 components) | ✅ |
| Decision Engine (Signals → Opportunities) | ✅ |
| Opportunity Lifecycle (10 states) | ✅ |
| Market Replay Framework | ✅ |
| Quality Engine (passport, ★★★★★, confidence) | ✅ |
| Analytics Engine (10 market regimes) | ✅ |
| Portfolio Engine (dynamic weighting) | ✅ |
| Learning Engine (ML: classifier, predictor, anomaly) | ✅ |
| **Workspace Platform** (10 apps, WebSocket, API) | ✅ |

## Quick Start

```bash
# Install
uv pip install -e .

# Run workspace
uvicorn workspace.main:app --host 127.0.0.1 --port 9120

# Open browser
# → http://localhost:9120
```

## Workspace Apps

| # | App | Route | Description |
|---|-----|-------|-------------|
| 1 | 🔍 Scanner | `/scanner` | Live signal stream |
| 2 | 🎯 Opportunities | `/opportunities` | Active/pending/stopped trades |
| 3 | 🧠 Strategies | `/strategies` | Health, metrics, lifecycle |
| 4 | ▶️ Replay Studio | `/replay` | Deterministic backtest IDE |
| 5 | 🔬 Inspector | `/inspector` | Feature analysis per symbol |
| 6 | 🤖 Learning Center | `/learning` | ML models, retrain, accuracy |
| 7 | 🧩 Plugin Store | `/plugins` | Browse and install plugins |
| 8 | 📊 System Monitor | `/monitor` | Runtime: services, CPU, RAM |
| 9 | 📡 API Explorer | `/api` | Live endpoint reference |
| 10 | ⚙️ Settings | `/settings` | Platform configuration |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/system/status` | Runtime status |
| GET | `/api/v1/inspector/{symbol}` | Feature inspector |
| GET | `/apps` | List workspace apps |
| WS | `/ws/scanner` | Live signals |
| WS | `/ws/opportunities` | Live opportunities |
| WS | `/ws/strategies` | Strategy status |

## Roadmap

| # | Phase | Status |
|---|-------|--------|
| 0–9 | Infrastructure → Replay | ✅ |
| 10 | Quality Engine | ✅ |
| 11 | Analytics Engine | ✅ |
| 12 | Portfolio Engine | ✅ |
| 13 | Learning Engine | ✅ |
| **14** | **Workspace Platform** | **✅** |
| 15 | Marketplace | ⏳ |
| 16 | Multi-Exchange Runtime | ⏳ |
| 17 | Simulation Lab | ⏳ |

## Tech Stack

- **Language:** Python 3.11+
- **Async Runtime:** asyncio
- **Web:** FastAPI + Jinja2 + WebSocket
- **Data:** WebSocket feeds (Bybit/Binance)
- **ML:** scikit-learn (via Learning Engine)
- **Runtime:** Docker (optional), uvicorn

## Project Structure

```
G:\bot\trading-workspace/
├── core/           — Engine layer (decision, lifecycle, replay, quality, analytics, portfolio, learning)
├── workspace/      — Web UI (Phase 14)
│   ├── main.py     — FastAPI entry
│   ├── core/       — App registry, models
│   ├── static/     — CSS, JS
│   └── templates/  — Jinja2 layout
├── plugins/        — Plugin platform
├── tests/          — 799+ tests
├── data/           — Market data cache
└── docs/           — Architecture, ADRs
```
