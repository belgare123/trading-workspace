# Visual Strategy Builder v1.0 Freeze

> Дата: 2026-07-16
> Версия: v1.0
> Область применения: `src/workspace/strategy-builder/`
> Commit: `8bec488` (будет обновлён после подписания)
> Тег: `visual-builder-v1.0`
> Проект: Trading Platform
> Статус: **Заморожен**

---

## 1. Version

| Поле | Значение |
|------|----------|
| Major версия | 1 |
| Minor версия | 0 |
| Статус | Frozen |
| Предыдущая версия | — |
| Дата заморозки | 2026-07-16 |
| Спринты | 3.6.1 – 3.6.4 |

---

## 2. Scope

Visual Strategy Builder — подсистема визуального редактирования стратегий Trading Platform, работающая исключительно как UI-клиент над `GraphRuntime`. Включает:

- **Canvas Foundation (3.6.1):** CanvasManager, Viewport, Interaction, Selection, Rendering
- **Node System (3.6.2):** NodeDefinition, NodeRegistry, NodeRuntime, NodeRenderer
- **Graph Editor (3.6.3):** ConnectionManager, EdgeView, AutoLayout, ClipboardManager, UndoAdapter, GraphCommands, GraphEditorRuntime
- **Builder Shell (3.6.4):** PaletteRuntime, InspectorRuntime, PropertyEditorRegistry, MiniMapRuntime, GraphSearch, GraphOutline, BuilderShellRuntime

### 2.1. Не входит в Scope

- AI-assisted Builder (будущее)
- Marketplace Nodes (будущее)
- Graph Diff/Merge (будущее)
- Visual Debugger (будущее)
- Collaborative Editing (будущее)

---

## 3. Frozen Components

### 3.1. Frozen (ядро — изменения только через новую major-версию)

| Модуль | Путь |
|--------|------|
| Canvas Manager | `strategy-builder/canvas/CanvasManager.ts` |
| Viewport State | `strategy-builder/viewport/` |
| Interaction Manager | `strategy-builder/interaction/InteractionManager.ts` |
| Selection Manager | `strategy-builder/selection/SelectionManager.ts` |
| Rendering Pipeline | `strategy-builder/rendering/Renderer.ts` |
| Node Runtime | `strategy-builder/nodes/NodeRuntime.ts` |
| Node Registry | `strategy-builder/nodes/NodeRegistry.ts` |
| Node Definition types | `strategy-builder/nodes/types.ts` |
| Graph Editor Runtime | `strategy-builder/graph-editor/GraphEditorRuntime.ts` |
| Connection Manager | `strategy-builder/graph-editor/ConnectionManager.ts` |
| Edge View | `strategy-builder/graph-editor/EdgeView.ts` |
| Edge Renderer | `strategy-builder/graph-editor/EdgeRenderer.ts` |
| Auto Layout | `strategy-builder/graph-editor/AutoLayout.ts` |
| Clipboard Manager | `strategy-builder/graph-editor/ClipboardManager.ts` |
| Undo Adapter | `strategy-builder/graph-editor/UndoAdapter.ts` |
| Graph Commands | `strategy-builder/graph-editor/GraphCommands.ts` |
| Builder Event Bus | `strategy-builder/runtime/BuilderEventBus.ts` |
| Builder Shell Runtime | `strategy-builder/shell/BuilderShellRuntime.ts` |
| Palette Runtime | `strategy-builder/shell/palette/PaletteRuntime.ts` |
| Inspector Runtime | `strategy-builder/shell/inspector/InspectorRuntime.ts` |
| Property Editor Registry | `strategy-builder/shell/inspector/PropertyEditorRegistry.ts` |
| MiniMap Runtime | `strategy-builder/shell/minimap/MiniMapRuntime.ts` |
| MiniMap Renderer | `strategy-builder/shell/minimap/MiniMapRenderer.ts` |
| Search Index | `strategy-builder/shell/search/SearchIndex.ts` |
| Graph Search | `strategy-builder/shell/search/GraphSearch.ts` |
| Graph Outline | `strategy-builder/shell/outline/GraphOutline.ts` |

### 3.2. Extensible (активно расширяемо, не frozen)

