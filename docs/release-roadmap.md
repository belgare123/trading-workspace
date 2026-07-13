# v1.0 Roadmap — Platform Stabilization

**Project:** Trading Workspace Platform
**Current:** v0.15.0 | **Target:** v1.0.0
**Status:** ✅ Feature Freeze — no new functional phases until v1.0

---

## Состояние проекта

Проект прошёл 15 фаз функционального строительства. Фундамент платформы практически завершён:

| Компонент | Статус | Health |
|-----------|--------|--------|
| DI + Application Runtime | ✅ | 8/10 |
| Service Runtime | ✅ | 8/10 |
| Strategy SDK | ✅ | 8/10 |
| Plugin Platform | ✅ | 9/10 |
| **Strategy Engine** | 🔴 **God-object** | **3/10** |
| Decision Engine | ✅ | 9/10 |
| Opportunity Lifecycle | ✅ | 9/10 |
| Replay Framework | ✅ | 9/10 |
| Quality / Analytics | ✅ | 9/10 |
| Portfolio | ✅ | 9/10 |
| Learning | ✅ | 8/10 |
| Marketplace | ✅ | 9/10 |
| Workspace | ✅ | 8/10 |

**Вывод:** Единственный критический architectural debt — `core/strategy/engine.py`. Всё остальное ядро стабильно. Проект сопоставим по архитектуре с QuantConnect, NinjaTrader, Freqtrade — но уникален сочетанием Decision Engine + Opportunity Lifecycle + Deterministic Replay + Plugin Marketplace + Learning Pipeline в одной платформе.

---

## 🔴 P0 — До v1.0 обязательно

### 1. Разбить `core/strategy/engine.py` (god-object, 1107 строк, 7+ ответственностей)

Текущая структура — один файл с discovery, loading, manifest validation, sandbox, registration, runtime, health, metrics, mock objects.

**Целевая структура:**

```
core/strategy/
├── engine.py        # Тонкий фасад (~150 строк)
├── loader.py        # Загрузка стратегий (парсинг manifest.yaml, импорт)
├── registry.py      # Реестр загруженных стратегий
├── runner.py        # execute / analyze — pipeline execution
├── scheduler.py     # Запуск по расписанию (cron-like)
├── discovery.py     # Поиск стратегий (через Marketplace Registry)
├── lifecycle.py     # start / stop / reload
└── manager.py       # Оркестрация
```

**Критерий готовности:** `engine.py` < 200 строк, ни один модуль > 300 строк.

### 2. Единый Discovery через Marketplace Registry

Сейчас `StrategyEngine.discover()` и `Marketplace.PackageIndexBuilder.build_index()` независимо сканируют `strategies/*/manifest.yaml`.

**Целевая архитектура:**

```
Marketplace
  ↓ Registry — единый реестр пакетов
  ↓ Discovery (паттерн Strategy)
  ↓ StrategyEngine — получает готовый список
```

**Критерий готовности:** `StrategyEngine` не вызывает `discover()` — только `registry.list_strategies()`.

### 3. Удалить V1 legacy полностью

Цель: **legacy = 0**. Не депрекейтить, не оставлять compat bridge.

| Модуль | Что сделать |
|--------|------------|
| `core/consensus/` (V1, ~500 LOC) | Убедиться что V2 (`core/decision/consensus.py`) покрывает всех консьюмеров, удалить V1 |
| `core/market_replay.py` (V1, 282 LOC) | То же — проверить консьюмеров, удалить |
| `core/signal/` (V1 naming) | Переименовать import alias, убрать двойственность |
| `{exchanges` artifact | Уже удалён ✅ |
| `bot/`, `dashboard/` (dead dirs) | Уже удалены ✅ |

**Критерий готовности:** `git grep "from core.consensus\|from core.market_replay\|SignalEngineV1"` → 0 matches.

---

## 🟠 P1 — До v1.0 желательно

### 4. Capability Graph

Сейчас: `Strategy → FeatureEngine` (линейный pipeline).

Цель:
```
Strategy
  ↓ Capability Resolver (какие признаки нужны?)
  ↓ Capability Graph (DAG зависимостей)
  ↓ Feature Calculators
```

Что даёт:
- Автоматически считаются только нужные признаки
- Стратегии становятся декларативными (декларируют capability, не фичи)
- Появляется lazy execution + кэш + параллелизм
- FeatureEngine перестаёт вычислять всё подряд

### 5. Event Store (Event Sourcing)

Сейчас события живут в разных местах: `EventBus`, `ReplayBus`, `Lifecycle.events`, `Quality.journal`.

Цель:
```
Decision Event
  │
Lifecycle Event ─→ Event Store ←── Replay
  │                               (Replay = EventStore Reader)
Quality Event
  │
Learning Event
```

Что даёт:
- Replay перестаёт быть отдельной системой — становится `EventStore.read()`
- Полная traceability: любое решение можно воспроизвести
- Lifecycle, Quality, Learning — все пишут в один store
- Deterministic Replay из коробки (timestamp-based)

---

## 🟡 P2 — После v1.0

### Multi-Exchange
- Bybit, Binance, OKX, Deribit, Hyperliquid
- Только после стабилизации ядра — иначе tech debt вырастет экспоненциально

### Cloud Platform (Phase 15.5)
- Marketplace Cloud
- Managed strategies
- Отложено — сначала промышленное качество локальной платформы

### AI / ML
- Новые ML-модели
- AI-генерация стратегий
- Не сейчас — будет проще после чистого ядра

### Мобильное приложение
- Не сейчас

---

## Что НЕ входит в v1.0

❌ Новые ML-модели
❌ Новые стратегии
❌ Marketplace Cloud
❌ Multi-Exchange
❌ Мобильное приложение
❌ AI-генерация стратегий

---

## RC Process

### RC1 (v0.16.0-rc1)
**Entry:** P0 задачи завершены
- [ ] StrategyEngine decomposed
- [ ] Single Discovery via Marketplace Registry
- [ ] legacy = 0 (V1 modules removed)

**Also:**
- [ ] DI cleanup (remove dead interface-based registry)
- [ ] `tests/test_features.py`
- [ ] `tests/test_di.py`
- [ ] Full test suite green

### RC2 (v0.17.0-rc2)
**Entry:** RC1 стабилен 1+ недели
- [ ] P1 задачи завершены (Capability Graph, Event Store)
- [ ] Регрессия производительности < 5%
- [ ] UAT пройден

### v1.0.0
**Entry:** RC2 стабилен 2+ недели
- [ ] Feature complete per this roadmap
- [ ] Docs updated
- [ ] Performance targets met
- [ ] Release notes written
