# Strategy Studio Constitution v1.0

> Дата: 2026-07-16
> Версия: v1.0
> Область применения: Strategy Studio (`src/workspace/strategy/`)
> Проект: Trading Platform
> Статус: Утверждена (вступает в силу после Sprint 3.4.6)

---

## 1. Purpose

Strategy Studio — подсистема стратегий Trading Platform, отвечающая за определение, регистрацию, исполнение и композицию торговых стратегий. Настоящая конституция фиксирует публичный API, архитектурные границы, ownership и правила расширения Strategy Studio.

Конституция вступает в силу **полностью** после завершения Sprint 3.4.6 (Strategy Composition Engine). До этого момента допускаются изменения, необходимые для завершения указанного спринта, при условии что они не нарушают дух зафиксированных здесь инвариантов.

---

## 2. Public API (Frozen)

Публичная поверхность Strategy Studio. Все внешние клиенты (Execution Simulator, Metrics Runtime, Dashboard, Visual Builder, Marketplace) взаимодействуют со Strategy Studio **только** через этот API. Любое изменение требует новой major-версии контракта.

```typescript
export const STRATEGY_STUDIO_API = {
  /** Strategy lifecycle — definition, registry, runtime, executor */
  runtime: 'StrategyRuntime',
  executor: 'StrategyExecutor',

  /** Unified execution context — facade over 7 sub-contexts */
  context: 'ExecutionContext',

  /** Core registries (singletons, shared across all strategy instances) */
  registries: [
    'StrategyRegistry',
    'SignalRegistry',
    'ConditionRegistry',
    'ActionRegistry',
  ] as const,

  /** Core runtimes (per-strategy instances) */
  runtimes: [
    'StrategyRuntime',
    'SignalRuntime',
    'ConditionRuntime',
    'ActionRuntime',
  ] as const,

  /** Composition engine — graph-based strategy orchestration */
  composition: [
    'GraphRuntime',
    'GraphExecutor',
    'GraphScheduler',
    'GraphValidator',
    'GraphSerializer',
    'GraphMigration',
  ] as const,
} as const
```

### 2.1. Семантические типы

```typescript
/** Тип узла графа стратегии */
type NodeType =
  | 'signal'      // источник: SignalDefinition.evaluate()
  | 'condition'   // условие: ConditionDefinition.evaluate()
  | 'action'      // действие: ActionDefinition.execute()
  | 'group'       // визуальная группа (без логики)
  | 'comment'     // аннотация (без логики)

/** Событие планировщика */
type ScheduleEvent =
  | 'onBar'
  | 'onTick'
  | 'onTrade'
  | 'onTimer'
  | 'onNews'
  | 'onCustomEvent'

/** Результат исполнения узла */
interface NodeExecutionResult {
  nodeId: string
  type: NodeType
  status: 'success' | 'error' | 'skipped'
  result?: unknown
  error?: string
  duration: number
}
```

---

## 3. Ownership Matrix

| Компонент | Владеет |
|-----------|---------|
| `StrategyRuntime` | lifecycle: вся стратегия; управление StrategyExecutor |
| `StrategyExecutor` | per-bar цикл: bar → evaluate signals → evaluate conditions → execute actions |
| `StrategyDefinition` | контракт стратегии: id, name, create(), onBar() |
| `ExecutionContext` | единый фасад контекстов: market, orders, position, portfolio, time, indicators |
| `SignalRegistry` | регистрация/получение SignalDefinition (singleton) |
| `SignalRuntime` | binding сигналов к стратегии + кэш результатов в рамках бара |
| `SignalDefinition` | контракт сигнала: evaluate(ctx, params) → SignalResult |
| `ConditionRegistry` | регистрация/получение ConditionDefinition (singleton) |
| `ConditionRuntime` | построение + исполнение дерева условий + per-node state |
| `ConditionDefinition` | контракт условия: evaluate(input) → ConditionEvaluationOutput |
| `ActionRegistry` | регистрация/получение ActionDefinition (singleton) |
| `ActionRuntime` | исполнение + история действий |
| `ActionDefinition` | контракт действия: execute(ctx, params) → ActionResult |
| `GraphRuntime` | lifecycle графа: load, validate, schedule, execute |
| `GraphExecutor` | топологическое исполнение DAG (Kahn) |
| `GraphScheduler` | событийный планировщик: onBar / onTick / onTrade / ... |
| `GraphValidator` | 8 проверок графа: циклы, dangling, дубли, root, совместимость |
| `GraphSerializer` | StrategyGraph ↔ JSON сериализация |
| `GraphMigration` | version migration графов |

При code review любой вопрос разрешается через: **«Кто этим владеет?»**

