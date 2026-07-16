# Chart Studio Architecture

> **Status:** Draft  
> **Last updated:** 2026-07-16  

---

## 1. Overview

Chart Studio — подсистема визуализации рыночных данных в составе Workspace.  
Реализует архитектуру **Model → Renderer → Interaction**, где каждый слой имеет строгую ответственность и не проникает в соседние.

```
ChartRuntime
     │
     ├── CandleEngine
     │       │
     │       ├── CandleProvider
     │       ├── CandleRenderer
     │       └── CandleInteraction*
     │
     ├── IndicatorEngine
     │       │
     │       ├── IndicatorDefinition
     │       ├── IndicatorRegistry
     │       ├── IndicatorRuntime
     │       ├── IndicatorRenderer
     │       └── IndicatorInteraction*
     │
     ├── DrawingEngine
     │       │
     │       ├── DrawingDefinition
     │       ├── DrawingRegistry
     │       ├── DrawingRuntime
     │       ├── DrawingRenderer
     │       └── DrawingInteraction (Sprint 3.3.5)
     │
     ├── OverlayEngine*
     ├── AnnotationEngine*
     └── MarketplaceTools*

* — запланированы
```

Каждый Engine следует одному и тому же шаблону расширения.

---

## 2. Universal Extension Pattern

```
Definition
     │
     ▼
  Registry
     │
     ▼
  Runtime
     │
     ▼
 Renderer
     │
     ▼
 Interaction
```

### Layer responsibilities

| Layer | Responsibility | Prohibited |
|-------|---------------|------------|
| **Definition** | Describes extension type and rendering algorithm | State, UI, side effects |
| **Registry** | Discovers and enumerates available extensions | Instance management, rendering |
| **Runtime** | Owns instances, serialisation, undo/redo lifecycle | UI logic, pixel coordinates, interaction |
| **Renderer** | Converts model coordinates to screen pixels | Hit-testing, selection, drag, resize |
| **Interaction** | Handles input: hit-test, select, drag, resize, snap | Model mutation outside runtime API |

---

## 3. Drawing Engine Layering (Invariant)

The Drawing subsystem is **strictly layered**:

```
DrawingDefinition
        │
        ▼
 DrawingRegistry
        │
        ▼
 DrawingRuntime
        │
        ▼
 DrawingRenderer
        │
        ▼
InteractionEngine (Sprint 3.3.5)
```

### Layer Responsibilities

**DrawingDefinition**
- Declares the drawing type (`id`, `name`, `category`).
- Provides `create(anchor)` — creates an instance at a market-coordinate anchor.
- Provides `render(ctx, instance, style)` — stateless drawing algorithm on canvas.

**DrawingRegistry**
- Singleton registry of available drawing types.
- `register(def)` / `get(id)` / `list(category?)` / `categories()`.

**DrawingRuntime**
- Owns all `DrawingInstance` objects (add, remove, duplicate, clear).
- Manages undo/redo via snapshot stack (`serialize()` / `deserialize()`).
- `getVisible()` — filter for rendering (only visible instances).
- **MUST NOT** contain UI interaction logic (selection, drag, resize, hit-test).

**DrawingRenderer**
- Implementation of `CanvasLayer` that participates in the render loop.
- Calls `runtime.getVisible()`, then `definition.render()` for each visible instance.
- Provides the `DrawingRenderContext` (time/pixel conversion, DPR, dimensions).
- **MUST NOT** perform hit-testing, selection, drag, or resize logic.

**InteractionEngine** (Sprint 3.3.5+)
- Owns hit-testing against rendered drawings.
- Manages selection state, drag controllers, resize handles.
- Manages cursor feedback and snap-to-grid / snap-to-price behaviour.
- Uses `DrawingRuntime` for model updates and `DrawingRenderer` for visual feedback.
- **MUST NOT** bypass the Runtime to modify instances directly.

### Invariant A — Runtime Independence

```
DrawingRuntime ──→ DrawingRenderer ✗

Runtime   → internal state only
Renderer  → reads runtime.getVisible()
```

DrawingRuntime **never depends on** DrawingRenderer.  
The dependency flows **one way** only: Renderer → Runtime.

### Invariant B — Renderer / Interaction Separation

```
DrawingRenderer ──→ InteractionEngine ✗

Renderer      → pixel output only
Interaction   → input processing only
```

