# Chart Studio v1.0 Freeze Review

> Дата фиксации: 2026-07-16
> Sprint: 3.3.8 (Trading Overlay Pack)
> Ветка: `develop/runtime-api`
> База: Workspace Platform — Runtime Kernel v2.0 + Dashboard Runtime v1.0

---

## 1. Архитектурная сводка

Chart Studio построена по единому универсальному паттерну **Extension Pattern**:

```
Definition → Registry → Runtime → Renderer
```

Этот паттерн применён для всех четырёх подсистем Chart Studio без исключения:

### 1.1 Indicator Engine

```
IndicatorDefinition → IndicatorRegistry → IndicatorRuntime → IndicatorRenderer
```

| Компонент | Роль |
|-----------|------|
| `IndicatorDefinition` | Контракт: `id`, `name`, `minInputs`, `maxInputs`, `calculate()` |
| `IndicatorRegistry` | Реестр определений, загрузка builtins, lazy init |
| `IndicatorRuntime` | Жизненный цикл экземпляров, пересчёт, кэширование |
| `IndicatorRenderer` | Рендеринг на canvas (связка с PaneRenderer) |

### 1.2 Drawing Engine

```
DrawingDefinition → DrawingRegistry → DrawingRuntime → OverlayRenderer
```

| Компонент | Роль |
|-----------|------|
| `DrawingDefinition` | Контракт: `id`, `name`, `hitTest`, `render`, anchors |
| `DrawingRegistry` | Реестр определений, поиск по id/name |
| `DrawingRuntime` | Управление экземплярами (CRUD, undo, selection) |
| `OverlayRenderer` | Совместный рендеринг Drawing + Overlay |

### 1.3 Overlay Engine

```
OverlayDefinition → OverlayRegistry → OverlayRuntime → OverlayRenderer
```

| Компонент | Роль |
|-----------|------|
| `OverlayDefinition` | Контракт: `id`, `name`, `category`, `render()`, `hitTest?()` |
| `OverlayRegistry` | Реестр определений, get-by-id, builtins registration |
| `OverlayRuntime` | Жизненный цикл экземпляров (add/remove/clear/replaceType) |
| `OverlayRenderer` | Render loop — проходит visible instances и вызывает `render()` |

### 1.4 Pane Engine

```
PaneDefinition → PaneRegistry → PaneRuntime → PaneRenderer
```

| Компонент | Роль |
|-----------|------|
| `PaneDefinition` | Контракт: `id`, `name`, `renderContent()` |
| `PaneRegistry` | Реестр типов панелей |
| `PaneRuntime` | Композиция панелей, layout, синхронизация |
| `PaneRenderer` | Canvas-композитор (multi-pane rendering pipeline) |

---

## 2. Статистика

### 2.1 Реестры

| Registry | Count | Описание |
|----------|-------|----------|
| `IndicatorRegistry` | 7 builtins | RSI, MACD, SMA, EMA, Bollinger, Volume, Stochastic |
| `DrawingRegistry` | 6 builtins | TrendLine, HorizontalLine, VerticalLine, FibRetracement, Rectangle, Ray |
| `OverlayRegistry` | **25 builtins** | См. п.2.2 |
| `PaneRegistry` | — | Builtin панели (Main, RSI, MACD) |

### 2.2 Overlay библиотека (25 overlaid)

#### Core (7) — Sprint 3.3.6

| id | name | category | Тип |
|----|------|----------|-----|
| `price-marker` | Price Marker | `price` | Horizontal |
| `order-marker` | Order Marker | `trade` | Horizontal |
| `position-marker` | Position Marker | `position` | Composite |
| `execution-marker` | Execution Marker | `execution` | Timeline |
| `alert-marker` | Alert Marker | `event` | Horizontal |
| `volume-profile` | Volume Profile | `volume` | Mini-renderer |
| `session-box` | Session Box | `session` | Rectangle |

#### Trading (9) — Sprint 3.3.8

| id | name | category | Тип |
|----|------|----------|-----|
| `stop-loss` | Stop Loss | `trade` | Horizontal |
| `take-profit` | Take Profit | `trade` | Horizontal |
| `pending-order` | Pending Order | `trade` | Horizontal |
| `liquidation-price` | Liquidation Price | `position` | Horizontal |
| `bracket-order` | Bracket Order | `trade` | **Composite** |
| `trailing-stop` | Trailing Stop | `custom` | **Stateful** |
| `risk-reward` | Risk/Reward | `custom` | **Computational** |
| (2 core trading from Sprint 3.3.6) | | | |

