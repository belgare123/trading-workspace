# Visual Strategy Builder Constitution v1.0

> Дата: 2026-07-16
> Версия: v1.0
> Область применения: Visual Strategy Builder (`src/workspace/strategy-builder/`)
> Проект: Trading Platform
> Статус: Утверждена (вступает в силу после Sprint 3.6.4)

---

## 1. Purpose

Visual Strategy Builder — подсистема визуального редактирования стратегий Trading Platform, отвечающая за предоставление графического интерфейса для создания, просмотра и модификации StrategyGraph.

**Главный тезис:**

> Visual Strategy Builder **не исполняет стратегии** и **не содержит бизнес-логики**. Единственным источником истины является `StrategyGraph`. Builder — исключительно визуальный редактор, работающий через `GraphRuntime` как через read/write API графа.

Builder можно удалить — `GraphRuntime` продолжит работать.
Builder можно заменить — достаточно реализовать новый UI, читающий/пишущий `StrategyGraph` через тот же `GraphRuntime`.

Конституция вступает в силу **полностью** после завершения Sprint 3.6.4 (Builder Shell). До этого момента допускаются изменения, необходимые для завершения указанного спринта, при условии что они не нарушают дух зафиксированных здесь инвариантов.

---

## 2. Public API (Frozen)

Публичная поверхность Visual Strategy Builder. Все внешние клиенты (Workspace, Dashboard, Marketplace плагины, AI Agent) взаимодействуют с Builder **только** через этот API. Любое изменение требует новой major-версии контракта.

```typescript
export const VISUAL_BUILDER_API = {
  /** Shell orchestration — coordination of all sub-runtimes */
  shell: 'BuilderShellRuntime',

  /** Core orchestration — graph lifecycle, node management */
  runtime: 'StrategyBuilderRuntime',

  /** Registries (singletons, shared across all builder instances) */
  registries: [
    'NodeRegistry',
  ] as const,

  /** Runtimes (per-builder-instance) */
  runtimes: [
    'NodeRuntime',
    'GraphEditorRuntime',
  ] as const,

  /** Shell components (per-builder-layout) */
  shellComponents: [
    'PaletteRuntime',
    'InspectorRuntime',
    'MiniMapRuntime',
    'GraphSearch',
    'GraphOutline',
  ] as const,

  /** Editor infrastructure */
  editor: [
    'GraphEditorRuntime',
    'ConnectionManager',
    'AutoLayout',
    'ClipboardManager',
    'UndoAdapter',
  ] as const,

  /** Canvas */
  canvas: [
    'CanvasManager',
    'ViewportState',
    'InteractionManager',
    'SelectionManager',
  ] as const,

  /** Events */
  events: 'BuilderEventBus',
} as const
```

### 2.1. Семантические типы

```typescript
/** Категория узла в палитре — автоматически из NodeCategory */
type PaletteCategory =
  | 'signals'
  | 'conditions'
  | 'actions'
  | 'groups'
  | 'custom'

/** Параметр узла — универсальное описание для PropertyEditorRegistry */
interface ParameterDefinition {
  id: string
  type: 'number' | 'integer' | 'boolean' | 'enum' | 'time' | 'symbol' | 'string'
  label: string
  defaultValue: unknown
  min?: number
  max?: number
  step?: number
  enumValues?: { label: string; value: string }[]
  unit?: string
  description?: string
}

/** Состояние мини-карты — scaled view из тех же ViewModel */
interface MiniMapState {
  graphBounds: Box2D
  viewportRect: Box2D
  nodes: Array<{ id: string; x: number; y: number; w: number; h: number; selected: boolean }>
  edges: Array<{ from: [number, number]; to: [number, number] }>
}
```

---

## 3. Ownership Matrix

