# Roadmap — Trading Workspace Platform

> **Current:** v0.15.0 (Stabilisation)
> **Next:** v0.16.x — Release Candidate Cycle → **v1.0**
> **Status:** ✅ API Frozen — no breaking changes without RFC

---

## Этап 1: v0.16.x — Release Candidate Cycle

Перед v1.0 — цикл подготовки, фиксирующий качество и документирующий платформу.

### 1.1 API Freeze ✅

С этого момента **Public API frozen**:

| Domain | Scope | Status |
|--------|-------|--------|
| `core` | Все публичные символы (EventStore, PluginRegistry, Engine, Lifecycle, DI) | ✅ |
| `workspace` | FastAPI роуты, WebSocket, HTTP API | ✅ |
| `screener_sdk` | BaseStrategy, Plugin SDK | ✅ |
| `marketplace` | Registry, Package Manager, CLI | ✅ |

Изменения API — только через RFC или с веской причиной.

### 1.2 Performance Baseline

Зафиксировать метрики для регрессии в будущих версиях:

| Метрика | Инструмент | Цель |
|---------|-----------|------|
| Event append | `test_event_store_concurrency.py` | `events/sec` |
| Replay throughput | `test_replay_stress.py` | `events/sec` |
| Aggregate restore | `test_aggregate.py` | `ms` |
| Trace build | `test_trace.py` | `ms` |
| Concurrent reads | `test_event_store_concurrency.py` | `reads/sec` |
| Startup time | `pytest --durations=0` | `sec` |
| Memory footprint | `tracemalloc` / `memory_profiler` | `MB` |

✅ **Concurrency & Replay stress tests уже написаны.**

### 1.3 Архитектурная документация

| Документ | Статус |
|----------|--------|
| **Architecture Guide** | ✅ существует (`docs/architecture-guide.md`) |
| **Event Store Guide** | 📝 нужно выделить из architecture-guide |
| **Plugin SDK Guide** | ✅ `docs/plugin-guide.md` |
| **Marketplace Package Spec** | 📝 нужно дополнить |
| **Workspace Integration Guide** | 📝 нужно создать |
| **Developer Guide** | ✅ `docs/developer-guide.md` |
| **API Reference** | ✅ `docs/api-reference.md` |
| **Extension Guide** | ✅ `docs/extension-guide.md` |
| **Sequence Diagrams** | ✅ `docs/sequence-diagrams.md` |

### 1.4 Демо-проекты

| Пример | Статус |
|--------|--------|
| Простая стратегия | 📝 `examples/basic_strategy/run.py` — существует, проверить |
| Стратегия с кастомными capability | ❌ |
| Replay demo | ✅ `examples/replay_demo/run.py` |
| EventStore Trace demo | ❌ |
| Marketplace-пакет | ❌ |

---

## Этап 2: v1.0

**Entry criteria:**
- [ ] API frozen ✅
- [ ] Performance Baseline измерен
- [ ] Архитектурная документация полная
- [ ] Демо-проекты готовы
- [ ] Архитектура стабильна
- [ ] 950+ тестов зелёных ✅
- [ ] CHANGELOG актуален ✅

После v1.0 — никаких изменений фундаментальной архитектуры.
Версия, на которую можно опираться несколько лет.

---

## Этап 3: v1.1 — Multi-Exchange Runtime

Архитектура уже построена вокруг: Strategy, Feature, Decision, Lifecycle.
Нужен ещё один уровень абстракции — **ExchangeRuntime**:

```
ExchangeRuntime
  ├── Binance
  ├── Bybit
  ├── OKX
  ├── Coinbase
  └── Kraken
```

Хорошо ложится в существующую Plugin Platform.

---

## Этап 4: v1.2 — Cloud Platform

- Синхронизация
- Marketplace Cloud
- Публикация стратегий
- Резервные копии
- Удалённый Replay

---

## Этап 5: v1.3 — Ecosystem

- Официальный Marketplace
- Рейтинги и benchmark
- Сертификация
- Community

---

## Этап 6: v2.0 — Simulation Lab

Качественно новый уровень:

- Многолетние симуляции
- Monte Carlo
- Walk-forward
- Portfolio Simulation
- Parameter Optimization
- Распределённые вычисления

---

## История версий

| Версия | Дата | Что |
|--------|------|-----|
| v0.5.0 | — | Initial |
| v0.6.0 | — | Replay, Quality, Analytics |
| v0.14.0 | 2026-07-13 | Event Store, Aggregate Streams |
| **v0.15.0** | **2026-07-14** | **Stabilisation — API audit, boundaries, hardening** |
