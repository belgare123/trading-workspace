# Chart Studio Constitution v1.0

> Дата: 2026-07-16
> Версия: v1.0
> Область применения: Chart Studio (`src/workspace/chart/`)
> Проект: Trading Platform
> Статус: Утверждена (вступает в силу после Sprint 3.3.8)

---

## 1. Purpose

Chart Studio — подсистема визуализации рыночных данных, индикаторов, графических объектов, торговых оверлеев и пользовательского взаимодействия на платформе Trading Platform. Настоящая конституция фиксирует публичный API, архитектурные границы, ownership и правила расширения Chart Studio.

Конституция вступает в силу **полностью** после завершения Sprint 3.3.8 (Trading Overlay Pack). До этого момента допускаются изменения, необходимые для завершения указанного спринта, при условии что они не нарушают дух зафиксированных здесь инвариантов.

---

## 2. Public API (Frozen)

Публичная поверхность Chart Studio. Все внешние клиенты (Workspace, Dashboard, Layout Engine) взаимодействуют с Chart Studio **только** через этот API. Любое изменение требует новой major-версии контракта.

```typescript
export const CHART_STUDIO_API = {
  /** Core lifecycle — React host, canvas init, render loop */
  runtime: 'ChartRuntime',

  /** Multi-pane composition — pane layout + rendering orchestration */
  composition: 'CompositionRuntime',

  /** Shared state across panes/charts — viewport, timeScale, crosshair */
  synchronization: 'SynchronizationRuntime',

  /** Registries (singletons, shared across all chart instances) */
  registries: [
    'IndicatorRegistry',
    'DrawingRegistry',
    'OverlayRegistry',
    'PaneRegistry',
  ] as const,

  /** Runtimes (per-chart instances) */
  runtimes: [
    'IndicatorRuntime',
    'DrawingRuntime',
    'OverlayRuntime',
    'InteractionRuntime',
    'PaneRuntime',
  ] as const,
} as const
```

### 2.1. Семантические типы

```typescript
/** Категория оверлея — семантика, а не расположение в файловой системе */
type OverlayCategory =
  | 'price'
  | 'trade'
  | 'execution'
  | 'position'
  | 'volume'
  | 'session'
  | 'event'
  | 'annotation'
  | 'custom'

/** Возможности оверлея */
interface OverlayCapabilities {
  /** Может быть выделен (например, для удаления) */
  selectable: boolean
  /** Подсвечивается при наведении */
  hoverable: boolean
  /** Поддерживает клик/взаимодействие */
  interactive: boolean
  /** Сохраняется между сессиями (drawing-like) */
  persistent: boolean
  /** Виден в режиме Replay */
  replayVisible: boolean
}
```

---

## 3. Ownership Matrix

| Компонент | Владеет |
|-----------|---------|
| `ChartRuntime` | lifecycle: React host, canvas, RenderLoop init, cleanup |
| `CompositionRuntime` | panes: PaneRuntime lifecycle + PaneLayout compute + PaneRenderer orchestration |
| `SynchronizationRuntime` | shared viewport, TimeScale, CrosshairSync, PriceScaleManager |
| `PaneRuntime` | pane model: add/remove/reorder/resize/hide/show |
| `PaneLayout` | vertical geometry: compute pane positions from layout config |
| `PaneRenderer` | render orchestration: единственный CanvasLayer, dispatch к sub-renderers |
| `IndicatorRuntime` | indicator instances: add/remove/toggle/recompute |
| `IndicatorRenderer` | rendering of all indicator lines from IndicatorRuntime.getActive() |
| `DrawingRuntime` | drawing instances: add/remove/update/serialize |
| `DrawingRenderer` | rendering of all drawing instances from DrawingRuntime.getVisible() |
| `OverlayRuntime` | overlay instances: add/remove/replaceType/clearByType/getVisible |
| `OverlayRenderer` | rendering of all overlay instances from OverlayRuntime.getVisible() |
| `InteractionRuntime` | pointer routing, hit-test, selection, drag, resize, tool controller, cursor |
| `ChartViewport` | coordinate transforms: time↔pixel, price↔pixel, pan offset, zoom |
| `TimeScale` | time axis: tick computation, formatting, visible range |
| `PriceScale` | price axis: tick computation, formatting, fixed range |

При code review любой вопрос разрешается через: **«Кто этим владеет?»**

---

