# Architecture Constitution v1.1

> Дата: 2026-07-15
> v1.0 → v1.1: Sprint 3.1.3.5 — Module System
> Проект: Trading Platform
> Статус: Утверждена

---

## I. Layer Independence

Каждый слой зависит **только** от слоя ниже.

```
Workspace Pro
      │
Runtime Kernel
      │
Trading Core
```

**Запрещено:**
- Workspace → Trading Core (прямой доступ)
- Widgets → REST/WebSocket (прямой доступ)
- UI → Docker/API напрямую

**Разрешено только:**
```
Widget
    ↓
DataProvider
    ↓
Runtime API
    ↓
Runtime Services
    ↓
Trading Core
```

---

## II. Runtime First

Любой новый функционал сначала появляется как возможность Runtime, затем используется клиентами.

```
Runtime Service
        ↓
Runtime SDK
        ↓
Workspace | Trading Lab | Cloud Console | Mobile
```

Это гарантирует, что остальные клиенты смогут использовать ту же функциональность без дублирования логики.

---

## III. Registry First

Любая расширяемая подсистема начинается с реестра.

**Текущие:**
- `WidgetRegistry`
- `CommandRegistry`
- `SearchRegistry`
- `ScreenRegistry`
- `PresetRegistry`
- `DataProviderRegistry`

**Будущие:**
- `PanelRegistry`
- `ToolRegistry`
- `ConnectorRegistry`
- `ThemeRegistry`
- `AlertRegistry`
- `WorkspaceRegistry`

Если сущность должна расширяться плагинами — она получает `extends Registry<T>`.

### III-a. RegistryApi Abstractions

Доступ к реестрам осуществляется **только** через RegistryApi-интерфейсы, а не через конкретные классы реестров:

```typescript
interface WidgetRegistryApi { register(def: WidgetDefinition): void; unregister(id: string): boolean; get(id: string): WidgetDefinition | undefined; getAll(): WidgetDefinition[]; has(id: string): boolean; }
interface DataProviderRegistryApi { register(p: DataProviderDefinition): void; unregister(id: string): boolean; get(id: string): DataProviderDefinition | undefined; getAll(): DataProviderDefinition[]; }
interface ScreenRegistryApi { register(s: ScreenEntry): void; unregister(id: string): boolean; get(id: string): ScreenEntry | undefined; getAll(): ScreenEntry[]; }
interface PresetRegistryApi { register(p: DashboardPreset): void; unregister(id: string): boolean; get(id: string): DashboardPreset | undefined; getAll(): DashboardPreset[]; }
interface CommandRegistryApi { register(c: CommandDefinition): void; unregister(id: string): boolean; get(id: string): CommandDefinition | undefined; getAll(): CommandDefinition[]; }
interface SearchRegistryApi { register(a: SearchAdapter): void; unregister(id: string): boolean; get(id: string): SearchAdapter | undefined; getAll(): SearchAdapter[]; }
```

Это позволяет:
- **Sandbox/Test** — подмена реестров моками
- **Remote/Proxy** — реализация RegistryApi поверх IPC/gRPC
- **Multi-client** — каждый клиент получает RuntimeContext с привилегированным доступом

**Запрещено:**
- Импортировать конкретный класс реестра в модулях (ScreenRegistry, WidgetRegistry и т.д.). В модулях — только через `RuntimeContext.api.*`.

---

## IV. Composition over Implementation

Экраны ничего не создают. Они только собирают.

```
Screen
    ↓
Preset
    ↓
Widgets
```

Никакой бизнес-логики внутри Screen.

---

## V. Widget Independence

Каждый виджет обязан быть переносимым — регистрируемым в любом пресете без изменения самого виджета.

---

## VI. DataProvider Contract

Виджет не знает источник данных.

```
Widget
    ↓
DataProvider
    ↓
Runtime API
```

Сегодня Mock. Завтра REST. Потом WebSocket. Позже Replay. UI неизменен.

---

## VII. Bootstrap Contract

Единственная точка запуска платформы:

```typescript
PlatformBootstrap.initialize(modules: ClientModule[])
```

Где:

```typescript
interface ClientModule {
  id: string;                          // Уникальный идентификатор модуля
  version: string;                     // SemVer
  dependsOn?: string[];                // Модули, которые должны быть загружены раньше
  registerResources(ctx: RuntimeContext): void;   // Обязательно: регистрация DataProvider'ов, Widget'ов, команд
  registerPresentation?(ctx: RuntimeContext): void; // Опционально: экраны и пресеты (только для GUI-клиентов)
  unregister?(ctx: RuntimeContext): void;          // Опционально: очистка (hot-reload, shutdown)
}
```

**registerResources** вызывается всегда для всех клиентов (Workspace, Trading Lab, Headless, Mobile).
**registerPresentation** вызывается только для клиентов с UI.