#### Analysis (8) — Sprint 3.3.8

| id | name | category | Тип |
|----|------|----------|-----|
| `value-area` | Value Area | `volume` | Multi-line (VAH/POC/VAL) |
| `vwap-band` | VWAP Band | `price` | Multi-line (VWAP ±1σ ±2σ) |
| `opening-range` | Opening Range | `session` | **Rectangle** |
| `initial-balance` | Initial Balance | `session` | Rectangle |
| `volume-nodes` | Volume Nodes | `volume` | **Mini-renderer** (HVN/LVN) |
| `anchored-vwap` | Anchored VWAP | `price` | Multi-line + Anchor |
| (2 core analysis from Sprint 3.3.6) | | | |

#### Market (6) — Sprint 3.3.8

| id | name | category | Тип |
|----|------|----------|-----|
| `news-event` | News Event | `event` | Timeline |
| `economic-calendar` | Economic Calendar | `event` | Timeline |
| `earnings` | Earnings | `event` | Timeline |
| `dividend-split` | Dividend/Split | `event` | Timeline |
| `funding-rate` | Funding Rate | `event` | Timeline |
| (1 core market from Sprint 3.3.6) | | | |

### 2.3 Runtime Engine

| Runtime | Описание |
|---------|----------|
| `IndicatorRuntime` | Lifecycle, calc scheduling, cache |
| `DrawingRuntime` | CRUD, undo/redo, selection, serialization |
| `OverlayRuntime` | add/remove/clear/replaceType |
| `SynchronizationRuntime` | Cross-pane sync (time & price scales) |
| `InteractionRuntime` | Pointer routing, drag state, hit-test dispatch |
| `PaneRuntime` | Pane composition, layout, resize |

### 2.4 Render Pipeline

```
CompositionEngine
  └─ PaneRenderer (orchestrator)
      ├─ IndicatorRenderer (indicators per pane)
      └─ OverlayRenderer (drawings + overlays per pane)
```

### 2.5 Build metrics

| Metric | Sprint 3.3.6 | Sprint 3.3.8 | Δ |
|--------|-------------|-------------|---|
| Modules (vite) | ~2110 | 2248 | +138 |
| Build time | ~290ms | 300ms | +10ms |
| Bundle (gzip) | ~138KB | 144KB | +6KB |
| tsc errors | 0 | 0 | — |

---

## 3. Frozen Components

Следующие компоненты объявляются **frozen** в v1.0. Изменения допускаются только через Platform Change Rule (расширение или регистрация, не модификация ядра):

### 3.1 Runtime Kernel

| Компонент | Статус |
|-----------|--------|
| `CompositionEngine` | ✅ **Frozen** — последнее изменение: Sprint 3.3.4 |
| `RenderLoop` | ✅ **Frozen** |
| `PaneRenderer` (orchestrator) | ✅ **Frozen** — добавлена интеграция OverlayRenderer |
| `TimeScale` | ✅ **Frozen** |
| `PriceScale` | ✅ **Frozen** |

### 3.2 Chart Runtime

| Компонент | Статус |
|-----------|--------|
| `ChartRuntime` | ✅ **Frozen** — композиция подсистем |
| `IndicatorRuntime` | ✅ **Frozen** |
| `IndicatorRegistry` | ✅ **Frozen** |
| `IndicatorRenderer` | ✅ **Frozen** |

### 3.3 Drawing Engine

| Компонент | Статус |
|-----------|--------|
| `DrawingRuntime` | ✅ **Frozen** — все CRUD, undo/redo |
| `DrawingRegistry` | ✅ **Frozen** |
| `DrawingDefinition` (interface) | ✅ **Frozen** |

### 3.4 Overlay Engine

| Компонент | Статус |
|-----------|--------|
| `OverlayRuntime` | ✅ **Frozen** |
| `OverlayRegistry` | ✅ **Frozen** |
| `OverlayRenderer` | ✅ **Frozen** |
| `OverlayDefinition` (interface) | ✅ **Frozen** |
| `OverlayInstance` (class) | ✅ **Frozen** |
| `OverlayPosition` / `OverlayRenderContext` / `OverlayCategory` | ✅ **Frozen** |