---

## 4. Runtime Architecture

```
StrategyRuntime
    │
    ├── StrategyExecutor
    │       ├── SignalRuntime
    │       ├── ConditionRuntime
    │       └── ActionRuntime
    │
    └── GraphRuntime (альтернативный executor при использовании графа)
            ├── GraphScheduler
            ├── GraphExecutor
            │       ├── SignalRuntime (через SignalRegistry)
            │       ├── ConditionRuntime (через ConditionRegistry)
            │       └── ActionRuntime
            ├── GraphValidator
            └── GraphSerializer
```

**Два режима исполнения:**
1. **Classic Mode** — `StrategyRuntime` + `StrategyExecutor` → кастомный `create()`/`onBar()` в `StrategyDefinition`
2. **Graph Mode** — `GraphRuntime` → визуально конфигурируемый DAG

Оба режима используют одни и те же Signal / Condition / Action runtime и registry. Graph Mode — это стратегия, где граф **является** стратегией, а не имплементацией кастомного кода.

`StrategyRuntime` — единственная точка входа. Все sub-runtimes создаются и связываются через `StrategyRuntime`.

---

## 5. Extension Pattern — Universal Definition → Registry → Runtime → Consumer

Паттерн является **общеплатформенным** (действует для Dashboard, Workspace, Chart, Strategy и всех будущих подсистем):

```
Definition<T>          — контракт (interface)
      │
      ▼
Registry<T>            — синглтон: register(id, def) / get(id) / getAll()
      │
      ▼
Runtime<T>             — per-consumer lifecycle: bind/evaluate/execute/history
      │
      ▼
Consumer               — Executor / Simulator / Visual Builder / REST / AI
```

### 5.1. Реализации в Strategy Studio

| Система | Definition | Registry | Runtime | Consumer |
|---------|-----------|----------|---------|----------|
| Strategies | `StrategyDefinition` | `StrategyRegistry` | `StrategyRuntime` | `StrategyExecutor` |
| Signals | `SignalDefinition` | `SignalRegistry` | `SignalRuntime` | `StrategyExecutor` / `GraphExecutor` |
| Conditions | `ConditionDefinition` | `ConditionRegistry` | `ConditionRuntime` | `StrategyExecutor` / `GraphExecutor` |
| Actions | `ActionDefinition` | `ActionRegistry` | `ActionRuntime` | `StrategyExecutor` / `GraphExecutor` |

### 5.2. Инварианты паттерна

1. **Definition не знает о Runtime.** Definition — чистый интерфейс, не содержит lifecycle или state.
2. **Registry не знает о Consumer.** Registry только хранит определения.
3. **Runtime не знает о Consumer.** Runtime управляет состоянием.
4. **Consumer использует Runtime.** Consumer вызывает `runtime.evaluate()`/`runtime.execute()`, но не изменяет runtime напрямую.
5. **Registry не знает о других Registry.** Каждый Registry — независимый синглтон.

---

## 6. Pipeline Contract

### 6.1. Иерархия исполнения

```
Market Data
      │
      ▼
  Indicators        ←── (внешние, в ExecutionContext)
      │
      ▼
  Signals           ←── SignalRuntime.evaluateAll()
      │
      ▼
  Conditions        ←── ConditionRuntime.evaluateTree()
      │
      ▼
  Actions           ←── ActionRuntime.executeAll()
      │
      ▼
  Execution         ←── (Execution Simulator — внешний потребитель)
```

### 6.2. Pipeline с графом

```
GraphRuntime.execute() for each node in topological order:
      │
      ├── Signal node    → SignalRegistry.get(id).evaluate(ctx, params)
      ├── Condition node → ConditionRegistry.get(id).evaluate({ ctx, params, childResults, nodeState })
      └── Action node    → ActionRuntime.execute(id, ctx, params)
```

### 6.3. Инварианты Pipeline

1. **Action не знает о брокере.** ActionDefinition.execute() работает только через `ExecutionContext.orders.*` — декларативные ордер-запросы.
2. **Condition не знает об Action.** Condition только возвращает `satisfied: boolean`.
3. **Signal не знает о Condition.** Signal только возвращает результат анализа бара.
4. **ExecutionContext — единственный канал данных.** Все sub-runtimes получают контекст через `ctx`, не через прямые вызовы друг друга.
5. **Pipeline однопоточный.** Все evaluate/execute — последовательные async вызовы. Нет параллельного исполнения внутри одного бара.
6. **Per-bar кэш.** SignalRuntime кэширует результаты внутри бара. ConditionRuntime — внутри бара + per-node state.
7. **ActionRuntime — единственный, кто создаёт ордера.** ActionDefinition.execute() — единственное место, где `ctx.orders.submit()` вызывается.

