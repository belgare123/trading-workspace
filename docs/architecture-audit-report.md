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
| 🔴 Critical | 2 | God-object (StrategyEngine) + Discovery duplication |
| 🟠 High | 2 | DI singleton cascade + V1/V2 engine shadow duplication |
| 🟡 Medium | 2 | Legacy modules, test gaps |
| 🔵 Low | 1 | Dead dirs removed |

---

## Architecture Health Score

| Component | Size | Cohesion | Coupling | Dependencies | Health |
|-----------|------|----------|----------|-------------|--------|
| Strategy Engine | 🔴 | 🔴 | 🔴 | 🟡 | **3/10** |
| Decision Engine | 🟢 | 🟢 | 🟢 | 🟢 | **9/10** |
| Lifecycle | 🟢 | 🟢 | 🟢 | 🟢 | **10/10** |
| Replay | 🟢 | 🟢 | 🟢 | 🟢 | **9/10** |
| Marketplace | 🟢 | 🟢 | 🟢 | 🟢 | **9/10** |
| Learning | 🟡 | 🟢 | 🟢 | 🟢 | **8/10** |
| Features | 🟢 | 🟢 | 🟢 | 🟡 | **8/10** |
| Quality | 🟢 | 🟢 | 🟢 | 🟢 | **9/10** |
| Portfolio | 🟢 | 🟢 | 🟢 | 🟢 | **9/10** |
| Workspace API | 🟢 | 🟢 | 🟡 | 🟢 | **8/10** |

**Вывод:** Единственный компонент, критически выбивающийся — `core/strategy/engine.py`. Всё остальное ядро (Decision, Replay, Marketplace, Lifecycle) в хорошем состоянии и готово к v1.0.

---

## 🔴 Critical: God-Object в `core/strategy/engine.py`

**LOC:** 1,107 | **Классы:** 8+ (StrategyEngine, PipelineEngine, StrategyPipeline, _MockStrategyEngine и др.)

### Ответственности (7+)
1. **Plugin Discovery** — `discover_strategies()` читает manifest.yaml из `strategies/`
2. **Plugin Loading** — загрузка, enable, disable, remove
3. **Manifest Validation** — проверка структуры manifest.yaml
4. **Sandbox** — `_stage_import_strategy()` c monkey-patch sys.path
5. **Registration** — реестр загруженных стратегий
6. **Strategy Runtime** — итерация по стратегиям, сбор сигналов
7. **Pipeline Execution** — делегирование в PipelineEngine
8. **Health / Metrics** — timing, error tracking через `@measure_time`
9. **Mock Objects** — `_MockStrategyEngine`, `_MockFeatureEngine`

### Рекомендуемая декомпозиция

Предлагаемая структура:

```
core/strategy/
├── loader.py          # Только загрузка стратегий (discover + parse manifest)
├── registry.py        # Реестр загруженных стратегий
├── runtime.py         # Pipeline execution, итерация по стратегиям
├── health.py          # Health checks
├── metrics.py         # Benchmark + timing
├── manager.py         # Оркестратор (lifecycle координация)
└── engine.py          # Тонкий фасад (~150 строк)
```

**Engine не должен знать, как искать стратегии.** Он должен получать уже готовый список.

---

## 🔴 Critical: Discovery Duplication

**`core/strategy/engine.py:discover()`** и **`marketplace/registry.py:PackageIndexBuilder.build_index()`** независимо сканируют `strategies/*/manifest.yaml`.

### Проблема
- Нарушение **Single Source of Truth** — два независимых registry
- Race condition: CLI установил плагин через marketplace, но strategy engine его не видит
- Разные форматы возврата (PackageIndex vs list[StrategyDescriptor])

### Рекомендуемая архитектура

```
Marketplace
  ↓
Registry — единый реестр
  ↓
Discovery — поиск и парсинг manifest.yaml
  ↓
StrategyEngine — получает уже готовый список
```

---

## 🟠 High: DI Container vs Singleton Cascade

### Проблема
DI-контейнер (`core/di/container.py`) имеет **двойной registry**:
- `_registry[type]` — interface-based (никем не используется)
- `_components[name]` — строковый (используется bootstrap)

**15+ модулей** обходят контейнер через глобальные `get_*()` фабрики.

### Ключевой вопрос
**Есть ли хотя бы один реальный потребитель interface-based DI?**

Предварительный ответ: **нет**. `Container.register(IFeatureEngine, ...)` вызывается, но нигде не разрешается через `Container.resolve(IFeatureEngine)`. Весь код использует `container.get("feature_engine")` или `get_feature_engine()`.

### Рекомендация
1. Проверить: есть ли хоть один `resolve(InterfaceType)` вызов в коде?
2. Если нет — **удалить мёртвую абстракцию** (interface-based регистрацию)
3. Сфокусироваться на миграции `get_*()` → `container.get("name")`
4. **Не усложнять**: хороший DI — это используемый DI. Неиспользуемый интерфейс только усложняет архитектуру.

### Affected Modules (15+)
`core/consensus/engine.py` · `core/features/engine.py` · `core/features/store.py` · `core/signal/engine.py` · `core/signal_dna.py` · `core/market_replay.py` · `core/risk/engine.py` · `core/adaptive.py` · `core/cache.py` · `core/session.py` · `core/api.py` · `core/ome/engine.py` · `core/state/manager.py` · `core/dna/manager.py` · `core/strategy/engine.py`

---