| Компонент | Владеет |
|-----------|---------|
| `StrategyGraph` | Domain model — композиция узлов и связей (единственный источник истины) |
| `NodeRuntime` | UI state — выделение, позиционирование, hover, z-index |
| `NodeDefinition` | Контракт типа узла: typeName, ports, defaultSize, createView, render |
| `NodeRegistry` | Регистрация/получение NodeDefinition (singleton) |
| `GraphEditorRuntime` | Editing workflow — connection, clipboard, autolayout, undo/redo, commands |
| `ConnectionManager` | Port drag → edge creation/validation |
| `EdgeRenderer` | Drawing edges — bezier/orthogonal/highlighted |
| `AutoLayout` | DAG layout — layer → crossing reduction → coordinate assign |
| `ClipboardManager` | copy/paste — через GraphSerializer |
| `UndoAdapter` | Snapshot-based undo/redo — через Workspace UndoManager |
| `BuilderShellRuntime` | Coordination — связывает Palette, Inspector, MiniMap, Search, Outline |
| `PaletteRuntime` | Discovery — читает NodeRegistry, строит категории |
| `InspectorRuntime` | Editing parameters — читает выбранный узел, предоставляет ParameterDefinition |
| `PropertyEditorRegistry` | Type→editor mapping — выбора редактора по типу параметра |
| `PropertyGrid` | Rendering — рендерит редакторы из реестра для выбранного узла |
| `MiniMapRuntime` | Visualization — scaled transform тех же NodeView/EdgeView |
| `SearchIndex` | Indexing — текстовый индекс по нодам |
| `GraphSearch` | Search API — поиск по индексу |
| `GraphOutline` | Outline — иерархическое представление графа |
| `CanvasManager` | Canvas lifecycle — create/destroy/resize/requestRender |
| `ViewportState` | Coordinate transforms — pan/zoom/bounds |
| `InteractionManager` | Pointer routing — mouse/touch/pen → events |
| `SelectionManager` | Selection — box-select, click-select, add-to-selection |
| `BuilderEventBus` | Events — меж-runtime коммуникация (pub/sub) |
| `Renderer` | Drawing only — render(), resize(), destroy() |

При code review любой вопрос разрешается через: **«Кто этим владеет?»**

---

## 4. Domain / UI Separation

**Это главный архитектурный инвариант Builder.**

```
┌─────────────┐
│ StrategyGraph │  ← Domain model (единственный источник истины)
│ (composition) │
└──────┬───────┘
       │ read/write через GraphRuntime
       ▼
┌─────────────┐
│  NodeView   │  ← UI model (StrategyNode + position + selection)
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  EdgeView   │  ← UI model (temporary, highlighted, animated)
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  Renderer   │  ← Drawing only
└─────────────┘
```

### 4.1. Правило разделения

> **UI никогда не становится источником истины.**

- `StrategyGraph` — единственное место, где хранятся узлы, их параметры и связи
- `NodeRuntime` хранит только UI-состояние: позицию, выделение, hover
- `NodeView` — read-only проекция StrategyNode + NodeRuntime
- `EdgeView` — read-only проекция StrategyEdge + временные/редакторские состояния
- `Renderer` рисует то, что говорит `NodeRuntime`, ничего не изменяя

### 4.2. Что происходит при изменении параметра

```
PropertyGrid
    │
    ▼
InspectorRuntime.updateParam(nodeId, paramId, value)
    │
    ├── 1. StrategyGraph.setNodeParam(nodeId, paramId, value)  ← меняет source of truth
    │
    ├── 2. BuilderEventBus.emit('builder:property:changed', ...)
    │
    └── 3. NodeRuntime.onGraphChanged()                         ← синхронизирует UI
            │
            ▼
         4. Renderer.render()                                   ← перерисовывает
```

### 4.3. Что происходит при перемещении узла

```
Canvas drag
    │
    ▼
NodeRuntime.updatePosition(nodeId, x, y)
    │
    ├── 1. NodeRuntime обновляет position в UI state
    │
    ├── 2. BuilderEventBus.emit('builder:node:moved', ...)
    │
    └── 3. StrategyGraph НЕ изменяется — позиция не является бизнес-данными
          (Позиция — pure UI state, не влияет на исполнение графа)
```

---

## 5. Builder Runtime Architecture

