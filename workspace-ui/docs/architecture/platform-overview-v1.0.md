# Platform Overview v1.0

> **Дата:** 2026-07-16
> **Commit:** `cde7df9` (develop/runtime-api)
> **Статус:** Platform v1.0 — архитектурное ядро завершено

---

## 1. Карта платформы

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCT LAYER                             │
│  (Live Trading · Replay · Screener · Portfolio · Alerts     │
│   Scanner · Journal · Risk Dashboard · AI Assistant)         │
│  ─── строится поверх Platform API, не требует изменения ядра │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              WORKSPACE PLATFORM                              │
│  WorkspaceSession · WorkspaceSerializer · LayoutEngine       │
│  PanelRegistry · WidgetRegistry · Integration Layer          │
│  ─── объединяет подсистемы, управляет сессией пользователя   │
├─────────────────┬─────────────────┬────────────────────────┤
│  Chart Studio   │ Strategy Studio │ Visual Strategy Builder │
│  v1.0 (Frozen)  │ v1.0 (Frozen)   │ v1.0 (Frozen)           │
│                 │                 │                         │
│  ChartHost      │ GraphRuntime    │ CanvasManager           │
│  ChartRuntime   │ SignalRuntime   │ GraphEditorRuntime      │
│  IndicatorHost  │ ConditionEngine │ Palette · NodeFactory   │
│  OverlayEngine  │ ActionEngine    │ BuilderShellRuntime     │
│  DrawingManager │ StrategyGraph   │                         │
└────────┬────────┴────────┬───────┴─────────┬───────────────┘
         │                 │                  │
┌────────▼─────────────────▼──────────────────▼───────────────┐
│              EXECUTION PLATFORM                              │
│  ExecutionRuntime · MetricsRuntime · BacktestRuntime         │
│  OptimizationRuntime · ReportRuntime                         │
│  ─── изолированные вычислительные Runtime'ы                  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    RUNTIME KERNEL                            │
│  PanelRuntime · WidgetRuntime · LayoutEngine                 │
│  CompositeRuntime · Lifecycle Hooks                          │
│  ─── фундамент, на котором держатся все подсистемы           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Зависимости между подсистемами

### Правило зависимостей

```
Runtime Kernel ← Workspace Platform ← Chart / Strategy / Builder
                                           ↕ (через публичные API)
                                     Execution Platform
```

- **Runtime Kernel** — не зависит ни от чего
- **Workspace Platform** — зависит только от Runtime Kernel
- **Chart / Strategy / Builder** — зависят от Runtime Kernel, используют Workspace для интеграции
- **Execution Platform** — вызывается через публичные API, не зависит от UI

### Запрещённые зависимости

| Зависимость | Статус |
|------------|--------|
| Runtime ↔ Runtime (прямая) | ❌ Всегда через Registry / публичные API |
| UI → Business Logic (кроме вызова API) | ❌ UI не владеет состоянием |
| Builder → собственный Runtime | ❌ Использует GraphRuntime из Strategy Studio |
| Frozen Module → изменён | ❌ Только аддитивные изменения |

### Разрешённые зависимости через Registry

```
[Definition] → Registry.register() → Palette → Builder → Graph → Runtime
```

- IndicatorDefinition → IndicatorRegistry → IndicatorPalette → Builder → StrategyGraph → Runtime
- SignalDefinition → SignalRegistry → NodePalette → Builder → StrategyGraph → Runtime
- ConditionDefinition → ConditionRegistry → NodePalette → Builder → StrategyGraph → Runtime
- ActionDefinition → ActionRegistry → NodePalette → Builder → StrategyGraph → Runtime
- OverlayDefinition → OverlayRegistry → OverlayPalette → Builder → Chart → Runtime
- DrawingDefinition → DrawingRegistry → DrawingPalette → Builder → Chart → Runtime

---

## 3. Data Flow (жизненный цикл данных)

### Поток создания стратегии (пользовательский)

```
Market Data
    │
    ▼
Chart (визуализация) ─── Overlay, Indicator, Drawing
    │
    ▼
Visual Strategy Builder
    │  Node Palette (Signal, Condition, Action)
    │  Canvas → Graph Editor
    │
    ▼
StrategyGraph (JSON) ─── Единственный источник истины
    │
    ├──► GraphRuntime.execute()
    │       │
    │       ▼
    │   SignalRuntime ─── ConditionEngine ─── ActionEngine
    │
    ├──► BacktestRuntime.run(graph)
    │       │
    │       ▼
    │   MetricsRuntime.evaluate()
    │       │
    │       ▼
    │   ReportRuntime.generate()
    │
    └──► OptimizationRuntime.optimize(graph, params)
            │
            ▼
        MetricsRuntime.evaluate()
            │
            ▼
        ReportRuntime.generate()
```

### Поток персистентности

