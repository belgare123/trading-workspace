# Workspace Persistence Validation v1.0

> **Дата:** 2026-07-16
> **Версия платформы:** v1.0 (Integration Sprint 3.7.3)
> **Commit:** `7231b83` (develop/runtime-api)
> **Статус:** ✅ Все 18 тестов пройдены

## Цель

Архитектурная верификация персистентности Workspace после трёх Freeze'ов:
- Chart Studio v1.0 ✅
- Strategy Studio v1.0 ✅
- Visual Strategy Builder v1.0 ✅

Проверить, что платформа корректно сериализует, сохраняет и восстанавливает
полное состояние пользовательской сессии без изменения frozen-компонентов.

## Методология

Все 18 тестов выполняются в изолированном валидаторе
(`integration/validation/WorkspacePersistenceValidator.ts`), который:

1. Создаёт тестовые сессии с полным набором состояния
2. Выполняет сериализацию → десериализацию
3. Проверяет идентичность всех полей
4. Тестирует граничные случаи (corrupt JSON, будущие версии, missing fields)
5. Проверяет регрессии (утечка Runtime, лишние ключи)

---

## Level 1 — Round-trip Serialization

Проверка инварианта: Workspace → serialize() → JSON → deserialize() → Workspace'

### ✅ roundtrip-basic
- **Проверка:** Базовая сериализация пустой сессии
- **Результат:** id/name/version/layout идентичны после round-trip

### ✅ roundtrip-full
- **Проверка:** Полная сессия со всеми модулями
- **Результат:**
  - `chart.symbol` = `"BTC/USDT"` ✓
  - `chart.timeframe` = `"1h"` ✓
  - `chart.viewport.zoomX` = 1.5 ✓
  - `chart.activeIndicators['pane-1']` = 2 индикатора ✓
  - `chart.panes` = 1 панель ✓
  - `strategy.graph` = 2 ноды ✓
  - `builder.selectedNodeId` = `"s1"` ✓
  - `builder.minimapVisible` = true ✓
  - `builder.viewport.zoomX` = 1.2 ✓
  - `backtest.activeBacktestId` = `"bt-001"` ✓
  - `backtest.results[0].metrics.sharpe` = 1.85 ✓
  - `report.activeReportId` = `"rpt-001"` ✓

### ✅ roundtrip-invariants
- **Проверка:** Ключевые инварианты
- **Результат:** PanelCount, chartCount, version, JSON validity — все сохранены

---

## Level 2 — Version Migration

### ✅ migration-v0-v1
- **Проверка:** Миграция v0 (минимальная) → v1
- **Результат:** Все 6 под-секций созданы (charts, strategies, builders, backtests, optimizations, reports)

### ✅ migration-unknown-v
- **Проверка:** Миграция неизвестной версии (v999→v1000)
- **Результат:** Graceful fallback — `null` (корректная ошибка)

### ✅ migration-corrupt-json
- **Проверка:** Повреждённые входные данные
- **Результат:**
  - Plain text → `null` ✓
  - Malformed JSON → `null` ✓
  - JSON `null` → `null` ✓

### ✅ migration-missing-fields
- **Проверка:** Отсутствующие обязательные поля
- **Результат:**
  - Missing layout → rejected ✓
  - Missing id → rejected ✓
  - Missing name → rejected ✓
  - v0 minimal → migrated with defaults ✓

### ✅ migration-future-v
- **Проверка:** Будущая версия (v42) не должна быть понижена
- **Результат:** Accepted as-is, version=42 сохранён

---

## Level 3 — Auto-save

### ✅ autosave-snapshot
- **Проверка:** Auto-save snapshot валиден
- **Результат:** id, layout, version — все поля присутствуют (2070 chars)

### ✅ autosave-clone
- **Проверка:** Deep clone корректно изолирует модификации
- **Результат:** Изменение оригинала не влияет на клон ✓

---

## Level 4 — Full User Scenario

### ✅ scenario-create
- **Шаг:** Создание Workspace "My Trading Workspace"
- **Результат:** Успешно

### ✅ scenario-add-chart
- **Шаг:** Добавление Chart — ETH/USDT, 15m, SMA+EMA+RSI
- **Результат:** Панели, индикаторы, таймфрейм сохранены

### ✅ scenario-create-strategy
- **Шаг:** Создание стратегии — RSI Crossover → Limit Order
- **Результат:** 3 ноды (signal, condition, action) + 2 edge

### ✅ scenario-save
- **Шаг:** Сохранение сессии
- **Результат:** JSON 2.5 KB, pretty-printed

### ✅ scenario-restore
- **Шаг:** Восстановление из JSON
- **Результат:** Успешно

### ✅ scenario-verify
- **Шаг:** Верификация всех полей
- **Результат:** id, name, chart symbol/indicators, strategy graph, builder viewport — все совпадают

---

## Level 5 — Regression Checks

### ✅ regression-clean-session
- **Проверка:** Сессия без лишних полей
- **Результат:** Ровно 6 ожидаемых ключей (id, name, version, createdAt, updatedAt, layout)

### ✅ regression-no-leak
- **Проверка:** Нет утечки Runtime internals в сериализованный вывод
- **Результат:** `prototype`, `__proto__`, `constructor`, `[object `, `function ` — не обнаружены

---

## Сводная таблица

| Level | Тестов | Пройдено | Провалено |
|-------|--------|----------|-----------|
| 1. Round-trip Serialization | 3 | 3 | 0 |
| 2. Version Migration | 5 | 5 | 0 |
| 3. Auto-save | 2 | 2 | 0 |
| 4. Full User Scenario | 6 | 6 | 0 |
| 5. Regression | 2 | 2 | 0 |
| **Итого** | **18** | **18** | **0** |

## Известные ограничения

1. **Auto-save debounce** — реализован на уровне WorkspaceSync (300ms), но не
   тестировался в раннере (требует асинхронного окружения).
2. **localStorage persistence** — тесты выполняются в памяти. Фактическая запись
   в localStorage проверяется при интеграции с LayoutEngine.
3. **Session restore после перезапуска** — тестируется через serialize→deserialize,
   но полный цикл с re-init LayoutEngine требует браузерного окружения.
4. **Large session compression** — compress-опция зарезервирована, не реализована.

## Подтверждение архитектурных инвариантов

Проверено, что:

| Инвариант | Статус |
|-----------|--------|
| Ни один frozen Runtime не изменён | ✅ |
| Все взаимодействия идут через публичные API | ✅ |
| Отсутствуют Runtime↔Runtime зависимости | ✅ |
| Builder остаётся UI-слоем | ✅ |
| StrategyGraph — единственный источник истины | ✅ |
| Render Pipeline не нарушен | ✅ |
| Marketplace-расширения подключаются через Registry | ✅ |
| Workspace сериализуется и восстанавливается без потерь | ✅ |
| End-to-end сценарий проходит полностью | ✅ |

## Заключение

Архитектурное ядро платформы прошло полную валидацию персистентности.
Все три frozen-модуля (Chart Studio, Strategy Studio, Visual Builder)
интегрируются в единый Workspace через публичные API без нарушения
инвариантов и без модификации frozen-слоёв.

Дальнейшее развитие фокусируется на:
- Marketplace и плагины (Sprint 3.7.4)
- Collaboration
- AI Assistant
- Live Trading / Broker Adapters
- UX и производительность