Порядок загрузки определяется `dependsOn` (топологическая сортировка).

**Текущий порядок инициализации:**
1. `WorkspaceFoundationModule` (id: `workspace-foundation`) — generic-виджеты, builtin-команды, search-адаптеры, пресеты-заглушки
2. `OverviewModule` (id: `overview`)
3. `MarketsModule` (id: `markets`)
4. `SignalsModule` (id: `signals`)
5. `PortfolioModule` (id: `portfolio`)
6. `StrategiesModule` (id: `strategies`)
7. `ReplayModule` (id: `replay`)
8. `LearningModule` (id: `learning`)

---

## VIII. Frozen Runtime

Следующие компоненты — стабильные контракты:

| Компонент | Статус |
|-----------|--------|
| `ClientModule` | frozen v1.0 |
| `RuntimeContext` | frozen v1.0 |
| `RegistryApi` (6 интерфейсов) | frozen v1.0 |
| `DashboardRuntime` | frozen v1.0 |
| `DashboardShell` | frozen v1.0 |
| `Registry<T>` | frozen v1.0 |
| `PlatformBootstrap` | frozen v1.1 |
| `Runtime API` | frozen v1.0 |
| `Runtime SDK` | frozen v1.0 |

Изменения — только при смене версии контракта.

---

## IX. Module System Contract

### IX-a. Назначение

Module System — формальный контракт для изолированной регистрации функциональных возможностей.
Каждый модуль отвечает за **одну предметную область** (Markets, Overview, Signals, Portfolio, Replay и т.д.).

### IX-b. Разделение регистрации

- **registerResources** — регистрирует DataProvider'ы, Widget'ы, Command'ы, Search-адаптеры (нужно всем клиентам).
- **registerPresentation** — регистрирует Screen'ы и Preset'ы (нужно только GUI-клиентам).

Это позволяет Headless/Mobile/Cloud-клиентам не платить за UI.

### IX-c. RuntimeContext

```typescript
interface RuntimeContext {
  api: {
    widgets: WidgetRegistryApi;
    dataProviders: DataProviderRegistryApi;
    screens: ScreenRegistryApi;
    presets: PresetRegistryApi;
    commands: CommandRegistryApi;
    search: SearchRegistryApi;
  };
}
```

Модули не имеют прямого доступа к конкретным реестрам — только через абстракции.

### IX-d. dependsOn

Поле `dependsOn` определяет порядок загрузки:

```typescript
const modules: ClientModule[] = [
  WorkspaceFoundationModule,  // dependsOn: undefined — загружается первым
  OverviewModule,             // зависит от workspace-foundation
  MarketsModule,              // зависит от workspace-foundation
  ...
]
```

Топологическая сортировка выполняется в `PlatformBootstrap.initialize()`.

### IX-e. Инварианты Module System

1. Модуль **не может** импортировать другой модуль напрямую.
2. Модуль **может** использовать RegistryApi для регистрации.
3. Модуль **не может** модифицировать Runtime Kernel.
4. Stub-модуль (без реализации) должен быть заменяем на real-модуль без изменения ядра.
5. Добавление нового модуля **не требует** изменения существующих модулей или ядра.

---

## X. Platform Change Rule

> Изменение ядра (PlatformBootstrap, DashboardRuntime, Registry\<T\>, RuntimeContext, ClientModule контракт, RegistryApi интерфейсы) допустимо **только** если новая возможность не может быть реализована как ClientModule.

### X-a. Критерий проверки

При любой задаче Sprint 3.2+:

> Требует ли задача изменения PlatformBootstrap, DashboardRuntime, Registry, RuntimeContext или ClientModule?

- **Нет** → реализуется как ClientModule ✅ — архитектура выполняет свою задачу.
- **Да** → остановка и проверка: это новая фундаментальная возможность ядра или функциональность, которую можно реализовать внутри модуля?

### X-b. Обоснование

Phase 3.1 завершила формирование платформы. Дальнейшее развитие — Platform Expansion, а не Platform Construction. Каждый Sprint 3.2–3.10 развивается как отдельный ClientModule, регистрирующий свои ресурсы и представление через утверждённые контракты. Последний крупный рефакторинг позади.

---

## Критерий готовности Phase 3

> Если для реализации любого нового рабочего пространства (Markets, Replay Studio, Strategy Studio, Portfolio Studio и т.д.) требуется **только** зарегистрировать новые Screen, Preset, Widget и DataProvider **без изменения** Dashboard Runtime, PlatformBootstrap или Runtime Kernel — архитектура выдержала проверку.

---

> *Утверждено. Phase 3.1 — Dashboard Runtime & Module System. Platform Construction завершён. Platform Expansion начался.*