```
BuilderShellRuntime
    │
    ├── PaletteRuntime          (discovery — NodeRegistry → PaletteProvider)
    ├── InspectorRuntime        (editing — ParameterDefinition → PropertyGrid)
    ├── MiniMapRuntime          (visualization — scaled NodeView/EdgeView)
    ├── GraphSearch             (search — SearchIndex → fuzzy lookup)
    └── GraphOutline            (outline — tree representation)
            │
            ▼
    StrategyBuilderRuntime
            │
            ▼
    GraphEditorRuntime
            │
            ├── ConnectionManager
            ├── AutoLayout
            ├── ClipboardManager
            ├── UndoAdapter
            └── CommandRegistry
            │
            ▼
    NodeRuntime
            │
            ├── CanvasManager
            │       ├── ViewportState
            │       ├── InteractionManager
            │       └── SelectionManager
            │
            └── Renderer
                    ├── NodeRenderer
                    ├── EdgeRenderer
                    └── MiniMapRenderer
```

**BuilderShellRuntime — единственная точка координации.** Ни один shell-компонент не импортирует другой shell-компонент напрямую. Все связи прокладываются через `BuilderShellRuntime`.

---

## 6. Runtime Interaction Rules

### 6.1. Запрет прямых меж-runtime зависимостей

> **Runtime не импортирует другой Runtime напрямую.**

```
❌ ЗАПРЕЩЕНО:
  PaletteRuntime
        │
        ▼
  InspectorRuntime

❌ ЗАПРЕЩЕНО:
  InspectorRuntime
        │
        ▼
  MiniMapRuntime
```

```
✅ ДОПУСТИМО:
  BuilderShellRuntime
      │
      ├── PaletteRuntime
      ├── InspectorRuntime
      ├── MiniMapRuntime
      ├── GraphSearch
      └── GraphOutline
```

### 6.2. Четыре правила взаимодействия

1. **Runtime не импортирует Runtime.** Ни один runtime не имеет прямой ссылки на другой runtime. Коммуникация — только через `BuilderEventBus` или `BuilderShellRuntime`.

2. **Renderer не мутирует Graph.** Renderer читает `NodeRuntime.getViews()` / `NodeRuntime.getEdgeViews()` для рисования, но никогда не вызывает `addNode()`, `removeNode()`, `updateParam()` или любые другие изменения StrategyGraph.

3. **Shell не редактирует Graph напрямую.** Shell-компоненты (Palette, Inspector, Search) предоставляют UI и триггерят события. Фактические изменения StrategyGraph выполняются через `GraphEditorRuntime` или `StrategyBuilderRuntime`.

4. **StrategyGraph владеет топологией.** Никакой код вне StrategyGraph не может изменять структуру графа (добавлять/удалять узлы, создавать/разрывать связи). Всё — через `GraphRuntime`.

### 6.3. Дополнительные ограничения

1. **Registry не знает о Runtime.** `NodeRegistry` не имеет ссылок на `NodeRuntime` или `BuilderShellRuntime`.
2. **Definition не знает о Runtime.** `NodeDefinition` — чистый интерфейс, не содержит lifecycle или ссылок на инстансы.
3. **PropertyEditor не знает об Inspector.** Редактор получает `{ param, value, onChange }`, не имеет ссылки на `InspectorRuntime`.
4. **MiniMap не создаёт второй Graph.** MiniMap использует те же `NodeRuntime` и `EdgeView`, применяя scaled transform.
5. **Search не дублирует состояние.** `SearchIndex` строится из `StrategyGraph`, не хранит отдельную копию графа.

---

## 7. Render Pipeline Contract

### 7.1. Иерархия

```
CanvasManager.requestRender()
        │
        ▼
Renderer.render(state: RenderFrame)
        │
        ├── NodeRenderer           (renders all NodeView instances)
        ├── EdgeRenderer           (renders all EdgeView instances)
        ├── SelectionOverlay       (box-select rectangle + node selection borders)
        ├── ConnectionGhost        (rubber-band during port drag)
        ├── Grid                   (background dot/grid pattern)
        └── MiniMapRenderer        (scaled overview in corner)
```

### 7.2. Инварианты Render Pipeline

1. **CanvasManager — единственный, кто регистрирует Renderer.** Ни один другой класс не вызывает RenderLoop.addLayer().

2. **Renderer — единственный, кто рисует.** NodeRenderer, EdgeRenderer, SelectionOverlay и MiniMapRenderer — не самостоятельные renderers, а шаги внутри одного `Renderer.render()`. Они не регистрируются в RenderLoop.

3. **RenderFrame — read-only снимок.** Все данные для рендеринга передаются через `RenderFrame`, который формируется `NodeRuntime.render()` и содержит только то, что нужно для рисования.