### 3.5 Interaction

| Компонент | Статус |
|-----------|--------|
| `InteractionRuntime` | ✅ **Frozen** |
| `HitTestEngine` | ✅ **Frozen** |

### 3.6 Pane System

| Компонент | Статус |
|-----------|--------|
| `PaneRuntime` | ✅ **Frozen** |
| `PaneRegistry` | ✅ **Frozen** |
| `PaneDefinition` (interface) | ✅ **Frozen** |
| `PaneLayout` | ✅ **Frozen** |

---

## 4. Публичный API: CHART_STUDIO_API

```typescript
interface ChartStudioAPI {
  // ── Indicators ──
  indicators: {
    registry: IndicatorRegistry
    runtime: IndicatorRuntime
    builtins: readonly string[]  // ids of all registered indicator definitions
  }

  // ── Drawings ──
  drawings: {
    registry: DrawingRegistry
    runtime: DrawingRuntime
    builtins: readonly string[]
  }

  // ── Overlays ──
  overlays: {
    registry: OverlayRegistry
    runtime: OverlayRuntime
    builtins: readonly string[]
  }

  // ── Panes ──
  panes: {
    registry: PaneRegistry
    runtime: PaneRuntime
  }

  // ── Rendering ──
  renderer: {
    view: PaneRenderer
    compose: CompositionEngine
    sync: SynchronizationRuntime
  }

  // ── Interaction ──
  interaction: {
    runtime: InteractionRuntime
    hitTest: HitTestEngine
  }

  // ── Core Services ──
  services: {
    chart: ChartRuntime
    lifecycle: LifecycleService
    timeScale: TimeScale
    priceScale: PriceScale
  }
}
```

Все компоненты API неизменны для v1.0. Новые возможности добавляются через расширение (новые Definition, новые Registry entries), а не через модификацию публичных интерфейсов.

---

## 5. Verification Checklist

✅ **Extension Pattern universal** — все 4 подсистемы (Indicator, Drawing, Overlay, Pane) следуют Definition → Registry → Runtime → Renderer

✅ **Overlay variety** — 7 типов объектов через единый контракт:
- Horizontal line (PriceLineOverlayBase)
- Composite (BracketOrder)
- Rectangle (OpeningRange)
- Multi-line (VWAPBand, ValueArea)
- Mini-renderer (VolumeNodes)
- Timeline (EventOverlayBase)
- Computational (RiskReward, TrailingStop)

✅ **Runtime not modified** — ни один Sprint 3.3.8 commit не меняет:
- OverlayRuntime, OverlayRenderer, OverlayRegistry
- InteractionRuntime, HitTestEngine
- IndicatorRuntime, IndicatorRenderer, IndicatorRegistry
- DrawingRuntime, DrawingRegistry
- PaneRuntime, PaneRegistry
- CompositionEngine, RenderLoop
- ChartRuntime, TimeScale, PriceScale

✅ **Zero TypeScript errors** — `tsc -b --noEmit` passes

✅ **Zero build errors** — `vite build` passes (2248 modules, ~300ms)

✅ **Platform Change Rule** — все изменения в Sprint 3.3.8 — это новые файлы (определения + barrel), ни один runtime-файл не изменён

---

## 6. Baseline для будущих спринтов

### Sprint 3.3.9+ возможности (через расширение)

| Возможность | Механизм |
|-------------|----------|
| Новые overlay  | `OverlayDefinition` → регистрация в `OverlayRegistry` |
| Новые drawing  | `DrawingDefinition` → регистрация в `DrawingRegistry` |
| Новые indicator | `IndicatorDefinition` → регистрация в `IndicatorRegistry` |
| Новые pane      | `PaneDefinition` → регистрация в `PaneRegistry` |
| Interaction overlay | `hitTest` в определении + существующий HitTestEngine |
| TrailingStop data feed | Внешний сервис → `OverlayRuntime.replaceType()` |
| FundingRate mini-graph | Новый overlay с расширенным render (v1.x) |
| AnchoredVWAP anchor selection | `InteractionRuntime` (без изменения публичного API) |

---

*Freeze подтверждён: архитектура проверена на 8 классах объектов, runtime не изменён, сборка 0 errors.*
