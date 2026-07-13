# Phase 15.1 — Stabilization Release
# v0.15.x → RC1 → RC2 → v1.0.0 Roadmap

**Project:** Trading Workspace Platform
**Current version:** v0.15.0 (Phase 15 Marketplace ✅)
**Target:** v1.0.0 Production Release

---

## v0.15.x (Phase 15.1 — Stabilization) ← **WE ARE HERE**

Phase 15.1 fixes, audits, docs, and examples for the Phase 15 Marketplace Platform.

| Item | Status | Description |
|------|--------|-------------|
| Architecture Audit | ✅ | `docs/architecture-audit-report.md` — 7 findings |
| Performance Profiling | ✅ | `core/profiler.py` + `docs/performance-report.md` |
| Documentation | ✅ | 6 guides in `docs/` (Architecture, Developer, Plugin, API, Extension, Diagrams) |
| Demo Examples | ✅ | 6 demos in `examples/` (basic, advanced, marketplace, decision, replay, learning) |
| Version bump | ✅ | `core.__version__` → 0.15.0 |
| Built-in Profiler | ✅ | `core/profiler.py` — decorator + context manager + stats |

---

## v0.15.1 → RC1 (Phase 15.2 — Stabilization Part 2)

Critical path to RC1 — fixing the 7 audit findings.

### 🔴 P0 — Must fix before RC1

| ID | Finding | Effort | Description |
|----|---------|--------|-------------|
| AUD-1 | **Hybrid DI** | 3d | `core/di/container.py` (150+ registrations) + 150+ `get_*()` singletons. Pick one pattern (prefer DI container) |
| AUD-2 | **V1/V2 ConsensusEngine** | 1d | `core/consensus/engine.py` (V1) vs `core/decision/consensus.py` (V2). Deprecate V1, forward imports to V2 |
| AUD-3 | **V1/V2 SignalEngine** | 1d | `core/signal/engine.py` (V1) vs `core/decision/engines/signal.py` (V2). Same treatment |
| AUD-4 | **V1/V2 MarketReplay** | 1d | `core/market_replay.py` (V1, undocumented) vs `core/replay/engine.py` (V2). Remove V1 |

### 🟠 P1 — Should fix before RC1

| ID | Finding | Effort | Description |
|----|---------|--------|-------------|
| AUD-5 | **Legacy top-level dirs** | 2d | `events/`, `context/`, `storage/`, `scanner/`, `utils/`, `strategies/` — V1 modules still imported. Audit each, migrate or deprecate |
| AUD-6 | **Test coverage gaps** | 2d | `test_features.py` missing; `core/features/` has 0 tests; add smoke tests for each engine |
| AUD-7 | **Duplicate SDKs** | 1d | `screener_sdk/` vs `core/strategy/plugin_api.py` — converge or remove |

### 🟡 P2 — Nice to have for RC1

| Item | Effort | Description |
|------|--------|-------------|
| Profiler CI test | 0.5d | Test `@profile` decorator doesn't break sync/async calls |
| Performance regression gate | 1d | Benchmark in CI — fail if decision engine > 1ms/call |
| Changelog | 0.5d | Auto-generate from git log since v0.14.0 |

---

## RC1 (v0.16.0)

**Entry criteria:**
1. ✅ All P0 fixed
2. ✅ All P1 fixed
3. ✅ 861+ tests pass (existing + new)
4. ✅ CI pipeline green (lint, test, benchmark)

**Release checklist:**
- [ ] Git tag `v0.16.0-rc1`
- [ ] Build wheel: `python -m build`
- [ ] Test install from wheel: `pip install dist/*.whl`
- [ ] Run full test suite on clean install
- [ ] Quick demo run: `python examples/basic_strategy/run.py`
- [ ] Write RC1 release notes

---

## RC2 (v0.17.0)

**Entry criteria:**
1. ✅ RC1 released and tested for 1 week
2. ✅ Bugs found during RC1 fixed
3. ✅ Cloud Platform (Phase 15.5) optionally included if ready
4. ✅ All `screener_sdk` → `trading_workspace_sdk` migration done

**Release checklist:**
- [ ] Git tag `v0.17.0-rc2`
- [ ] Regression test: compare RC2 performance vs RC1
- [ ] User acceptance testing — run demo on real markets
- [ ] Final API review — any breaking changes since v0.14.0?
- [ ] Write RC2 release notes
- [ ] One-week soak test

---

## v1.0.0

**Entry criteria:**
1. ✅ RC2 stable for 2+ weeks
2. ✅ No P0/P1 bugs open
3. ✅ Cloud Platform (Phase 15.5) stable
4. ✅ Documentation complete and reviewed
5. ✅ Demo examples all verified
6. ✅ Performance targets met (decision < 1ms, memory < 200MB)

**Release checklist:**
- [ ] Git tag `v1.0.0`
- [ ] Release on GitHub
- [ ] Publish wheel to PyPI (or internal registry)
- [ ] Publish `trading-workspace-sdk` to PyPI
- [ ] Update README with stable badge
- [ ] Write changelog: what changed since v0.14.0
- [ ] Announcement (internal / community)
- [ ] Start Phase 16 (Cloud Platform)