---

## 7. Runtime Interaction Rules

### 7.1. Запрет прямых меж-runtime зависимостей

> **Runtime никогда не импортирует другой Runtime напрямую.**

```
❌ ЗАПРЕЩЕНО:
  SignalRuntime
        │
        ▼
  ConditionRuntime

❌ ЗАПРЕЩЕНО:
  ConditionRuntime
        │
        ▼
  ActionRuntime
```

```
✅ ДОПУСТИМО:
  StrategyRuntime / GraphRuntime
      │
      ├── SignalRuntime
      ├── ConditionRuntime
      └── ActionRuntime
```

Все связи между runtimes прокладываются через `StrategyRuntime` или `GraphRuntime`.

### 7.2. Дополнительные ограничения

1. **Definition не вызывает другой Definition.** SignalDefinition не вызывает ConditionDefinition. Каждый Definition — автономный контракт.
2. **Registry не знает о других Registry.** `SignalRegistry` не импортирует `ConditionRegistry`.
3. **Runtime не знает о других Runtime.** `SignalRuntime` не имеет ссылки на `ConditionRuntime`.
4. **Consumer управляет всеми Runtime.** `StrategyExecutor` / `GraphExecutor` — единственный, кто знает порядок вызовов Signal → Condition → Action.
5. **ExecutionContext — единственный носитель состояния между runtimes.** Он передаётся от Consumer к каждому Runtime.

---

## 8. Platform Change Rule

Изменение frozen-компонентов Strategy Studio допустимо **только** в следующих случаях:

| Условие | Пример |
|---------|--------|
| Исправление дефекта | Bug в `ExecutionContext` или `GraphExecutor` |
| Расширение registry новым методом | `getByCategory()` в `SignalRegistry` |
| Добавление нового модуля | Новый `DefinitionType` в core pipeline |

**Запрещено:**
- Изменение существующих контрактов (интерфейсов Definition/Runtime) без новой major-версии
- Рефакторинг frozen-компонентов без прямой бизнес-необходимости
- Создание прямых Runtime→Runtime импортов
- Изменение блокирующей архитектуры: `ExecutionContext` не может получить новое свойство, если оно не является аддитивным (optional)

**Проверочный вопрос:**

> Требует ли задача изменения существующего контракта в `STRATEGY_STUDIO_API`, frozen-компонента или Pipeline Contract?

- **Нет** → реализуется как новый Definition / Builtin / Template ✅
- **Да** → остановка: это новая фундаментальная возможность или можно реализовать аддитивно?

---

## 9. Additive Growth Rule

> **Все новые функциональные возможности добавляются без изменения существующих контрактов.**

### 9.1. ✅ Допустимо (additive)

- `+ New SignalDefinition` — новый builtin сигнал
- `+ New ConditionDefinition` — новое builtin условие
- `+ New ActionDefinition` — новое builtin действие
- `+ New template strategy` — новый JSON-шаблон в `templates/`
- `+ New GraphSerializer format` — альтернативный формат сериализации
- `+ New SchedulerEvent` — новое событие планировщика

### 9.2. ❌ Недопустимо (breaking)

- Изменить `SignalDefinition.evaluate()` — изменение контракта сигнала
- Изменить `ConditionDefinition.evaluate()` — изменение контракта условия
- Изменить `ActionDefinition.execute()` — изменение контракта действия
- Изменить `GraphExecutor.execute()` — изменение контракта исполнения
- Изменить `ExecutionContext` — изменение единого фасада
- Изменить frozen interface сигнала/условия/действия
- Изменить `StrategyRuntime` lifecycle

---

## 10. Frozen Components

Следующие компоненты **frozen** для Strategy Studio v1.x. Изменения — только при новой major-версии контракта или исправлении критических дефектов.

| Модуль | Путь | Статус |
|--------|------|--------|
| Strategy Runtime | `strategy/runtime/` | frozen v1.0 |
| Strategy Executor | `strategy/executor/` | frozen v1.0 |
| Strategy Definition | `strategy/definition/` | frozen v1.0 |
| Execution Context | `strategy/context/` | frozen v1.0 |
| Signal Definition | `strategy/signals/definition/` | frozen v1.0 |
| Signal Registry | `strategy/signals/registry/` | frozen v1.0 |
| Signal Runtime | `strategy/signals/runtime/` | frozen v1.0 |
| Condition Definition | `strategy/conditions/definition/` | frozen v1.0 |
| Condition Registry | `strategy/conditions/registry/` | frozen v1.0 |
| Condition Runtime | `strategy/conditions/runtime/` | frozen v1.0 |
| Action Definition | `strategy/actions/definition/` | frozen v1.0 |
| Action Registry | `strategy/actions/registry/` | frozen v1.0 |
| Action Runtime | `strategy/actions/runtime/` | frozen v1.0 |
| Graph Runtime | `strategy/composition/runtime/` | frozen v1.0 |
| Graph Executor | `strategy/composition/runtime/GraphExecutor.ts` | frozen v1.0 |
| Graph Validator | `strategy/composition/graph/GraphValidator.ts` | frozen v1.0 |
| Graph Serializer | `strategy/composition/serialization/` | frozen v1.0 |