4. **CanvasManager не знает о содержимом.** CanvasManager знает только размер canvas и состояние viewport. Он не знает об узлах, связях, мини-карте или выделении.

5. **Per-frame full redraw.** Каждый кадр рисуется с нуля. Нет инкрементального рендеринга (в рамках v1.x).

6. **Ни один Renderer не хранит бизнес-состояние.** Всё состояние — в Runtime. Renderer только читает и рисует.

### 7.3. Z-Order (внутри Renderer.render)

```
1. Grid (background)
2. ConnectionGhost (temporary edge during drag — под линиями)
3. EdgeRenderer (all edges)
4. NodeRenderer (all nodes)
5. SelectionOverlay (selection rectangles поверх нод)
6. MiniMapRenderer (скейлится поверх всего)
```

---

## 8. Extension Pattern — Universal Definition → Registry → Runtime → Consumer

Паттерн является **общеплатформенным** (действует для Strategy Studio, Chart Studio, Visual Builder и всех будущих подсистем):

```
Definition<T>          — контракт (interface)
      │
      ▼
Registry<T>            — синглтон: register(id, def) / get(id) / getAll()
      │
      ▼
Runtime<T>             — per-instance lifecycle: add/remove/toggle/getActive
      │
      ▼
Consumer               — Renderer / Shell component / Executor / REST / AI
```

### 8.1. Реализация в Visual Builder

| Система | Definition | Registry | Runtime | Consumer |
|---------|-----------|----------|---------|----------|
| Node types | `NodeDefinition` | `NodeRegistry` | `NodeRuntime` | `NodeRenderer` |
| Property editors | (editor function) | `PropertyEditorRegistry` | `PropertyGrid` | `InspectorRuntime` |
| Palette sources | (NodeRegistry → PaletteItem) | (через Renderer) | `PaletteRuntime` | `PaletteProvider` |
| Search providers | (SearchIndex builder) | (неявный) | `SearchIndex` | `GraphSearch` |

### 8.2. Инварианты паттерна

1. **Definition не знает о Runtime.** Definition — чистый интерфейс, не содержит lifecycle или state.
2. **Registry не знает о Consumer.** Registry только хранит определения.
3. **Runtime не знает о Consumer.** Runtime управляет состоянием.
4. **Consumer использует Runtime.** Consumer читает `runtime.getActive()`/`getViews()`, но никогда не изменяет runtime напрямую (за исключением команд пользователя через конкретные методы изменения).

### 8.3. Marketplace Compatibility

Marketplace подключает новые узлы через `NodeRegistry.register()` — этого достаточно, чтобы:

- PaletteRuntime автоматически показал новый узел в палитре
- NodeRuntime создавал ViewModel для нового узла
- NodeRenderer рисовал новый узел (если render() реализован)
- InspectorRuntime отображал параметры нового узла
- PropertyEditorRegistry подбирал редактор по типу параметра

Никаких изменений в Builder не требуется — интеграция происходит через существующие Registry.

---

## 9. Additive Growth Rule

> **Все новые функциональные возможности добавляются без изменения существующих контрактов.**

### 9.1. ✅ Допустимо (additive)

- `+ New NodeDefinition` — новый builtin узел (через `NodeRegistry.register()`)
- `+ New PropertyEditor` — новый редактор параметра (через `PropertyEditorRegistry.register()`)
- `+ New PaletteProvider` — альтернативный источник палитры
- `+ New SearchProvider` — расширение SearchIndex
- `+ New Template` — новый шаблон графа (в `templates/`)
- `+ New Command` — новая команда в `GraphCommands` (через `CommandRegistry.register()`)
- `+ New AutoLayout strategy` — альтернативный алгоритм layout
- `+ New RenderLayer` — новый слой в Render Pipeline (опция в Renderer)
- `+ New BuilderEvent` — новое событие в BuilderEventBus
- `+ New ShellComponent` — новая панель в BuilderShellRuntime
- `+ New GraphSerializer format` — альтернативный формат сериализации

### 9.2. ❌ Недопустимо (breaking)

