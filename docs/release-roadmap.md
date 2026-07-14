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

### 1.2 Performance Baseline ✅

Зафиксировать метрики для регрессии в будущих версиях:

| Метрика | Инструмент | Значение |
|---------|-----------|----------|
| Event append | `scripts/performance_baseline.py` | ~2,665 events/s |
| Concurrent batch (×100) | `scripts/performance_baseline.py` | ~25,563 events/s |
| Replay throughput (×1000) | `scripts/performance_baseline.py` | ~2,118 events/s |
| Aggregate restore (50 ev) | `scripts/performance_baseline.py` | ~1,567 ops/s |
| Trace build (50 ev) | `scripts/performance_baseline.py` | ~1,624 ops/s |

### 1.3 Архитектурная документация ✅

| Документ | Статус |
|----------|--------|
| **Architecture Guide** | ✅ `docs/architecture-guide.md` |
| **Event Store Guide** | ✅ `docs/event-store-guide.md` |
| **Plugin SDK Guide** | ✅ `docs/plugin-guide.md` |
| **Developer Guide** | ✅ `docs/developer-guide.md` |
| **API Reference** | ✅ `docs/api-reference.md` |
| **Extension Guide** | ✅ `docs/extension-guide.md` |
| **Sequence Diagrams** | ✅ `docs/sequence-diagrams.md` |

### 1.4 Демо-проекты ✅

| Пример | Статус |
|--------|--------|
| Basic strategy | ✅ `examples/basic_strategy/run.py` |
| Advanced strategy | ✅ `examples/advanced_strategy/run.py` |
| Decision demo | ✅ `examples/decision_demo/run.py` |
| Replay demo | ✅ `examples/replay_demo/run.py` |
| Learning demo | ✅ `examples/learning_demo/run.py` |
| Marketplace demo | ✅ `examples/marketplace_demo/run.py` |
| EventStore Trace demo | ✅ `examples/trace_demo/run.py` |

### 1.5 RC Validation — эксплуатация и аудит

Перед v1.0 — неделя реальной эксплуатации и аудитов:

**Long-running stress** (12h)
```
Scanner → Decision → Lifecycle → Event Store → Replay → Learning
```
Проверить: memory leak, WAL checkpoint, append speed degradation, snapshot size.

**API Audit** — обход публичных модулей:
- `core/`, `workspace/`, `marketplace/`, `screener_sdk/`
- Лишние методы
- Разные названия для одного
- Два способа сделать одно
- Внутренние классы в `__all__`

**Import Audit** — `python -X importtime`:
- Какие импорты тянут пол-приложения
- Время загрузки SDK

**Packaging Audit** — установка "с нуля":
```
pip install .
tw --help
workspace
examples
```

**Event Store Validation**:
- Миллионы событий
- WAL checkpoint / VACUUM
- Восстановление после аварийного завершения
- Повреждённая SQLite / rollback

---

## Этап 2: v1.0

**Entry criteria:**
- [x] API Frozen
- [x] Performance Baseline измерен
- [x] Архитектурная документация полная
- [x] Демо-проекты готовы
- [x] 953+ тестов зелёных
- [x] CHANGELOG актуален
- [ ] RC validation пройдена (long-running, API audit, import audit, packaging audit, event store validation)

После v1.0 — **никаких изменений фундаментальной архитектуры**.

### v1.0.1 — Bugfix Release

Первый bugfix после v1.0. Без новых возможностей — только исправления по отзывам пользователей RC и первых дней v1.0.

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
