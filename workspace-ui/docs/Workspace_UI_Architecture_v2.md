# Workspace UI Architecture v2

**Version:** 2.0  
**Status:** Draft → Ready  
**Scope:** Design System · UI Runtime Contract · UX Guidelines

---

## Table of Contents

1. [Design System](#part-1--design-system)
2. [UI Runtime Contract](#part-2--ui-runtime-contract)
3. [UX Guidelines](#part-3--ux-guidelines)

---

# Part 1 · Design System

## 1.1 Philosophy

Workspace — это не админ-панель.  
Workspace — профессиональный торговый терминал.

Каждый экран должен отвечать на три вопроса:
- **Что происходит?**
- **Что важно прямо сейчас?**
- **Что я могу сделать одним кликом?**

## 1.2 Visual Language

| ✅ Использовать | ❌ Не использовать |
|---|---|
| воздух | большие цветные кнопки |
| большие отступы | тяжёлые градиенты |
| тонкие границы | кислотные цвета |
| полупрозрачные панели | декоративные элементы |
| живые индикаторы | избыточные тени |

Minimal · Professional · Data First · Glass · Motion · Realtime

## 1.3 Color Tokens

```css
:root {
  --bg:              #09090B;
  --surface:         #111317;
  --surface-raised:  #171A20;
  --surface-hover:   #1E222B;
  --border:          #272C36;
  --primary:         #5B8DEF;
  --success:         #22C55E;
  --warning:         #F59E0B;
  --danger:          #EF4444;
  --text:            #F5F7FA;
  --text-secondary:  #9AA4B2;
  --text-muted:      #6B7280;
}
```

### Accent rules

- **Максимум два акцентных цвета одновременно** на одном экране.
  - ✅ `Blue + Green` или `Blue + Orange`
  - ❌ `Blue + Green + Orange + Red + Purple`
- **Один главный CTA** — на панели только одна кнопка Primary. Все остальные Secondary.

## 1.4 Radius

| Token | Value |
|-------|-------|
| `xs`  | 4px   |
| `sm`  | 8px   |
| `md`  | 12px  |
| `lg`  | 16px  |
| `xl`  | 20px  |

## 1.5 Shadows

- **Card** — subtle shadow for cards
- **Panel** — elevated panels
- **Floating** — modals, dropdowns, popovers
- **Glow** — accent glow for active elements

## 1.6 Typography

| Token      | Size  | Weight | Usage              |
|------------|-------|--------|--------------------|
| `Display`  | 32px  | 700    | Page titles        |
| `Heading`  | 24px  | 600    | Section headings   |
| `Section`  | 18px  | 600    | Card headers       |
| `Body`     | 14px  | 400    | Default text       |
| `Small`    | 12px  | 400    | Labels, captions   |

- **Data values** — JetBrains Mono (monospace)
- **UI text** — Inter (sans-serif)

## 1.7 Layout

```
┌─────────────────────────────────────────────────────────────┐
│                         Topbar                               │
├──────────┬────────────────────────────┬─────────────────────┤
│          │                            │                      │
│ Sidebar  │      Main Workspace        │      Inspector       │
│          │                            │                      │
├──────────┴────────────────────────────┴─────────────────────┤
│                        Status Bar                            │
└─────────────────────────────────────────────────────────────┘
```

### Layout nesting rule

**Максимум три уровня вложенности** в любой панели:

```
❌ Panel → Card → Card → Widget → Card
✅ Panel → Widget → Content
```

### Sidebar

| Property      | Value  |
|---------------|--------|
| Collapsed     | 72px   |
| Expanded      | 260px  |
| Items         | Dashboard, Scanner, Inspector, Replay, Strategies, Plugins, ML, System, Settings |

### Topbar

| Section        | Content                          |
|----------------|----------------------------------|
| Left           | Logo · Workspace                 |
| Center         | Search · Notifications · Commands|
| Right          | Runtime · WebSocket · Health · Clock |

### KPI Strip

**Height:** 64px

| Metric    | Example   |
|-----------|-----------|
| Runtime   | 98%       |
| PnL       | +$12451   |
| Signals   | 42        |
| CPU       | 18%       |
| Events    | 2.4M      |
| Plugins   | 24        |

### Status Bar

Height: 32px · Slots: left / center / right

## 1.8 Glass Style

```css
background: rgba(20, 24, 31, 0.75);
backdrop-filter: blur(18px);
border: 1px solid rgba(255, 255, 255, 0.05);
```

## 1.9 Dashboard Grid

- 12 columns
- Responsive
- Resizable
- Draggable
- Each element is a **Widget**

### Dashboard Presets

```ts
interface DashboardPreset {
  id: string;
  title: string;
  description: string;
  widgets: { widgetId: string; size: WidgetSize; position: GridPosition }[];
  permissions: string[];
}
```

| Preset      | Focus                |
|-------------|----------------------|
| Overview    | Health, KPI, Events  |
| Trading     | Chart, OrderBook, Signals |
| Research    | Timeline, Inspector, ML |
| Monitoring  | System, Logs, Plugins |

## 1.10 Widget

```
╭──────────────────────────────╮
│           Header             │
│      Icon · Title · Status   │
│──────────────────────────────│
│           Toolbar            │
│     Pin · Refresh · FS · Menu│
│──────────────────────────────│
│           Content            │
│──────────────────────────────│
│           Footer             │
╰──────────────────────────────╯
```

### Widget Size Contract

```ts
enum WidgetSize {
  SMALL,   // 2 columns
  MEDIUM,  // 4 columns
  LARGE,   // 6 columns
  XL,      // 8 columns
  FULL,    // 12 columns
}

// Recommended sizes by widget type:
// Health        → SMALL
// KPI Strip     → FULL
// Trading Chart → LARGE / XL
// OrderBook     → MEDIUM
// Live Signals  → MEDIUM
// Timeline      → FULL
// Event Store   → MEDIUM
// Plugins       → SMALL
// Inspector     → LARGE (as panel)
```

### Widget Categories

```ts
type WidgetCategory =
  | 'analysis'
  | 'trading'
  | 'portfolio'
  | 'market'
  | 'system'
  | 'monitoring'
  | 'replay'
  | 'plugins'
  | 'ml';
```

### Widget Toolbar

Pin · Refresh · Fullscreen · Move · Settings · Close

## 1.11 Component Library

### Trading Chart

Candles · EMA · Volume · Signals · Trades · Replay · Crosshair

### Order Book

Price · Bid · Ask · Spread · Depth

### Live Signals

```
┌──────────────────────┐
│  LONG    BTCUSDT     │
│  93%     Momentum    │
│          2m ago      │
│  -> Open Inspector   │
└──────────────────────┘
```

### Strategy Card

| Metric     |
|------------|
| Status     |
| PnL        |
| Trades     |
| Win Rate   |
| Latency    |
| CPU        |
| Memory     |

### Health Widget

Gauge · 98% · Services · CPU · Memory · SQLite · WebSocket

### Timeline

```
● Signal Created
  ↓
○ Trade Opened
  ↓
● Trade Closed
  ↓
○ Replay Saved
```

**Supported:** Filter · Jump · Replay · Export

### Inspector

Right panel with: Object · Properties · Trace · JSON · Events · Actions

## 1.12 Animations

| Element     | Type          | Duration |
|-------------|---------------|----------|
| Card        | Fade · Scale  | 180ms    |
| Panel       | Slide         | 220ms    |
| Widget      | Opacity · Xfrm| 200ms    |
| Timeline    | Live pulse    | —        |
| Hover       | Transform     | 120ms    |
| Open        | Scale + Fade  | 200ms    |
| Page        | Fade + Slide  | 250ms    |
| Modal       | Scale + Fade  | 180ms    |
| Notification| Slide + Fade  | 300ms    |

---

# Part 2 · UI Runtime Contract

## 2.1 Architecture

```
Clients
│
├── Workspace Desktop  ← this spec
├── Workspace Web
├── Trading Lab
├── Mobile
├── Cloud Console
├── CLI
└── Embedded Panels
```

**Все клиенты используют единый Runtime SDK и не обращаются к Trading Core напрямую.**

```
Runtime
   │
   ▼
   SDK
   │
   ▼
Registry
   │
   ▼
Widget / Plugin
   │
   ▼
   User
```

**Никогда:** `Widget → fetch() → Core`

## 2.2 Widget Lifecycle

Каждый виджет проходит полный жизненный цикл:

```
Created
   │
   ▼
Mounted
   │
   ▼
Ready
   │
   ▼
Running
   │
   ▼
Sleeping
   │
   ▼
Hidden
   │
   ▼
Destroyed
```

### Lifecycle events

```ts
interface WidgetLifecycle {
  onMount(): void;     // DOM added, first render
  onReady(): void;     // data loaded, interactive
  onResize(size: WidgetSize): void;
  onFocus(): void;     // widget received keyboard focus
  onBlur(): void;      // widget lost keyboard focus
  onSuspend(): void;   // widget moved to background (tab switch)
  onResume(): void;    // widget returned to foreground
  onDestroy(): void;   // widget removed, cleanup
}
```

Любой внешний или внутренний виджет реализует этот интерфейс. Runtime вызывает эти события, виджет реагирует (паузит подписки на suspend, перезапрашивает данные на resume и т.д.).

## 2.3 Widget SDK

```ts
interface Widget {
  id: string;
  title: string;
  icon: ReactNode;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  render(props: WidgetProps): JSX.Element;
  // optional lifecycle
  onMount?(): void;
  onReady?(): void;
  onResize?(size: WidgetSize): void;
  onSuspend?(): void;
  onResume?(): void;
  onDestroy?(): void;
}
```

## 2.4 Runtime Contract

### Запрещено внутри виджетов / плагинов

- `fetch()` / `axios()` — прямой HTTP
- `WebSocket()` — прямой сокет
- Ломать **layout** (менять размеры, добавлять панели)
- Менять **тему**
- Менять **sidebar**
- Менять **topbar**
- Менять **runtime**

### Разрешено (через Runtime SDK)

- `runtime.market()` — рыночные данные
- `runtime.strategy()` — стратегии
- `runtime.plugin()` — другие плагины
- `runtime.eventStore()` — события
- `runtime.events()` — подписка на события

### Что плагин может регистрировать

- **Widget** — новый виджет в палитру
- **Command** — команда в Command Palette
- **Search Adapter** — провайдер для глобального поиска
- **Timeline Source** — источник событий для Timeline
- **Panel** — дополнительная панель (только в разрешённые зоны)

## 2.5 Registry

Центральный реестр виджетов и плагинов:

```ts
interface Registry {
  register(widget: Widget): void;
  unregister(id: string): void;
  get(id: string): Widget | undefined;
  list(category?: WidgetCategory): Widget[];
}
```

## 2.6 Command Palette

- `Ctrl+K`
- Search across all commands
- `Go Scanner`, `Go Replay`, `Go Plugins`, `Go Health`, `Go Strategy`

## 2.7 Global Search

- `Ctrl+Shift+F`
- Unified search across: Strategies · Signals · Models · Plugins · Events · Replay

## 2.8 Notifications

- Position: Bottom Right
- Types: Success · Warning · Error · Info
- Auto-close after timeout
- Stackable

---

# Part 3 · UX Guidelines

## 3.1 Design Rules

### Layout nesting

**Максимум три уровня вложенности** в любой панели:
- ❌ `Panel → Card → Card → Widget → Card`
- ✅ `Panel → Widget → Content`

### Accent color limit

**Не больше двух акцентных цветов** одновременно на экране:
- ✅ `Blue + Green` или `Blue + Orange`
- ❌ `Blue + Green + Orange + Red + Purple`

### One primary CTA

На панели должна быть **только одна кнопка Primary**. Все остальные — Secondary.

## 3.2 Status Language

Единый словарь статусов для всего Workspace:

| Status     | Usage                          |
|------------|--------------------------------|
| `Ready`    | Ожидает действий пользователя  |
| `Running`  | Активно работает               |
| `Paused`   | Приостановлено пользователем   |
| `Stopped`  | Остановлено                    |
| `Loading`  | Загружается                    |
| `Failed`   | Ошибка выполнения              |
| `Warning`  | Требует внимания               |
| `Offline`  | Нет соединения                 |
| `Unknown`  | Статус не определён            |

**Не использовать:**
- ❌ Working, Started, Alive, Good, Healthy (для статусов), Done
- Использовать одно слово из словаря выше

## 3.3 Empty State Guidelines

Каждый Empty State состоит из 4 элементов:

```
┌──────────────────────────┐
│          Icon            │
│         Title            │
│       Description        │
│  [Primary Action]        │
│  Optional Secondary      │
└──────────────────────────┘
```

### Примеры

| Context      | Icon | Title          | Description               | Action            |
|--------------|------|----------------|---------------------------|-------------------|
| No Signals   | 📡   | No Signals     | Waiting for market data   | Connect Scanner   |
| No Plugins   | 🧩   | No Plugins     | Marketplace is empty      | Browse Store      |
| No Trades    | 📊   | No Trades      | No active positions       | Open Scanner      |
| No Events    | 🕐   | No Events      | Timeline is empty         | Start Replay      |
| Search Empty | 🔍   | No Results     | Try different query       | Clear Filters     |

## 3.4 Error UX

Уровни ошибок и требуемые действия:

| Level         | Visual              | User action                 |
|---------------|---------------------|-----------------------------|
| `Info`        | Toast notification  | None (informational)        |
| `Warning`     | Toast + badge       | Optional dismiss            |
| `Recoverable` | Inline error card   | Retry button + details      |
| `Critical`    | Full panel overlay  | Retry + Support link        |
| `Fatal`       | App-level error     | Reload + Report             |

### Widget error states

- **Loading** → skeleton
- **Empty** → illustration + action
- **Error** → retry + details
- **Offline** → reconnect button

## 3.5 Performance Budget

| Metric              | Budget    | Notes                          |
|---------------------|-----------|--------------------------------|
| Initial JS bundle   | < 300 KB  | Code-split by page             |
| Time to Interactive | < 1 sec   | Measured on desktop            |
| Widget mount        | < 50 ms   | Per widget                     |
| Panel animation     | < 16 ms   | 60 fps                         |
| Search              | < 100 ms  | Inclusive of network           |
| Command Palette     | < 50 ms   | Local only                     |

## 3.6 Accessibility

- Focus Ring — visible keyboard focus on all interactive elements
- Keyboard Navigation — all actions reachable via keyboard
- Screen Reader Labels — `aria-label` on all icon-only controls
- Reduced Motion — respect `prefers-reduced-motion`
- High Contrast — support Windows High Contrast Mode

## 3.7 Responsive Breakpoints

| Device  | Width   | Layout                     |
|---------|---------|----------------------------|
| Desktop | ≥ 1600px | Full layout + Inspector    |
| Laptop  | 1440px  | Full layout                |
| Tablet  | 1024px  | Collapsed sidebar, overlay |
| Mobile  | < 768px | Companion UI (separate)    |

---

## Appendix A · Future Clients

Workspace — один из нескольких клиентов Runtime Kernel:

```
                     ┌─────────────────────┐
                     │    Runtime Kernel    │
                     │  (Trading Core + SDK)│
                     └──────────┬──────────┘
                                │
                    ┌───────────┴───────────┐
                    │    Runtime SDK (REST)  │
                    └───────────┬───────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                       │
         ▼                      ▼                       ▼
  ┌────────────┐        ┌──────────────┐       ┌──────────────┐
  │ Workspace  │        │  Trading Lab │       │    Mobile    │
  │  Desktop   │        │   (Jupyter)  │       │   Companion  │
  ├────────────┤        ├──────────────┤       ├──────────────┤
  │ Workspace  │        │  Cloud CLI   │       │ Embedded Pan │
  │    Web     │        │  (terminal)  │       │    (iframe)  │
  └────────────┘        └──────────────┘       └──────────────┘
```

Все клиенты:

1. Используют единый **Runtime SDK**
2. Не обращаются к **Trading Core** напрямую
3. Регистрируют свои Widget'ы через **Registry**
4. Следуют этому архитектурному контракту

---

## Appendix B · Design Principles (Summary)

1. **Data First** — every pixel has a purpose
2. **Minimal Visual Noise** — remove everything non-essential
3. **One Click Actions** — no buried menus for common tasks
4. **Smooth Motion** — intentional, not decorative
5. **Consistent Components** — one component, one way
6. **Runtime Driven** — UI is a reflection of runtime state
7. **Plugin Friendly** — third-party widgets are first-class citizens
8. **Keyboard First** — every action has a shortcut
9. **Dark First** — dark mode is the default, light is opt-in
10. **Performance First** — 60fps or bust

---

*Workspace UI Architecture v2 · 2026-07-15*