- Изменить `NodeDefinition` interface — изменение контракта ноды
- Изменить `NodeRuntime` lifecycle — изменение API управления состоянием
- Изменить `GraphEditorRuntime` — изменение контракта редактирования
- Изменить `BuilderEventBus` contract — изменение существующих событий
- Изменить `CanvasManager` — изменение entry point canvas
- Изменить `Renderer.render()` — изменение render pipeline
- Изменить `BuilderShellRuntime` interface — изменение shell-оркестрации
- Изменить `ViewportState` transforms — изменение core координат
- Изменить `SelectionManager` — изменение API выделения
- Создать второй CanvasLayer в RenderLoop
- Рефакторинг frozen-компонентов без прямой бизнес-необходимости

---

## 10. Frozen Components

Следующие компоненты **frozen** для Visual Builder v1.x. Изменения — только при новой major-версии контракта или исправлении критических дефектов.

### 10.1. Frozen

| Модуль | Путь | Статус |
|--------|------|--------|
| Canvas Manager | `strategy-builder/canvas/` | frozen v1.0 |
| Viewport State | `strategy-builder/viewport/` | frozen v1.0 |
| Interaction Manager | `strategy-builder/interaction/` | frozen v1.0 |
| Selection Manager | `strategy-builder/selection/` | frozen v1.0 |
| Rendering Pipeline | `strategy-builder/rendering/` | frozen v1.0 |
| Node Runtime | `strategy-builder/nodes/NodeRuntime.ts` | frozen v1.0 |
| Node Registry | `strategy-builder/nodes/NodeRegistry.ts` | frozen v1.0 |
| Node Definition types | `strategy-builder/nodes/types.ts` | frozen v1.0 |
| Graph Editor Runtime | `strategy-builder/graph-editor/GraphEditorRuntime.ts` | frozen v1.0 |
| Connection Manager | `strategy-builder/graph-editor/ConnectionManager.ts` | frozen v1.0 |
| Edge View | `strategy-builder/graph-editor/EdgeView.ts` | frozen v1.0 |
| Edge Renderer | `strategy-builder/graph-editor/EdgeRenderer.ts` | frozen v1.0 |
| Auto Layout | `strategy-builder/graph-editor/AutoLayout.ts` | frozen v1.0 |
| Clipboard Manager | `strategy-builder/graph-editor/ClipboardManager.ts` | frozen v1.0 |
| Undo Adapter | `strategy-builder/graph-editor/UndoAdapter.ts` | frozen v1.0 |
| Graph Commands | `strategy-builder/graph-editor/GraphCommands.ts` | frozen v1.0 |
| Builder Event Bus | `strategy-builder/runtime/BuilderEventBus.ts` | frozen v1.0 |
| Builder Shell Runtime | `strategy-builder/shell/BuilderShellRuntime.ts` | frozen v1.0 |
| Palette Runtime | `strategy-builder/shell/palette/PaletteRuntime.ts` | frozen v1.0 |
| Inspector Runtime | `strategy-builder/shell/inspector/InspectorRuntime.ts` | frozen v1.0 |
| Property Editor Registry | `strategy-builder/shell/inspector/PropertyEditorRegistry.ts` | frozen v1.0 |
| MiniMap Runtime | `strategy-builder/shell/minimap/MiniMapRuntime.ts` | frozen v1.0 |
| MiniMap Renderer | `strategy-builder/shell/minimap/MiniMapRenderer.ts` | frozen v1.0 |
| Search Index | `strategy-builder/shell/search/SearchIndex.ts` | frozen v1.0 |
| Graph Search | `strategy-builder/shell/search/GraphSearch.ts` | frozen v1.0 |
| Graph Outline | `strategy-builder/shell/outline/GraphOutline.ts` | frozen v1.0 |

### 10.2. Не frozen (активно расширяемо)

| Модуль | Путь | Причина |
|--------|------|---------|
| Node Renderer | `strategy-builder/nodes/renderers/` | Новые рендеры нод |
| Property Editors | `strategy-builder/shell/inspector/editors/` | Новые редакторы параметров |
| Templates | `strategy-builder/templates/` | Новые шаблоны графов |
| Demo/Sandbox | `strategy-builder/demo/` | Всегда экспериментальный |

---

## 11. Verification Checklist

При любом изменении в `src/workspace/strategy-builder/`:

- [ ] `npx tsc -b --noEmit` — 0 errors в strategy-builder/
- [ ] `npx vite build` — SUCCESS
- [ ] Единственный источник истины — StrategyGraph (не UI)
- [ ] UI Runtime не содержит вычислительной логики
- [ ] Renderer ничего не изменяет (read-only drawing)
- [ ] NodeRuntime не знает о других Runtimes
- [ ] Builder не знает Execution Runtime
- [ ] Runtime границы не нарушены (нет Runtime→Runtime import)
- [ ] Ownership не изменён (компонент владеет тем же, чем владел)
- [ ] Render Pipeline не изменён (CanvasManager — единственный entry point)
- [ ] Нет новых прямых зависимостей Runtime↔Runtime
- [ ] Новые функции зарегистрированы через Registry
- [ ] PropertyGrid работает через PropertyEditorRegistry (не switch)
- [ ] Palette строится автоматически из NodeRegistry
- [ ] Search использует SearchIndex
- [ ] MiniMap использует существующие ViewModel (не создаёт второй Graph)
- [ ] Shell-компоненты не редактируют Graph напрямую
- [ ] Изменения в frozen компонентах — только по criterial defect
- [ ] Все новые типы экспортированы из соответствующего barrel (index.ts)
- [ ] Все типы-only реэкспорты используют `export type`
- [ ] Все конструкторы используют явные поля (не parameter properties)
- [ ] `enum` не используется (только `as const` + type alias)
- [ ] Additive Growth Rule соблюдена (нет breaking changes в существующих контрактах)

---

## 12. Future Evolution

### 12.1. После freeze

После Visual Builder v1.0 Freeze развитие идёт исключительно аддитивно:

| Направление | Механизм | Статус |
|-------------|----------|--------|
| AI-assisted Builder | LLM → StrategyGraph JSON → GraphRuntime | Планируется |
| Marketplace Nodes | `NodeRegistry.register()` через внешние пакеты | Планируется |
| Collaborative Editing | Multi-cursor + operational transform поверх BuilderEventBus | Планируется |
| Cloud Templates | Внешнее хранилище template-графов | Планируется |
| Visual Debugger | GraphRuntime.execute() + highlight активных нод | Планируется |
| Live Graph Execution | Режим live: executor подсвечивает выполняемую ноду | Планируется |
| Graph Diff | Сравнение двух версий StrategyGraph | Планируется |
| Graph Merge | Трёхстороннее слияние StrategyGraph | Планируется |
| Bookmarks | Сохранение позиций/масштаба в графе | Планируется |
| Navigator | Птичий полёт над большими графами | Планируется |
| Breadcrumbs | Навигация по глубине композиции | Планируется |
| Validation Panel | Интерактивный список ошибок графа | Планируется |
| Problems Panel | Список варнингов и ошибок всех типов | Планируется |
| Graph Statistics | Число узлов, связей, глубина, сложность | Планируется |

### 12.2. v1.x → v2.0

Переход на v2.0 возможен только при:
- Фундаментальное изменение render pipeline (например, WebGL/WebGPU)
- Полная смена architecture paradigms
- Новая major-версия платформы

В рамках v1.x все изменения — аддитивные.

---

## 13. Stability Status

Visual Builder разрабатывается в рамках следующего жизненного цикла:

| Фаза | Спринты | Характер изменений |
|------|---------|-------------------|
| Architecture Construction | 3.6.1 – 3.6.3 | Формирование архитектуры: Canvas → Node System → Graph Editor |
| Shell Completion | **3.6.4** | Builder Shell — Palette, Inspector, Search, MiniMap, Outline, Property Grid |
| **v1.0 Freeze** | После 3.6.4 | Публичный API заморожен |
| v1.x | Пост-freeze | Только аддитивная эволюция (новые ноды, редакторы, провайдеры, шаблоны) |
| v2.0 | Будущее | Breaking changes только через новую major-версию |

**Правило версионирования:**

> Любое изменение frozen-контракта (VISUAL_BUILDER_API, Render Pipeline, Runtime interfaces) требует новой major-версии (v2.0, v3.0, ...). В рамках v1.x все изменения — исключительно аддитивные, без модификации существующих контрактов.

---

> *Утверждено. Sprint 3.6 завершает архитектурное строительство Visual Strategy Builder. Platform Integration начинается с Workspace Integration Sprint.*