## 4. Runtime Architecture

```
ChartRuntime
    │
    ├── CompositionRuntime
    │       ├── PaneRuntime
    │       ├── PaneLayout
    │       └── PaneRenderer
    │
    ├── SynchronizationRuntime
    │       ├── TimeScale
    │       ├── CrosshairSync
    │       └── PriceScaleManager
    │
    ├── IndicatorRuntime
    ├── DrawingRuntime
    ├── OverlayRuntime
    └── InteractionRuntime
            ├── PointerRouter
            ├── HitTestEngine
            ├── SelectionManager
            ├── ToolController
            ├── DragController
            ├── ResizeController
            └── CursorManager
```

ChartRuntime — единственная точка входа. Все sub-runtimes создаются и связываются через ChartRuntime. Ни один runtime не знает о существовании другого runtime напрямую (см. раздел 7).

---

## 5. Extension Pattern — Universal Runtime Extension

Паттерн является **общеплатформенным** (действует для Dashboard, Workspace, Chart и всех будущих подсистем):

```
Definition<T>          — контракт (interface)
      │
      ▼
Registry<T>            — синглтон: register(id, def) / get(id) / getAll()
      │
      ▼
Runtime<T>             — per-consumer lifecycle: add/remove/toggle/getActive
      │
      ▼
Renderer / Host        — CanvasLayer или React-компонент, потребляет Runtime<T>
```

### 5.1. Реализации в Chart Studio

| Система | Definition | Registry | Runtime | Renderer |
|---------|-----------|----------|---------|----------|
| Indicators | `IndicatorDefinition` | `IndicatorRegistry` | `IndicatorRuntime` | `IndicatorRenderer` |
| Drawings | `DrawingDefinition` | `DrawingRegistry` | `DrawingRuntime` | `DrawingRenderer` |
| Overlays | `OverlayDefinition` | `OverlayRegistry` | `OverlayRuntime` | `OverlayRenderer` |
| Panes | `PaneDefinition` | `PaneRegistry` | `PaneRuntime` | _PaneLayout → PaneRenderer_ |

### 5.2. Инварианты паттерна

1. **Definition не знает о Runtime.** Definition — чистый интерфейс, не содержит lifecycle или state.
2. **Registry не знает о Renderer.** Registry только хранит определения.
3. **Runtime не знает о Renderer.** Runtime управляет состоянием инстансов.
4. **Renderer потребляет Runtime.** Renderer читает runtime.getActive()/getVisible(), но никогда не изменяет runtime напрямую.

---

## 6. Render Pipeline Contract

### 6.1. Иерархия

```
RenderLoop (requestAnimationFrame)
      │
      ▼
PaneRenderer  ←──── Единственный CanvasLayer
      │
      ├── Grid
      ├── Candles
      ├── Indicators
      ├── Drawings
      ├── Overlays
      ├── Crosshair
      └── PriceScale labels
```

### 6.2. Инварианты Render Pipeline

1. **PaneRenderer — единственный CanvasLayer, зарегистрированный в RenderLoop.** Ни один другой renderer не вызывает `loop.addLayer()`.

2. **Sub-renderers не регистрируются напрямую.** GridRenderer, CandleRenderer, IndicatorRenderer, DrawingRenderer, OverlayRenderer — все передаются как опции PaneRenderer.

3. **RenderLoop ничего не знает о типах рендера.** RenderLoop знает только `CanvasLayer` с методами `render()`, `resize()`, `destroy()`. Он не знает об индикаторах, оверлеях или рисунках.

4. **Каждый sub-renderer рисует через `context.ctx`.** Per-pane контекст создаётся PaneRenderer с translate + clip под конкретную панель.

5. **Per-pane viewport создаётся PaneRenderer.** Каждая панель получает свой ChartViewport с общим TimeScale (shared) и per-pane PriceScale.

6. **Ни один Renderer не хранит бизнес-состояние.** Всё состояние — в Runtime. Renderer только читает и рисует.

### 6.3. Z-Order (внутри PaneRenderer.render)

```
for each pane (top to bottom):
  1. ctx.save() + translate + clip
  2. Pane background
  3. GridRenderer
  4. Main pane: CandleRenderer → IndicatorRenderer → DrawingRenderer → OverlayRenderer
     Sub pane:  IndicatorRenderer only
  5. PriceScale labels (right edge)
  6. Pane label (top-left)
  7. Crosshair vertical line
  8. Separator between panes
  9. ctx.restore()
```