```
WorkspaceSession
    │
    ├── serialize() → JSON → export / save / share
    │
    └── deserialize() ← JSON ← import / load / restore
            │
            ▼
        WorkspaceMigration (version gate)
            │
            ▼
        WorkspaceSync.apply() → LayoutEngine + PanelRuntime
```

### Поток AI-генерации (будущее)

```
Natural Language Prompt
    │
    ▼
AI Strategy Generator
    │
    ▼
StrategyGraph (JSON)
    │
    ├──► Visual Strategy Builder (редактирование)
    ├──► BacktestRuntime.run(graph)
    └──► OptimizationRuntime.optimize(graph)
            │
            ▼
        Report → AI Analysis → Suggestions
```

---

## 4. Frozen API (публичные контракты)

### Chart Studio v1.0

| Компонент | Публичный API |
|-----------|--------------|
| `IChartRuntime` | `createChart()`, `destroyChart()`, `setSymbol()`, `setTimeframe()`, `addIndicator()`, `removeIndicator()`, `addOverlay()`, `removeOverlay()`, `addDrawing()`, `removeDrawing()` |
| `IndicatorRegistry` | `register(id, factory)`, `unregister(id)`, `get(id)`, `list()`, `has(id)`, `clear()` |
| `OverlayRegistry` | `register(id, factory)`, `unregister(id)`, `get(id)`, `list()` |
| `DrawingRegistry` | `register(id, factory)`, `unregister(id)`, `get(id)`, `list()` |

### Strategy Studio v1.0

| Компонент | Публичный API |
|-----------|--------------|
| `IGraphRuntime` | `execute(graph)`, `stop()`, `getState()`, `on('signal', cb)`, `on('condition', cb)`, `on('action', cb)` |
| `SignalRegistry` | `register(def)`, `unregister(id)`, `get(id)`, `list()`, `create(id, params)` |
| `ConditionRegistry` | `register(def)`, `unregister(id)`, `get(id)`, `list()`, `create(id, params)` |
| `ActionRegistry` | `register(def)`, `unregister(id)`, `get(id)`, `list()`, `create(id, params)` |
| `StrategyGraph` | `addNode(definition)`, `removeNode(id)`, `addEdge(source, target)`, `removeEdge(id)`, `toJSON()`, `fromJSON(json)` |

### Visual Strategy Builder v1.0

| Компонент | Публичный API |
|-----------|--------------|
| `ICanvasManager` | `addNode(def)`, `removeNode(id)`, `connect(source, target)`, `disconnect(edgeId)`, `serialize()`, `deserialize(json)` |
| `NodePalette` | `getCategories()`, `getNodesByCategory(cat)`, `search(query)`, `dragStart(def)`, `drop(x, y)` |
| `BuilderShellRuntime` | `startEditing(graph?)`, `finishEditing()`, `getGraph()`, `setPaletteFilter(filter)` |

### Execution Platform

| Компонент | Публичный API |
|-----------|--------------|
| `IExecutionRuntime` | `executeOrder(order)`, `cancelOrder(id)`, `getPosition(symbol)`, `getOrders(filter)`, `on('fill', cb)` |
| `IMetricsRuntime` | `evaluate(results)`, `getMetric(name)`, `listMetrics()`, `registerMetric(def)` |
| `IBacktestRuntime` | `run(graph, options)`, `stop()`, `getSession(id)`, `listSessions()`, `on('progress', cb)` |
| `IOptimizationRuntime` | `optimize(graph, params, ranges)`, `stop()`, `getResults()`, `getBestParams()` |
| `IReportRuntime` | `generate(sessionId)`, `getSections()`, `addSection(def)`, `export(format)` |

---

## 5. Точки расширения (Registries)

### Зарегистрированные расширения

| Registry | Тип | Расширяемость |
|----------|-----|--------------|
| `IndicatorRegistry` | IndicatorDefinition | ✅ Открыт (Marketplace) |
| `SignalRegistry` | NodeDefinition | ✅ Открыт (Marketplace) |
| `ConditionRegistry` | NodeDefinition | ✅ Открыт (Marketplace) |
| `ActionRegistry` | NodeDefinition | ✅ Открыт (Marketplace) |
| `OverlayRegistry` | OverlayDefinition | ✅ Открыт (Marketplace) |
| `DrawingRegistry` | DrawingDefinition | ✅ Открыт (Marketplace) |
| `PanelRegistry` | PanelDefinition | ✅ Открыт |
| `WidgetRegistry` | WidgetDefinition | ✅ Открыт |
| `MetricsRegistry` | MetricDefinition | ✅ Открыт |

### Цикл расширения (Universal Extension Pattern)

```
Definition → Registry.register() → Palette → Builder → Graph → Runtime → Execution
```

1. **Definition** — контракт расширения (интерфейс)
2. **Registry.register()** — регистрация в платформе
3. **Palette** — автоматическое появление в UI
4. **Builder** — перетаскивание на канвас
5. **Graph** — сериализация в StrategyGraph
6. **Runtime** — исполнение через GraphRuntime
7. **Execution** — backtest/optimization/metrics

