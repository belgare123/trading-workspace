# Phase 15.1 — Architecture Audit Report

**Date:** 2026-07-13
**Project:** Trading Workspace Platform v0.15.0
**Total LOC:** ~30K Python
**Tests:** 861/861 passing

---

## Findings Summary

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 Critical | 1 | DI singleton cascade |
| 🟠 High | 3 | V1/V2 engine shadow duplication |
| 🟡 Medium | 4 | Legacy modules, test gaps |
| 🔵 Low | 3 | Style, dead code, minor fragmentation |

---

## 🔴 Critical: DI Container vs Singleton Cascade

### Problem
The DI container exists (`core/di/container.py`) and is wired in `bootstrap.py`, but **30+ modules** in `core/` use module-level `get_*()` factory functions that create singletons independently. This creates a **singleton cascade** — modules have their own singleton instances outside the container's control.

### Affected Modules (30+)

| Module | get_* functions |
|--------|----------------|
| `core/consensus/engine.py` | `get_consensus_engine()` |
| `core/features/engine.py` | `get_feature_engine()` |
| `core/features/store.py` | `get_feature_store()` |
| `core/signal/engine.py` | `get_signal_engine()` |
| `core/signal_dna.py` | `get_dna_store()` |
| `core/market_replay.py` | `get_replay_engine()` |
| `core/risk/engine.py` | `get_risk_engine()` |
| `core/adaptive.py` | `get_adaptive_engine()` |
| `core/cache.py` | `get_cache_service()` |
| `core/session.py` | `get_session_manager()` |
| `core/api.py` | `get_api_manager()` |
| ... | (20+ more similar) |

### Impact
- Tests that bypass bootstrap get **different singleton instances**
- No single source of truth for dependency graph
- Hard to mock — need to patch module-level globals
- Two instances of same service can exist simultaneously

### Recommendation
- **Phase 1**: Add a `container` parameter to all `get_*()` functions (optional, defaults to module-level singleton)
- **Phase 2**: Deprecate `get_*()` — use `container.get("name")` everywhere
- **Phase 3**: Remove `get_*()` entirely

---

## 🟠 High: V1/V2 Engine Shadow Duplication

### 1. ConsensusEngine (V1 vs V2)

| Aspect | V1 (`core/consensus/`) | V2 (`core/decision/consensus.py`) |
|--------|----------------------|-----------------------------------|
| Lines | ~500 LOC (engine + models + rank) | ~150 LOC |
| Status | Still imported by bootstrap.py:357, run_backtest.py:48, smoke_test.py:96 | Active pipeline |
| Purpose | Original consensus with ranking | Refactored consensus in decision pipeline |
| Risk | Both run in boot. V1 is shadow — results ignored? | 🟠 |

### 2. MarketReplayEngine vs ReplayEngine

| Aspect | V1 (`core/market_replay.py`) | V2 (`core/replay/`) |
|--------|------------------------------|---------------------|
| Lines | 282 LOC | 341 + 111 + 89 + 191 LOC |
| Status | Imported by bootstrap.py:238, run_backtest.py:36 | Active (Phase 9) |
| Risk | V1 configures dashboard data; may cause inconsistency | 🟠 |

### 3. SignalEngine (dual identity)

`core/signal/engine.py:21` is called both V1 and V2 in different imports. bootstrap.py:390 imports it as `SignalEngineV2`. Possible confusion.

### Recommendation
- **Audit V1 consumers**: which code still reads V1 engine output?
- **Remove V1 imports** from bootstrap, run_backtest, smoke_test
- **Migrate last V1 consumers** to V2 API
- **Delete V1 modules** once migration confirmed

---

## 🟡 Medium: Legacy Top-Level Modules

### `events/` — (4 files, live code)
- `events/base.py`, `events/candles.py`, `events/volume.py`, `events/whale.py`
- Appears to be V1 event system. Needs audit: is it imported anywhere?

### `context/` — (1 file)
- `context/market_context.py` — possible duplication with `core/strategy/context.py`
- Check: is it imported by anyone?

### `storage/` — (2 files)
- `storage/analytics.py`, `storage/db.py` — V1 persistence layer
- Check: is it imported? Modern storage is in `core/storage/`

### `scanner/` — (4 files)
- `scanner/candles.py`, `scanner/orderbook.py`, `scanner/ticker.py`, `scanner/trades.py`
- V1 scanner — check consumption

### `utils/` — (1 file)
- `utils/logger.py` — simple logging utility, probably fine

### `strategies/` (top-level)
- `strategies/base.py`, `strategies/momentum_v2.py` — V1 strategy examples
- Possibly dead — strategies now live in `strategies/*/manifest.yaml `

### Recommendation
- Run `grep -rn "from events\|from context\|from storage\|from scanner\|from utils\|from strategies" --include='*.py' . | grep -v __pycache__` to find remaining consumers
- Move surviving interfaces to `core/`
- Delete empty/unused modules

---

## 🟡 Medium: Test Coverage Gaps

| Module | Test File | Status |
|--------|-----------|--------|
| `core/features/` | `tests/test_features.py` | **❌ MISSING** |
| `core/replay/` | `tests/test_replay.py` | ✅ |
| `core/quality/` | `tests/test_quality.py` | ✅ |
| `core/analytics/` | `tests/test_analytics.py` | ✅ |
| `core/portfolio/` | `tests/test_portfolio.py` | ✅ |
| `core/learning/` | `tests/test_learning.py` | ✅ |
| `core/lifecycle/` | `tests/test_lifecycle.py` | ✅ |
| `core/di/` | `tests/test_di.py` | **❌ MISSING** |
| `core/strategy/` | `tests/test_strategy.py` | ✅ (large) |
| `marketplace/` | `tests/test_marketplace.py` | ✅ (Phase 15) |

### Impact
- FeatureEngine (the most performance-critical module) has no dedicated test file
- DI container has no tests (makes migration harder)

### Recommendation
- Create `tests/test_features.py` — at minimum: smoke test all calculators, accuracy tests
- Create `tests/test_di.py` — container registration, resolution, lifecycle

---

## 🔵 Low: Other Issues

### 1. `core/legacy/` — empty placeholder
- `__init__.py` with docstring "backward compatibility layer" but zero content
- Fine as-is, or remove if unused

### 2. `{exchanges` — deleted ✓
- Git artifact, confirmed not imported. Removed.

### 3. `workspace/apps/plugins/` — no Python files
- Store app directory exists but empty. Needs wiring for Phase 15 Marketplace-store integration.

---

## Action Priority

| Priority | Task | Effort |
|----------|------|--------|
| **P0** | Move V1 engine consumers to V2 (consensus, replay, signal) | 2–3h |
| **P1** | Add container parameter to `get_*()` — begin migration | 4–6h |
| **P1** | Create `tests/test_features.py` | 2h |
| **P2** | Audit legacy `events/`, `context/`, `storage/`, `scanner/` | 1h |
| **P2** | Create `tests/test_di.py` | 1h |
| **P3** | Clean up unused V1 modules after migration | 1h |
| **P3** | Remove `core/legacy/` placeholder | 0.2h |
| **P4** | Wire `workspace/apps/plugins/` to Marketplace | 2h |