## 🟠 High: V1/V2 Engine Shadow Duplication

### 1. ConsensusEngine (V1 vs V2)

| Aspect | V1 (`core/consensus/`) | V2 (`core/decision/consensus.py`) |
|--------|----------------------|-----------------------------------|
| Lines | ~500 LOC | ~150 LOC |
| Status | Still imported by bootstrap, run_backtest, smoke_test | Active pipeline |
| Risk | Both run in boot. V1 is shadow — results ignored? | 🟠 |

### 2. MarketReplay vs ReplayEngine

| Aspect | V1 (`core/market_replay.py`) | V2 (`core/replay/`) |
|--------|------------------------------|---------------------|
| Lines | 282 LOC | 341 + 111 + 89 + 191 LOC |
| Status | Imported by bootstrap, run_backtest | Active (Phase 9) |
| Risk | V1 configures dashboard data; may cause inconsistency | 🟠 |

### 3. SignalEngine (dual identity)
`core/signal/engine.py` импортируется как `SignalEngineV2` в bootstrap. V1 naming — источник путаницы.

### Recommendation
- Audit V1 consumers, remove V1 imports from bootstrap/backtest/smoke_test
- Delete V1 modules once migration confirmed

---

## 🟡 Medium: Top-Level Modules — Deep Audit

Аудит 9 top-level директорий (22 файла проинспектировано). Эти модули образуют **Engine Layer** — фундамент платформы:

```
Bybit WS → scanner → storage → events → Feature Engine → Decision
```

Их не стоит воспринимать как "отдельные модули скринера". Это скорее:

```
Market IO        — exchanges/ + scanner/
Market Storage   — storage/ + core/storage/
Market Context   — context/
Market Events    — events/
```

### Статус-карта

| Directory | Files | Status | Engine Layer | Used by |
|-----------|-------|--------|--------------|---------|
| `scanner/` | 5 | **ACTIVE** | Market IO (bridge) | application startup |
| `exchanges/` | 4 (1 impl) | **ACTIVE** V1 | Market IO (WS) | bootstrap, smoke_test |
| `storage/` | 3 | **ACTIVE** | Market Storage | bootstrap |
| `context/` 🔥 | 2 | **ACTIVE** | Market Context | все стратегии, backtest |
| `events/` | 4 | **ACTIVE** | Market Events | bootstrap |
| `screener_sdk/` | 1 | **FACADE** ✅ | Public API | Momentum strategy |
| `utils/` | 2 | **ACTIVE** | Utilities | alerts/telegram |
| `bot/` | 0 | ~~DEAD~~ **УДАЛЕНО** | — | — |
| `dashboard/` | 0 | ~~DEAD~~ **УДАЛЕНО** | — | — |

### `screener_sdk/` — оставить как есть
Фасад совместимости. Переименование в `trading_workspace_sdk` или `workspace_sdk` — только когда будет отдельный пакет на PyPI. Пока работает корректно.

### `context/` — отдельная заметка
`MarketContext` — Level 3 реактивный контекст (тренд, волатильность, сессия с TTL). **Не путать** с `core/strategy/context.py` (стратегический контекст signal/score). Разные сущности. Требует phased migration.

---

## 🟡 Medium: Test Coverage Gaps

| Module | Test File | Status |
|--------|-----------|--------|
| `core/features/` | `tests/test_features.py` | **❌ MISSING** |
| `core/di/` | `tests/test_di.py` | **❌ MISSING** |
| `core/replay/` | `tests/test_replay.py` | ✅ 75 passed |
| Все остальные | `tests/test_*.py` | ✅ |

### Impact
- FeatureEngine (самый производительно-критичный модуль) без тестов
- DI контейнер без тестов — усложняет миграцию

---

## 🔵 Low: Other Issues

| Issue | Status |
|-------|--------|
| `core/legacy/` — пустой плейсхолдер | Удалить или оставить — без разницы |
| `core/di/providers.py` (19 строк) + `core/di.py` (12 строк) — dead re-exports | Удалить после DI cleanup |
| `workspace/apps/plugins/` — пустая директория | Провести к Marketplace в v1.0 |

---

## Consolidated Action Priority

| Priority | Task | Effort | Target |
|----------|------|--------|--------|
| **🔴 P0** | **StrategyEngine — декомпозиция** (loader + registry + runtime + health + metrics + manager) | 3–4h | RC1 |
| **🔴 P0** | **Discovery — единый Registry** (marketplace → registry → strategy engine) | 1–2h | RC1 |
| **🔴 P0** | **V1 engine migration cleanup** (consensus, signal, market_replay → remove V1) | 2–3h | RC1 |
| 🟠 P1 | **DI cleanup** — либо реально использовать interface-based, либо удалить | 2h | RC1 |
| 🟠 P1 | `tests/test_features.py` — FeatureEngine smoke tests | 2h | RC1 |
| 🟠 P1 | `tests/test_di.py` — DI container tests | 1h | RC1 |
| 🟡 P2 | `context/` migration path audit | 2h | RC2 |
| 🟡 P2 | `workspace/apps/plugins/` — Market Store wiring | 2h | v1.0.0 |

---

**Главный вывод:** Самый большой технический долг сместился с V1→V2 миграции в `core/strategy/engine.py`. Это единственный компонент, выбивающийся из архитектуры. Если его декомпозировать, убрать дублирование Discovery и навести порядок с DI, ядро платформы станет значительно более согласованным. После этого — думать о v1.0.
