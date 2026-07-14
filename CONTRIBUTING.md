# Contributing

First off, thank you for considering contributing to Trading Workspace Platform.

## Code of Conduct

This project adheres to a **no-drama policy**. Be respectful, constructive, and professional.

## Quick Start

```bash
git clone https://github.com/belgare123/trading-workspace.git
cd trading-workspace
pip install -e .
pytest tests/ -q
```

## Development Workflow

1. **Branch**: create a feature branch from `main`
2. **Code**: follow existing patterns (type hints, docstrings, single-responsibility modules)
3. **Test**: ensure all existing tests pass (`pytest tests/ -q`) and add new tests for changes
4. **PR**: open a pull request with a clear description of the change

## Guidelines

- **Python 3.11+** — no backward compatibility below 3.11
- **Type hints** — all public functions must have type annotations
- **Module size** — aim for 300–500 lines; one responsibility per module
- **Event-driven** — cross-layer communication through events, not direct imports
- **Tests** — every bug fix needs a regression test; every new feature needs coverage

## Project Structure

```
trading-workspace/
├── core/            # Engine (strategy, decision, lifecycle, replay, event store, …)
├── marketplace/     # Package registry, CLI, dependency management
├── workspace/       # FastAPI web UI
├── screener_sdk/    # Public SDK for strategy authors
├── exchanges/       # Exchange adapters (Binance, Bybit, OKX)
├── tests/           # Test suite
├── docs/            # Documentation
└── examples/        # Runnable demo scripts
```

## Testing

```bash
# Full suite
pytest tests/ -q

# Specific module
pytest tests/test_event_store.py -v

# With coverage
pip install pytest-cov
pytest tests/ --cov=core --cov=marketplace --cov=screener_sdk
```

## Release Process

See [`docs/release-roadmap.md`](./docs/release-roadmap.md) for the version plan.