### 10.1. Не frozen (активно расширяемо)

| Модуль | Путь | Причина |
|--------|------|---------|
| Signal Builtins | `strategy/signals/builtins/` | Новые сигналы |
| Condition Builtins | `strategy/conditions/builtins/` | Новые условия |
| Action Builtins | `strategy/actions/builtins/` | Новые действия |
| Templates | `strategy/composition/templates/` | Новые шаблоны стратегий |
| Demo/Sandbox | `strategy/demo/` | Всегда экспериментальный |

---

## 11. Verification Checklist

При любом изменении в `src/workspace/strategy/`:

- [ ] `npx tsc -b --noEmit` — 0 errors в strategy/
- [ ] `npx vite build` — SUCCESS
- [ ] Runtime границы не нарушены (нет Runtime→Runtime import)
- [ ] Ownership не изменён (компонент владеет тем же, чем владел)
- [ ] Pipeline Contract не изменён (Signal → Condition → Action)
- [ ] Нет новых прямых зависимостей Runtime↔Runtime
- [ ] Новые функции зарегистрированы через Registry
- [ ] Изменения в frozen компонентах — только по criterial defect
- [ ] Все новые типы экспортированы из соответствующего barrel (index.ts)
- [ ] Все типы-only реэкспорты используют `export type`
- [ ] Additive Growth Rule соблюдена (нет breaking changes в существующих контрактах)
- [ ] `ExecutionContext` не получил новых обязательных полей (только optional)

---

## 12. Evolution Roadmap

### 12.1. После freeze (Sprint 3.5.x)

После Strategy Studio v1.0 Freeze развитие идёт исключительно аддитивно:

| Направление | Механизм | Спринт |
|-------------|----------|--------|
| Execution Simulator | Новый `ExecutionEngine` — внешний потребитель Strategy Runtime | 3.5.1 |
| Metrics Runtime | Новый `MetricsRuntime`, слушает Execution Events | 3.5.2 |
| Backtest Session | Новый `BacktestSessionRuntime`, связывает Feed → Strategy → Execution → Metrics | 3.5.3 |
| Visual Builder | React Flow → StrategyGraph UI (thin client над GraphRuntime) | 3.5.4 |
| REST API | HTTP endpoint → StrategyGraph через GraphRuntime | 3.5.5 |
| AI Generator | LLM → StrategyGraph JSON | 3.5.6 |
| Optimizer | Hyperopt → параметры builtins | 3.5.7 |
| Marketplace | External definitions via Registry | 3.5.8 |

### 12.2. v1.x → v2.0

Переход на v2.0 возможен только при:
- Фундаментальное изменение pipeline (например, асинхронный multi-asset)
- Полная смена architecture paradigm (например, event-sourced strategies)
- Новая major-версия платформы

В рамках v1.x все изменения — аддитивные.

---

> *Утверждено. Sprint 3.4 завершает архитектурное строительство Strategy Studio. Platform Evolution начинается с Execution Simulator (Sprint 3.5.1).*

---

## 13. Stability Status

Strategy Studio разрабатывается в рамках следующего жизненного цикла:

| Фаза | Спринты | Характер изменений |
|------|---------|-------------------|
| Architecture Construction | 3.4.1 – 3.4.5 | Формирование архитектуры: Runtime → Context → Signals → Conditions → Actions |
| Composition Layer | **3.4.6** | Strategy Composition Engine — Graph Runtime, Executor, Validator, Serializer |
| **v1.0 Freeze** | После 3.4.6 | Публичный API заморожен |
| v1.x | 3.5.x+ | Только аддитивная эволюция (Execution Simulator, Metrics, Visual Builder, Optimizer) |
| v2.0 | Будущее | Breaking changes только через новую major-версию |

**Правило версионирования:**

> Любое изменение frozen-контракта (STRATEGY_STUDIO_API, Pipeline Contract, Runtime interfaces) требует новой major-версии (v2.0, v3.0, ...). В рамках v1.x все изменения — исключительно аддитивные, без модификации существующих контрактов.
