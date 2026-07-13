# Phase 15.1 — Architecture Audit Report

**Date:** 2026-07-13
**Project:** Trading Workspace Platform v0.15.0
**Total LOC:** ~30K Python
**Tests:** 861/861 passing
**Method:** Deep audit of all top-level dirs + core/ modules (22 files inspected)

---

## Findings Summary

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 Critical | 2 | DI singleton cascade + God-object |
| 🟠 High | 3 | V1/V2 engine shadow duplication |
| 🟡 Medium | 3 | Legacy modules, test gaps |
| 🔵 Low | 2 | Dead dirs, minor fragmentation |

---

## 🔴 Critical: DI Container vs Singleton Cascade

### Problem
The DI container (`core/di/container.py`) has a **dual registry** — one keyed by interface type (`_registry[type]`), another by string name (`_components[name]`). `bootstrap.py` uses only the named API (`register_instance` / `get`), so the interface-based protocol is dead code.

Meanwhile **15+ modules** in `core/` use module-level `get_*()` factory functions that create and cache singletons independently:

```python
# core/features/engine.py
_engine: FeatureEngine | None = None
def get_feature_engine() -> FeatureEngine:
    global _engine
    if _engine is None:
        _engine = FeatureEngine(...)
    return _engine
```

| Module | get_* function |
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
| `core/ome/engine.py` | `get_ome_engine()` |
| `core/state/manager.py` | `get_state_manager()` |
| `core/dna/manager.py` | `get_dna_manager()` |
| `core/strategy/engine.py` | `get_strategy_engine()` |

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

## 🔴 Critical: God-Object in `core/strategy/engine.py`

**LOC:** 1,107 | **Классы:** 8+ (StrategyEngine, PipelineEngine, StrategyPipeline, _MockStrategyEngine, _MockFeatureEngine, _StrategyExecutionWrapper и др.)

### Ответственности
1. Plugin discovery — `discover_strategies()` читает manifest.yaml из `strategies/`
2. Plugin lifecycle — load, enable, disable, remove
3. **Dependency resolution** — `resolve_dependencies()` (DAG + cycle detection)
4. Pipeline execution — iterate strategies, collect signals
5. Pipeline engine delegation — `PipelineEngine` (sub-class)
6. Mock objects — `_MockStrategyEngine`, `_MockFeatureEngine` для тестов
7. Import autofix — `_stage_import_strategy()` с monkey-patch sys.path
8. Metrics — timing, error tracking via `@measure_time`

### Проблемы
- Нарушение SRP (Single Responsibility Principle) — 7+ ответственностей в одном файле
- God-class затрудняет тестирование (нужно замокать половину класса для теста другой половины)
- `discover()` дублирует сканирование manifest.yaml из `marketplace/registry.py:PackageIndexBuilder`

### Recommendation
- Выделить `StrategyDiscoverer` (сканирование manifest.yaml)
- Выделить `StrategyLifecycleManager` (enable/disable/remove)
- Выделить `PipelineExecutor` (iter + measure)
- Убрать mock-классы в отдельный `testing/` модуль
- Объединить `discover()` с `PackageIndexBuilder` marketplace

---

## 🟠 High: V1/V2 Engine Shadow Duplication

### 1. ConsensusEngine (V1 vs V2)

| Aspect | V1 (`core/consensus/`) | V2 (`core/decision/consensus.py`) |
|--------|----------------------|-----------------------------------|
| Lines | ~500 LOC (engine + models + rank) | ~150 LOC |
| Status | Still imported by `bootstrap.py:357`, `run_backtest.py:48`, `smoke_test.py:96` | Active pipeline |
| Purpose | Original consensus with ranking | Refactored consensus in decision pipeline |
| Risk | Both run in boot. V1 is shadow — results ignored? | 🟠 |

### 2. MarketReplayEngine vs ReplayEngine

| Aspect | V1 (`core/market_replay.py`) | V2 (`core/replay/`) |
|--------|------------------------------|---------------------|
| Lines | 282 LOC | 341 + 111 + 89 + 191 LOC |
| Status | Imported by `bootstrap.py:238`, `run_backtest.py:36` | Active (Phase 9) |
| Risk | V1 configures dashboard data; may cause inconsistency | 🟠 |

### 3. SignalEngine (dual identity)

`core/signal/engine.py:21` is called both V1 and V2 in different imports. `bootstrap.py:390` imports it as `SignalEngineV2`. Possible confusion.

### 4. Discovery duplication
`core/strategy/engine.py:discover()` и `marketplace/registry.py:PackageIndexBuilder.build_index()` — **оба** независимо сканируют `strategies/*/manifest.yaml`. Отсутствие единого registry приводит к race condition при установке плагинов через CLI.

### Recommendation
- **Audit V1 consumers**: which code still reads V1 engine output?
- **Remove V1 imports** from bootstrap, run_backtest, smoke_test
- **Migrate last V1 consumers** to V2 API
- **Delete V1 modules** once migration confirmed
- **Объединить scanning** — marketplace registry как source of truth

---

## 🟡 Medium: Top-Level Legacy Modules — Deep Audit

Аудит всех 9 top-level директорий (22 файла проинспектировано).

### Статус-карта

