# v1.1 — Workspace UI Roadmap

**Цель**: Полноценный SPA-интерфейс поверх стабильного API ядра v1.0.

## Слои

### Foundation
- [x] React 19 + Vite + TypeScript workspace-ui/
- [x] Tailwind CSS + Design System
- [x] TanStack Query, React Router, Zustand
- [x] Monaco Editor, React Flow, Recharts/ECharts

### Backend API
- [x] `/api/v1/` — scanner, opportunities, strategies, plugins, replay, event-store, trace, system
- [x] `/ws/` — scanner, opportunities, system, events, replay
- [x] FastAPI остаётся, Jinja2 уходит

### Layout
- [x] Терминальный layout: Toolbar | Nav / Workspace / Panel | Status Bar
- [x] Drag-n-drop панели

### Экраны (порядок)
1. [x] **Scanner** — карточки, фильтры, WebSocket
2. [x] **Inspector** — TraceGraph, EventStore, AggregateStream
3. [x] **Replay Studio** — timeline, play/pause, speed, bookmarks
4. [x] **Strategy Monitor** — PluginRegistry, Health, PnL, сигналы
5. [x] **Plugin Store** — Marketplace GUI
6. [x] **Learning Center** — API готов
7. [x] **System Monitor** — метрики, health
8. [x] **Live Trading** — 6 panels (Connection, Orders, Positions, Account, Risk, History)

## Статус: Phase 2 — Runtime API ✅ + Live Trading (Sprint 4.8)

### Sprint 4.8 ✅ — Live Trading Workspace UI
- [x] 6 live panels написаны: Connection, Orders, Positions, Account/Balance, Risk, History/Journal
- [x] LiveWorkspace.tsx — страница с grid layout (2 колонки + bottom bar)
- [x] ScreenRegistry + PanelRegistry регистрация
- [x] Кнопка «Live Trading» в навигации
- [x] Горячая клавиша Ctrl+9
- [x] Интеграционные тесты: 32/32 passed (Certification Suite базовый)

### Sprint 4.9 🔄 — Live Trading: Binance Spot, Certification, Observability

### Sprint 4.9A ✅ — Binance Spot BrokerAdapter
- [x] BinanceSpotBrokerAdapter (REST + WebSocket + User Data Stream)
- [x] Signed HMAC-SHA256 requests, BrokerClock
- [x] Symbol filters: LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL
- [x] Barrell export, BrokerCapabilities

### Sprint 4.9B ✅ — Certification Suite
- [x] workspace/certification/ — модуль сценариев (75 шт.)
- [x] Connectivity: 12 сценариев
- [x] Orders: 18 сценариев
- [x] Risk: 10 сценариев
- [x] Recovery: 9 сценариев
- [x] Infra: 11 сценариев
- [x] History: 8 сценариев
- [x] Metrics: 7 сценариев
- [x] CertificationRuntime, ScenarioRunner, ScenarioRegistry, CertificationReport

### 🏆 Paper Campaign (сейчас)
- [ ] Paper на Binance Spot (48-72h)
- [ ] BTCUSDT, ETHUSDT, SOLUSDT
- [ ] Переподключения сети
- [ ] Рестарт приложения
- [ ] Recovery проверен
- [ ] History непрерывен

### Sprint 4.9C — Observability Runtime (после Paper)
- [ ] workspace/observability/
- [ ] Structured logs, tracing, runtime health
- [ ] Feed latency, Broker RTT, WS reconnect, REST error rate
- [ ] Queue depth, retry count, rate-limit hits, risk rejects
- [ ] Reconciliation duration, order lifecycle timing
- [ ] Metrics export (JSON / Prometheus)
- [ ] Alerts, dashboards

### Live Readiness Review
- [ ] Certification Suite: 75/75
- [ ] Paper Campaign ≥72 часа
- [ ] Recovery, Kill Switch, Reconciliation, Risk Rules
- [ ] Нет memory leaks, исключений, рассинхронизации

### Sprint 5.0 — First Live Trade
- [ ] BTCUSDT, 0.001 BTC, одна стратегия
- [ ] Kill Switch доступен
- [ ] Постоянный мониторинг

### Sprint 5.1+ — Long-running Paper → Production → Новые биржи

---

## Changelog

| Версия | Дата | Что |
|--------|------|-----|
| v1.0 | 2026-07-14 | Initial Stable Release |
| Sprint 4.8 | 2026-07-16 | Live Trading Workspace UI |
