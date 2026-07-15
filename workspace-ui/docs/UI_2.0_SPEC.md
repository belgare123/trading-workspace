# Workspace UI 2.0 — Design Specification

**Version:** 2.0  
**Status:** Draft → Ready

---

## Philosophy

Workspace — это не админ-панель.  
Workspace — профессиональный торговый терминал.  
Каждый экран должен отвечать на три вопроса:

- **Что происходит?**
- **Что важно прямо сейчас?**
- **Что я могу сделать одним кликом?**

---

## Visual Language

| ✅ Использовать | ❌ Не использовать |
|---|---|
| воздух | большие цветные кнопки |
| большие отступы | тяжёлые градиенты |
| тонкие границы | кислотные цвета |
| полупрозрачные панели | декоративные элементы |
| живые индикаторы | — |

Minimal · Professional · Data First · Glass · Motion · Realtime

---

## Color Tokens

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

---

## Radius

| Token | Value |
|-------|-------|
| `xs`  | 4px   |
| `sm`  | 8px   |
| `md`  | 12px  |
| `lg`  | 16px  |
| `xl`  | 20px  |

---

## Shadows

- **Card** — subtle shadow for cards
- **Panel** — elevated panels
- **Floating** — modals, dropdowns, popovers
- **Glow** — accent glow for active elements

---

## Typography

| Token      | Size  | Usage              |
|------------|-------|--------------------|
| `Display`  | 32px  | Page titles        |
| `Heading`  | 24px  | Section headings   |
| `Section`  | 18px  | Card headers       |
| `Body`     | 14px  | Default text       |
| `Small`    | 12px  | Labels, captions   |

---

## Layout

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

---

## Sidebar

| Property      | Value  |
|---------------|--------|
| Collapsed     | 72px   |
| Expanded      | 260px  |
| Items         | Dashboard, Scanner, Inspector, Replay, Strategies, Plugins, ML, System, Settings |

---

## Topbar

| Section        | Content                          |
|----------------|----------------------------------|
| Left           | Logo · Workspace                 |
| Center         | Search · Notifications · Commands|
| Right          | Runtime · WebSocket · Health · Clock |

---

## KPI Strip

| Metric    | Example   |
|-----------|-----------|
| Runtime   | 98%       |
| PnL       | +$12451   |
| Signals   | 42        |
| CPU       | 18%       |
| Events    | 2.4M      |
| Plugins   | 24        |

**Height:** 64px

---

## Dashboard Grid

- 12 columns
- Responsive
- Resizable
- Draggable
- Each element is a **Widget**

---

## Widget

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

---

## Trading Chart

- Candles · EMA · Volume · Signals · Trades · Replay · Crosshair

---

## Order Book

- Price · Bid · Ask · Spread · Depth

---

## Live Signals

```
┌──────────────────────┐
│  LONG    BTCUSDT     │
│  93%     Momentum    │
│          2m ago      │
│  -> Open Inspector   │
└──────────────────────┘
```

---

## Strategy Card

| Metric     |
|------------|
| Status     |
| PnL        |
| Trades     |
| Win Rate   |
| Latency    |
| CPU        |
| Memory     |

---

## Health Widget

- Gauge · 98% · Services · CPU · Memory · SQLite · WebSocket

---

## Timeline

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

---

## Inspector

Right panel with:

- Object · Properties · Trace · JSON · Events · Actions

---

## Command Palette

- `Ctrl+K`
- Search...
- Go Scanner · Replay · Plugins · Health · Strategy

---

## Search

- `Ctrl+Shift+F`
- Search across: Strategies · Signals · Models · Plugins · Events · Replay

---

## Notifications

- Bottom Right corner
- Success · Warning · Error · Info
- Auto close

---

## Animations

| Element     | Type          | Duration |
|-------------|---------------|----------|
| Card        | Fade · Scale  | 180ms    |
| Panel       | Slide         | 220ms    |
| Widget      | Opacity · Xfrm| 200ms    |
| Timeline    | Live pulse    | —        |

---

## States

| State    | Visual                           |
|----------|----------------------------------|
| Loading  | Skeleton                         |
| Empty    | Illustration + Action             |
| Error    | Retry + Details                   |
| Offline  | Reconnect                         |

---

## Glass Style

```css
background: rgba(20, 24, 31, 0.75);
backdrop-filter: blur(18px);
border: 1px solid rgba(255, 255, 255, 0.05);
```

---

## Widget Toolbar

Pin · Refresh · Fullscreen · Move · Settings · Close

---

## Responsive Breakpoints

| Device  | Width   |
|---------|---------|
| Desktop | ≥ 1600px |
| Laptop  | 1440px   |
| Tablet  | 1024px   |
| Mobile  | Companion UI |

---

## Motion Timing

| Trigger     | Duration |
|-------------|----------|
| Hover       | 120ms    |
| Open        | 200ms    |
| Page        | 250ms    |
| Modal       | 180ms    |
| Notification| 300ms    |

---

## Accessibility

- Focus Ring
- Keyboard Navigation
- Screen Reader Labels
- Reduced Motion
- High Contrast

---

## Widget SDK

Every widget must implement:

```ts
interface Widget {
  id: string;
  title: string;
  icon: ReactNode;
  defaultSize: Size;
  render(props): JSX.Element;
}
```

---

## Runtime Contract

**Forbidden** inside widgets:

- `fetch()`
- `axios()`
- `WebSocket()`

**Allowed** (via runtime SDK):

- `runtime.market()`
- `runtime.strategy()`
- `runtime.plugin()`
- `runtime.eventStore()`
- `runtime.events()`

---

## Design Principles

1. **Data First** — every pixel has a purpose
2. **Minimal Visual Noise** — remove everything non-essential
3. **One Click Actions** — no buried menus for common tasks
4. **Smooth Motion** — intentional, not decorative
5. **Consistent Components** — one component, one way
6. **Runtime Driven** — UI is a reflection of runtime state
7. **Plugin Friendly** — third-party widgets are first-class
8. **Keyboard First** — every action has a shortcut
9. **Dark First** — dark mode is the default, light is opt-in
10. **Performance First** — 60fps or bust