DrawingRenderer **never performs interaction logic**.  
Interaction Engine is a separate layer that sits below Renderer in the processing pipeline, not inside it.

### Why this order

| Concern | Where it lives | Why not elsewhere |
|---------|---------------|-------------------|
| Drawing type catalog | Registry | Cross-cutting discovery |
| Instance lifecycle | Runtime | Coordinates + visibility are model concerns |
| Pixel math | Renderer | Only renderer has canvas context |
| Hit-testing | Interaction | Requires rendered geometry, not model state |

### Architectural Regression

**Violation of this layering is considered an architectural regression.**  
Examples of regressions that must be caught in code review:

- Adding hit-testing logic to `DrawingRenderer`
- Calling `render()` from inside `DrawingRuntime`
- Adding selection state to `DrawingInstance`
- Bypassing `DrawingRuntime` to mutate instances from Interaction code

---

## 4. Data Flow

```
User Input
     │
     ▼
InteractionEngine         ← Sprint 3.3.5
     │
     ▼
DrawingRuntime            ← add / remove / update
     │
     ▼
DrawingRenderer           ← getVisible() → render()
     │
     ▼
Canvas (screen)
```

For serialisation / undo:

```
DrawingRuntime.serialize()
     │
     ▼
Snapshot stack (max 50)
     │
     ▼
DrawingRuntime.deserialize()
     │
     ▼
DrawingRenderer.render()  ← next frame
```

---

## 5. Coordinate System

All drawing instances use **market coordinates** only:

```ts
interface Anchor {
  time: number   // UNIX ms
  price: number  // instrument price
}
```

Pixel conversion is performed by `DrawingRenderContext` provided to `render()`:

```ts
interface DrawingRenderContext {
  ctx: CanvasRenderingContext2D
  timeToPixel: (time: number) => number
  priceToPixel: (price: number) => number
  width: number
  height: number
  dpr: number
}
```

This guarantees:
- Zoom/pan — no model recalculation
- Serialisation — screen-resolution independent
- Multi-pane sync — identical model → identical visual on any viewport
- Replay — drawings reproduce identically on historical data

---

## 6. Built-in Drawing Types (Sprint 3.3.4)

| Type | Category | Anchors | Description |
|------|----------|---------|-------------|
| Trend Line | line | 2 | Line between two market points |
| Horizontal Line | line | 1 | Infinite horizontal at a price level |
| Vertical Line | line | 1 | Infinite vertical at a time point |
| Ray | line | 1 | Line extending right from an anchor |
| Rectangle | shape | 2 | Filled + stroked rectangle |
| Text | text | 1 | Text label with configurable font |
| Fibonacci Retracement | fib | 2 | 7 horizontal levels (0/23.6/38.2/50/61.8/78.6/100%) |

---

## 7. File Layout

```
src/workspace/chart/
├── drawing/
│   ├── types.ts                    — Anchor, DrawingStyle, DrawingRenderContext
│   ├── DrawingDefinition.ts        — contract interface
│   ├── DrawingRegistry.ts          — singleton registry
│   ├── DrawingInstance.ts          — instance with market-coordinate anchors
│   ├── DrawingRuntime.ts           — lifecycle, serialisation, undo snapshots
│   ├── DrawingRenderer.ts          — CanvasLayer, delegates to definition.render()
│   ├── builtins/
│   │   ├── TrendLine.ts
│   │   ├── HorizontalLine.ts
│   │   ├── VerticalLine.ts
│   │   ├── Ray.ts
│   │   ├── Rectangle.ts
│   │   ├── Text.ts
│   │   ├── FibonacciRetracement.ts
│   │   └── index.ts               — registerAllDrawingBuiltins()
│   └── index.ts                    — barrel
```

---

## 8. Future Subsystems

The same pattern will apply to:

| Subsystem | Sprint | Pattern |
|-----------|--------|---------|
| Drawing Interaction | 3.3.5 | Same — Interaction layer |
| Overlay Engine | 3.3.6 | Definition → Registry → Runtime → Renderer → Interaction |
| Annotation Engine | TBD | Same |
| Marketplace Tools | TBD | Same |

If the same Model → Renderer → Interaction pattern is confirmed across 3+ subsystems,
it should be elevated to a **Platform Constitution** invariant.