---

## 7. Runtime Interaction Rules

### 7.1. Запрет прямых меж-runtime зависимостей

> **Runtime никогда не импортирует другой Runtime напрямую.**

```
❌ ЗАПРЕЩЕНО:
  DrawingRuntime
        │
        ▼
  OverlayRuntime

❌ ЗАПРЕЩЕНО:
  OverlayRuntime
        │
        ▼
  InteractionRuntime
```

```
✅ ДОПУСТИМО:
  ChartRuntime
      │
      ├── IndicatorRuntime
      ├── DrawingRuntime
      ├── OverlayRuntime
      ├── InteractionRuntime
      └── PaneRuntime
```

Все связи между runtimes прокладываются через ChartRuntime или сервисы более высокого уровня.

### 7.2. Дополнительные ограничения

1. **Renderer не изменяет Runtime.** Renderer читает `runtime.getActive()`/`getVisible()` для рендеринга, но никогда не вызывает add/remove/update на runtime.

2. **Registry не знает о Renderer.** Registry — синглтон с определениями, не имеет ссылок на CanvasLayer или RenderLoop.

3. **Definition не знает о Runtime.** Определение — контракт, не содержит lifecycle или ссылок на инстансы.

4. **Interaction не изменяет Render Pipeline.** InteractionRuntime отправляет `requestRender()` через callback, но не вызывает RenderLoop напрямую. InteractionRuntime не импортирует CanvasLayer, RenderLoop или любой другой rendering-компонент.

5. **Overlay не знает Drawing, Drawing не знает Overlay.** Два независимых слоя с разной семантикой (overlays — read-only system annotations, drawings — user-created interactive objects). Единственная общая точка — ChartRuntime, который владеет обоими.

---

## 8. Platform Change Rule

Изменение frozen-компонентов Chart Studio допустимо **только** в следующих случаях:

| Условие | Пример |
|---------|--------|
| Исправление дефекта | Bug в ChartViewport.pixelToPrice |
| Расширение registry новым методом | `getByCategory()` в `OverlayRegistry` |
| Добавление нового модуля | Новый `RendererType` в render pipeline |

**Запрещено:**
- Изменение существующих контрактов (интерфейсов) без новой major-версии
- Рефакторинг frozen-компонентов без прямой бизнес-необходимости
- Создание второго CanvasLayer в RenderLoop
- Прямой импорт Runtime → Runtime

**Проверочный вопрос:**

> Требует ли задача изменения существующего контракта в `CHART_STUDIO_API`, frozen-компонента или Render Pipeline?

- **Нет** → реализуется как новый Definition/OverlayBuiltin/IndicatorBuiltin ✅
- **Да** → остановка: это новая фундаментальная возможность или можно реализовать аддитивно?

---

## 9. Additive Growth Rule

> **Все новые функциональные возможности добавляются без изменения существующих контрактов.**

### 9.1. ✅ Допустимо (additive)

- `+ New IndicatorDefinition` — новый builtin indicator
- `+ New OverlayDefinition` — новый builtin overlay
- `+ New DrawingDefinition` — новый drawing tool
- `+ New PaneDefinition` — новый тип панели
- `+ New layout strategy` — альтернативный PaneLayout
- `+ New synchronization mode` — расширение SynchronizationRuntime

### 9.2. ❌ Недопустимо (breaking)

- Изменить `OverlayRuntime` — изменение контракта runtime
- Изменить `PaneRenderer` — изменение render pipeline
- Изменить `RenderLoop` — изменение orchestrator
- Изменить `ChartRuntime` — изменение entry point
- Изменить frozen definition interface — изменение контраста
- Изменить `ChartViewport` — изменение core transform

---

## 10. Frozen Components

Следующие компоненты **frozen** для Chart Studio v1.x. Изменения — только при новой major-версии контракта или исправлении критических дефектов.

