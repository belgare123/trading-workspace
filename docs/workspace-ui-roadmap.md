# v1.1 — Workspace UI Roadmap

**Цель**: Полноценный SPA-интерфейс поверх стабильного API ядра v1.0.

## Слои

### Foundation
- [ ] React 19 + Vite + TypeScript workspace-ui/
- [ ] Tailwind CSS + Design System
- [ ] TanStack Query, React Router, Zustand
- [ ] Monaco Editor, React Flow, Recharts/ECharts

### Backend API
- [ ] `/api/v1/` — scanner, opportunities, strategies, plugins, replay, event-store, trace, system
- [ ] `/ws/` — scanner, opportunities, system, events, replay
- [ ] FastAPI остаётся, Jinja2 уходит

### Layout
- [ ] Терминальный layout: Toolbar | Nav / Workspace / Panel | Status Bar
- [ ] Drag-n-drop панели

### Экраны (порядок)
1. **Scanner** — карточки, фильтры, WebSocket
2. **Inspector** — TraceGraph, EventStore, AggregateStream
3. **Replay Studio** — timeline, play/pause, speed, bookmarks
4. **Strategy Monitor** — PluginRegistry, Health, PnL, сигналы
5. **Plugin Store** — Marketplace GUI
6. **Learning Center** — API готов
7. **System Monitor** — метрики, health

## Статус: Phase 1 — React Foundation