| Directory | Files | Status | Used by | Core overlap |
|-----------|-------|--------|---------|-------------|
| `exchanges/` | 4 ✅ 1 impl | **ACTIVE** V1 | bootstrap, smoke_test | Нет — V1 WS-адаптеры vs `core/exchanges/` нормалайзеры |
| `events/` | 4 | **ACTIVE** | bootstrap (EventBus) | Нет — typed надстройка над MarketDataBus |
| `context/` | 2 🔥 | **ACTIVE** | bootstrap, все стратегии, backtest | Полностью зависит от `core.features.store`, `core.session` |
| `storage/` | 3 | **ACTIVE** | bootstrap (WinRateChecker, StatsReporter) | Нет — аналитика сигналов vs `core/storage/` (свечи/тикеры) |
| `scanner/` | 5 | **ACTIVE** | application (startup), smoke_test | V1 bridge от bus к `core.storage.*` |
| `screener_sdk/` | 1 | **ACTIVE** facade | Momentum strategy | 100% реэкспорт из `core.strategy.*` |
| `utils/` | 2 | **ACTIVE** | alerts/telegram | Нет — fmt utils + cooldown |
| `bot/` | 0 | **DEAD** ❌ | — | — |
| `dashboard/` | 0 | **DEAD** ❌ | — | — |

### Детали

#### `exchanges/`
- **Состав:** `__init__.py` (ExchangeBase ABC), `bybit/__init__.py` (V1 WS-адаптер, aiohttp → MarketDataBus), `binance/__init__.py` и `okx/__init__.py` — пустые заглушки
- **Используется:** `core/app/bootstrap.py:87`, `smoke_test.py:81`
- **Overlap с core:** Нет. `core/exchanges/` — нормалайзеры (Bybit/Binance/OKX/Deribit `*_norm.py`), не WS-адаптеры
- **Вывод:** V1 слой. Единственный реализованный адаптер — Bybit. Требует рефакторинга в core-архитектуру.

#### `context/`
- **Состав:** `market_context.py` (12.2 KB) — Level 3 реактивный контекст рынка
- **Используется:** `strategies/base.py:16`, `strategies/__init__.py:95`, `run_backtest.py:39`, `test_strategy.py:12` — **повсеместно, 🔥 самый завязанный легаси**
- **Overlap с core:** `core/strategy/context.py` — **разные сущности!** Стратегический контекст (signal/score) vs MarketContext (тренд, волатильность, сессия с TTL)
- **Вывод:** Ключевая абстракция для стратегий. Миграция в `core/context/` сломает все стратегии — нужен phased подход.

#### `storage/`
- **Состав:** `analytics.py` (11.2 KB) — SignalDB, SignalRecorder, WinRateChecker, StatsReporter
- **Используется:** `core/app/bootstrap.py:393`
- **Overlap с core:** Нет. `core/storage/` — свечи, стакан, тикеры, трейды, ликвидции, whale. Разные storages.
- **Вывод:** Актуально, служит для аналитики сигналов.

#### `scanner/`
- **Состав:** `__init__.py` (BaseScanner ABC), candles, orderbook, ticker, trades — 5 файлов
- **Используется:** `core/app/application.py:220-223` — старт всех сканеров при запуске приложения
- **Overlap с core:** V1 bridge от MarketDataBus к `core.storage.*` stores. Аналога нет.
- **Вывод:** Обязателен для работы приложения. V1-стиль.

#### `screener_sdk/`
- **Состав:** Один `__init__.py` — реэкспорт из `core.strategy.*` (BaseStrategy, StrategyContext, Signal, SignalBundle и т.д.)
- **Используется:** `strategies/Momentum/strategy.py:27`
- **Вывод:** ✅ Правильный public API фасад. Можно сохранить как есть.

#### `utils/`
- **Состав:** `__init__.py` (fmt_usdt, fmt_percent, SignalCooldown, now_ts), `logger.py` (colorlog)
- **Используется:** `alerts/telegram.py:19`
- **Вывод:** Небольшая самодостаточная библиотека. Миграция не требуется.

#### `bot/` и `dashboard/`
- **Вывод:** ❌ Пустые директории. Можно удалить без последствий.

---

## 🟡 Medium: Test Coverage Gaps

| Module | Test File | Status |
|--------|-----------|--------|
| `core/features/` | `tests/test_features.py` | **❌ MISSING** |
| `core/replay/` | `tests/test_replay.py` | ✅ 75 passed |
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

### 2. `core/di/providers.py` (19 строк) и `core/di.py` (12 строк)
- Только реэкспорт. Мёртвый код — bootstrap.py не использует.

### 3. `workspace/apps/plugins/` — no Python files
- Store app directory exists but empty. Needs wiring for Phase 15 Marketplace-store integration.

---

## Consolidated Action Priority

| Priority | Task | Effort | Target |
|----------|------|--------|--------|
| **P0** | Move V1 engine consumers to V2 (consensus, replay, signal) | 2–3h | RC1 |
| **P0** | Refactor StrategyEngine god-object (discovery + lifecycle + pipeline) | 3–4h | RC1 |
| **P1** | Add container parameter to `get_*()` — begin DI migration | 4–6h | RC1 |
| **P1** | Create `tests/test_features.py` | 2h | RC1 |
| **P1** | Объединить `discover()` с `PackageIndexBuilder` | 1h | RC1 |
| **P2** | Audit and clean `context/` migration path | 2h | RC2 |
| **P2** | Create `tests/test_di.py` | 1h | RC2 |
| **P2** | Remove `{exchanges` / `bot/` / `dashboard/` dead dirs | 0.3h | RC2 |
| **P3** | Clean up unused V1 modules after migration | 1h | RC2 |
| **P3** | Remove `core/legacy/` placeholder | 0.2h | RC2 |
| **P4** | Wire `workspace/apps/plugins/` to Marketplace | 2h | v1.0.0 |