---

## 6. Рекомендации для разработчиков

### Добавление нового продукта (Product Layer)

```typescript
// 1. Определить PanelDefinition
import type { PanelDefinition } from '@workspace/panel-registry'

const screenerPanel: PanelDefinition = {
  id: 'screener',
  title: 'Screener',
  defaultSize: { width: 12, height: 6 },
  component: ScreenerPanel,
  runtime: ScreenerRuntime,
}

// 2. Зарегистрировать в Workspace
PanelRegistry.register(screenerPanel)

// 3. Пользователь открывает через LayoutEngine
LayoutEngine.addPanel('screener')
```

**Никаких изменений в ядре.** Продукт — это PanelDefinition + React-компонент + опциональный Runtime.

### Добавление нового индикатора (Marketplace Extension)

```typescript
// 1. Определить IndicatorDefinition
const vwapIndicator: IndicatorDefinition = {
  id: 'vwap',
  name: 'VWAP',
  category: 'volume',
  defaults: { anchor: 'session' },
  calculate: (bars, params) => { /* ... */ },
}

// 2. Зарегистрировать
IndicatorRegistry.register(vwapIndicator)

// 3. Автоматически появляется в Palette → Builder → Chart
```

**Никаких изменений в Chart Studio.** Индикатор — это Definition + calculate().

### Добавление новой стратегии (Strategy Development)

```typescript
// 1. Через Builder (визуально)
// 2. Или программно:
const graph = StrategyGraph.fromJSON({
  nodes: [
    { id: 's1', type: 'signal', definitionId: 'ema-crossover', params: { fast: 9, slow: 21 } },
    { id: 'a1', type: 'action', definitionId: 'market-order', params: { size: 0.01 } },
  ],
  edges: [{ id: 'e1', sourceId: 's1', targetId: 'a1' }],
})

// 3. Запуск
BacktestRuntime.run(graph)
```

**Никаких изменений в Strategy Studio.** Стратегия — это JSON-граф.

### Запуск нового продукта

```typescript
// 1. Создать WorkspaceSession с layout
const session = createBlankSession(layout)

// 2. Запустить Workspace
WorkspaceComposition.initAll()

// 3. Продукт — панель в layout
LayoutEngine.addPanel('screener')
```

**Workspace — единственная точка входа.** Продукт не требует init-функций.

---

## 7. Ключевые ограничения (Platform Change Rule)

| Правило | Описание |
|---------|----------|
| **Frozen API** | Изменения Chart/Strategy/Builder Runtime — только в следующей major-версии |
| **Registries** | Новые расширения добавляются через `Registry.register()`, не через импорт в ядро |
| **UI ↔ Runtime** | UI вызывает Runtime только через публичные API. Runtime не знает о React |
| **StrategyGraph** | Единственный source of truth. Builder и Strategy Runtime работают с одной структурой |
| **Workspace Session** | Вся пользовательская сессия сохраняется и восстанавливается единым snapshot'ом |
| **Panel → Runtime** | Одна панель = один Runtime. Нет shared mutable state между Runtime'ами |
| **No runtime-to-runtime** | Runtime'ы взаимодействуют через WorkspaceSync, не напрямую |

---

## 8. Матрица зрелости

| Критерий | Уровень |
|----------|---------|
| Публичные контракты зафиксированы | ✅ v1.0 |
| Расширение через Definition → Registry → Runtime | ✅ Universal Extension Pattern |
| Workspace объединяет подсистемы | ✅ Integration Layer |
| Validation Sprint подтвердил инварианты | ✅ 18/18 тестов |
| Marketplace (Plugin System) | 🚧 Sprint 3.7.4 |
| AI Assistant | 🚧 План |
| Collaboration | 🚧 План |
| Live Trading | 🚧 План |
| Документация для сторонних разработчиков | 📝 Этот документ |

---

## 9. Что дальше

Приоритеты развития после Platform v1.0 (по оценке пользователя):

| ⭐ | Направление | Обоснование |
|---|-------------|-------------|
| ⭐⭐⭐⭐⭐ | **Product Layer** | Live Trading, Replay, Screener, Portfolio, Alerts, Scanner, Journal, Risk Dashboard |
| ⭐⭐⭐⭐⭐ | **AI Layer** | Natural Language → Strategy Graph, Report → AI Analysis, Auto Optimization |
| ⭐⭐⭐⭐ | **Marketplace** | Indicator/Signal/Condition/Action/Overlay/Drawing/Template Marketplace |
| ⭐⭐⭐ | **Collaboration** | Cloud Session, Shared Workspace, Live Collaboration, Comments, Version History |

### Ключевой принцип на будущее

> Если появляется мысль «Давайте ещё один Runtime», сначала задать вопрос:
> *Это действительно новый платформенный слой, или это можно реализовать как расширение существующего API?*