| Модуль | Путь | Назначение |
|--------|------|------------|
| NodeDefinition | `strategy-builder/nodes/types.ts` (interface) | Новые builtin-ноды |
| Node Registry | `strategy-builder/nodes/NodeRegistry.ts` (метод register) | Регистрация новых типов |
| Property Editor Registry | `strategy-builder/shell/inspector/PropertyEditorRegistry.ts` | Новые редакторы параметров |
| Palette Provider | `strategy-builder/shell/palette/PaletteProvider.ts` | Drag source provider |
| Templates | `strategy-builder/templates/` | Шаблоны графов стратегий |

---

## 4. Public API (Frozen)

```typescript
export const VISUAL_BUILDER_API = {
  /** Shell orchestration */
  shell: ['BuilderShellRuntime'],

  /** Core orchestration */
  runtime: ['StrategyBuilderRuntime', 'GraphEditorRuntime'],

  /** Canvas infrastructure */
  canvas: ['CanvasManager'],
  viewport: ['ViewportState'],
  interaction: ['InteractionManager'],
  selection: ['SelectionManager'],

  /** Graph editing */
  graph: ['GraphEditorRuntime', 'ConnectionManager', 'AutoLayout',
          'ClipboardManager', 'UndoAdapter', 'GraphCommands'],

  /** Node system */
  nodes: ['NodeRuntime', 'NodeRegistry', 'NodeDefinition'],

  /** Rendering */
  rendering: ['Renderer', 'NodeRenderer', 'EdgeRenderer'],

  /** Shell components */
  shellComponents: ['PaletteRuntime', 'InspectorRuntime',
                    'MiniMapRuntime', 'GraphSearch', 'GraphOutline'],

  /** Events */
  events: ['BuilderEventBus'],
} as const
```

### 4.1. Контракты

Все внешние клиенты (Workspace, Dashboard, Marketplace плагины, AI Agent) взаимодействуют с Visual Builder **только** через имена, перечисленные в `VISUAL_BUILDER_API`. Любое изменение требует новой major-версии контракта.

---

## 5. Platform Change Rule

> **Любое изменение `VISUAL_BUILDER_API`, `StrategyGraph`, `NodeRuntime`, `GraphEditorRuntime` или `BuilderShellRuntime`, нарушающее обратную совместимость, допускается только в рамках следующей major-версии.**

### 5.1. Допустимые изменения в frozen-компонентах

| Условие | Пример |
|---------|--------|
| Исправление дефекта | Bug в `ViewportState` coordinate transform |
| Аддитивное расширение registry | Новый метод `getByCategory()` в `NodeRegistry` |
| Добавление нового модуля | Новый ShellComponent, не затрагивающий существующие |

### 5.2. Запрещённые изменения

- Изменение существующих интерфейсов `NodeDefinition`, `ParameterDefinition`, `NodeRuntime`
- Изменение контракта `BuilderShellRuntime`
- Изменение Render Pipeline (`Renderer.render()` signature)
- Создание второго `CanvasLayer` в RenderLoop
- Прямой импорт Runtime → Runtime
- Изменение существующих событий в `BuilderEventBus`

### 5.3. Проверочный вопрос

> Требует ли задача изменения существующего контракта в `VISUAL_BUILDER_API`, frozen-компонента или Render Pipeline?

- **Нет** → реализуется как новый `NodeDefinition` / `PropertyEditor` / `Template` ✅
- **Да** → остановка: это новая фундаментальная возможность или можно реализовать аддитивно?

---

## 6. Extension Points

Visual Builder предоставляет следующие точки расширения, не требующие изменения frozen-компонентов:

| Extension Point | Механизм | Пример |
|-----------------|----------|--------|
| Node Type | `NodeRegistry.register(id, definition)` | Новый builtin узел |
| Property Editor | `PropertyEditorRegistry.register(type, editor)` | Редактор для нового типа параметра |
| Palette Provider | `PaletteProvider` (опциональный) | Кастомный источник палитры |
| Template | `templates/` directory | JSON-шаблон графа стратегии |
| Event Subscription | `BuilderEventBus.on(event, handler)` | Реакция на события редактора |
| Command | `CommandRegistry.register(name, command)` | Новая команда с hotkey |

**Правило:** Любое расширение подключается через Registry, не изменяя существующие Runtime.

---

## 7. Verification Results

### 7.1. Статистика модуля

| Метрика | Значение |
|---------|----------|
| Файлов (`.ts`) | 56 |
| Строк кода | 4,913 |
| Спринтов | 4 (3.6.1 – 3.6.4) |
| Ошибок TypeScript | **0** |