| Модуль | Путь | Статус |
|--------|------|--------|
| Chart Runtime | `chart/runtime/` | frozen v1.0 |
| Chart Viewport | `chart/viewport/` | frozen v1.0 |
| Registries Core | `chart/registries/` | frozen v1.0 |
| Composition Engine | `chart/composition/` | frozen v1.0 |
| Rendering Pipeline | `chart/rendering/` | frozen v1.0 |
| Interaction Engine | `chart/interaction/` | frozen v1.0 |
| Indicator Runtime | `chart/indicators/IndicatorRuntime.ts` | frozen v1.0 |
| Drawing Runtime | `chart/drawing/DrawingRuntime.ts` | frozen v1.0 |
| Overlay Runtime | `chart/overlay/OverlayRuntime.ts` | frozen v1.0 |
| Indicator Renderer | `chart/indicators/IndicatorRenderer.ts` | frozen v1.0 |
| Drawing Renderer | `chart/drawing/DrawingRenderer.ts` | frozen v1.0 |
| Overlay Renderer | `chart/overlay/OverlayRenderer.ts` | frozen v1.0 |

### 10.1. Не frozen (активно расширяемо)

| Модуль | Путь | Причина |
|--------|------|---------|
| Indicator Builtins | `chart/indicators/builtins/` | Новые индикаторы |
| Drawing Builtins | `chart/drawing/builtins/` | Новые инструменты |
| Overlay Builtins | `chart/overlay/builtins/` | **Новые оверлеи (основная точка роста после 3.3.8)** |
| Pane Definitions | `chart/composition/` (PaneDefinition регистрация) | Новые типы панелей |
| Demo/Sandbox | `chart/demo/` | Всегда экспериментальный |

---

## 11. Verification Checklist

При любом изменении в `src/workspace/chart/`:

- [ ] `npx tsc -b --noEmit` — 0 errors в chart/
- [ ] `npx vite build` — SUCCESS
- [ ] Runtime границы не нарушены (нет Runtime→Runtime import)
- [ ] Ownership не изменён (компонент владеет тем же, чем владел)
- [ ] Render Pipeline не изменён (единственный CanvasLayer — PaneRenderer)
- [ ] Нет новых прямых зависимостей Runtime↔Runtime
- [ ] Новые функции зарегистрированы через Registry
- [ ] Изменения в frozen компонентах — только по criterial defect
- [ ] Все новые типы экспортированы из соответствующего barrel (index.ts)
- [ ] Все типы-only реэкспорты используют `export type`
- [ ] Все конструкторы используют явные поля (не parameter properties)
- [ ] Additive Growth Rule соблюдена (нет breaking changes в существующих контрактах)

---

## 12. Future Evolution

### 12.1. После freeze

После Chart Studio v1.0 Freeze развитие идёт исключительно аддитивно:

| Направление | Механизм |
|-------------|----------|
| Новые индикаторы | `IndicatorRegistry.register()` |
| Новые drawing tools | `DrawingRegistry.register()` |
| Новые overlay типы | `OverlayRegistry.register()` |
| Новые типы панелей | `PaneRegistry.register()` |
| Новые алго-рендеры | Реализация `IRenderLayer`, передача опцией в PaneRenderer |
| Multi-chart sync | Расширение `SynchronizationRuntime` (новый режим) |
| Replay integration | Новый `ReplayRuntime` → связь через ChartRuntime |

### 12.2. v1.x → v2.0

Переход на v2.0 возможен только при:
- Фундаментальное изменение render pipeline (например, WebGL/WebGPU)
- Полная смена architecture paradigms
- Новая major-версия платформы

В рамках v1.x все изменения — аддитивные.

---

> *Утверждено. Sprint 3.3 завершает архитектурное строительство Chart Studio. Platform Expansion начинается с Trading Overlay Pack (Sprint 3.3.8).*

---

## 13. Stability Status

Chart Studio разрабатывается в рамках следующего жизненного цикла:

| Фаза | Спринты | Характер изменений |
|------|---------|-------------------|
| Architecture Construction | 3.3.1 – 3.3.7 | Формирование архитектуры, слоёв, контрактов |
| Final Additive Feature | **3.3.8** | Trading Overlay Pack — последнее аддитивное расширение перед freeze |
| **v1.0 Freeze** | После 3.3.8 | Публичный API заморожен |
| v1.x | Пост-freeze | Только аддитивная эволюция (новые определения, builtins) |
| v2.0 | Будущее | Breaking changes только через новую major-версию |

**Правило версионирования:**

> Любое изменение frozen-контракта (CHART_STUDIO_API, Render Pipeline, Runtime interfaces) требует новой major-версии (v2.0, v3.0, ...). В рамках v1.x все изменения — исключительно аддитивные, без модификации существующих контрактов.