### 7.2. Детализация по спринтам

| Спринт | Файлов | Строк | Ошибок TS | Статус |
|--------|--------|-------|-----------|--------|
| 3.6.1 Canvas Foundation | 15 | 951 | 0 | ✅ |
| 3.6.2 Node System | 15 | ~953 | 0 | ✅ |
| 3.6.3 Graph Editor | 11 | 1,486 | 0 | ✅ |
| 3.6.4 Builder Shell | 15 | 1,518 | 0 | ✅ |
| **Total** | **56** | **4,913** | **0** | **✅** |

### 7.3. Проверки

| Проверка | Результат |
|----------|-----------|
| `npx tsc -b --noEmit` (strategy-builder/) | ✅ 0 errors |
| `npx vite build` (production) | ✅ SUCCESS |
| Единственный источник истины — StrategyGraph | ✅ Зафиксирован в Constitution |
| UI Runtime не содержит вычислительной логики | ✅ |
| Renderer ничего не изменяет | ✅ |
| NodeRuntime не знает о других Runtimes | ✅ |
| Builder не знает Execution Runtime | ✅ |
| Runtime→Runtime import отсутствуют | ✅ |
| PropertyGrid работает через Registry | ✅ |
| Palette строится автоматически из NodeRegistry | ✅ |
| Search использует SearchIndex | ✅ |
| MiniMap использует существующие ViewModel | ✅ |
| Все типы экспортированы из barrel (index.ts) | ✅ |
| `enum` не используется | ✅ |
| Additive Growth Rule соблюдена | ✅ |
| Domain/UI Separation соблюдено | ✅ |

### 7.4. Платформенная статистика

| Модуль | Файлов | Строк | Статус |
|--------|--------|-------|--------|
| Chart Studio v1.0 | 108 | 7,825 | ✅ Frozen |
| Strategy Studio v1.0 | 83 | 5,692 | ✅ Frozen |
| **Visual Builder v1.0** | **56** | **4,913** | **✅ Frozen (текущий)** |
| Total платформа (workspace) | 409 | 31,169 | Production |

---

## 8. Compatibility

### 8.1. Обратная совместимость

- Все изменения в `src/workspace/strategy-builder/` — **аддитивные** (новые файлы, новые экспорты)
- Существующие контракты Strategy Studio и Chart Studio не изменены
- Builder не добавляет зависимостей к Execution, Metrics, Backtest, Optimization или Reports
- Builder работает с `StrategyGraph` исключительно через `GraphRuntime` (frozen v1.0)

### 8.2. Зависимости (inbound)

Visual Builder **зависит** от:
- `strategy/composition/types` (StrategyGraph, StrategyNode, StrategyEdge) — frozen v1.0
- `runtime/CommandRegistry` — платформенный

Visual Builder **не зависит** от:
- `execution/` — не импортирует
- `metrics/` — не импортирует
- `backtest/` — не импортирует
- `optimization/` — не импортирует
- `reports/` — не импортирует

### 8.3. Зависимости (outbound)

Visual Builder **потребляется**:
- Workspace (Host runtime) — загрузка/рендеринг панели Builder
- Dashboard — видимость для пользователя

---

## 9. Future Evolution

### 9.1. Ближайшие шаги (Integration Sprint)

| Задача | Описание |
|--------|----------|
| Workspace Integration | Встроить Builder как панель в Workspace Layout |
| End-to-End Workflow | Создать граф → сохранить → выполнить → backtest → отчёт |
| Marketplace Integration | Подтвердить аддитивное подключение через Registry |

### 9.2. Долгосрочные направления

| Направление | Статус |
|-------------|--------|
| AI-assisted Builder | Планируется |
| Marketplace Nodes | Планируется |
| Collaborative Editing | Планируется |
| Visual Debugger | Планируется |
| Graph Diff / Merge | Планируется |
| Live Graph Execution | Планируется |

---

## 10. Changelog

| Версия | Дата | Изменения |
|--------|------|-----------|
| v1.0 | 2026-07-16 | Initial release. Спринты 3.6.1 – 3.6.4. 56 файлов, 4,913 строк. |

---

> *Утверждено. Visual Strategy Builder v1.0 заморожен. Архитектурное ядро платформы сформировано: Chart Studio v1.0 + Strategy Studio v1.0 + Visual Builder v1.0.*
>
> *Следующий этап: Workspace Integration Sprint.*
