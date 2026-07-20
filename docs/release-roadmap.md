# Roadmap — Trading Platform

> **Current:** v1.0 ✅ — **Initial Stable Release**
> **Next:** **Generation 2** — Runtime API
> **Status:** 🎉 v1.0 released on 2026-07-14

---

## Generation 1: v1.0 ✅ — Trading Platform Initial Stable Release

After 16 pre-release cycles, the platform reached its first stable milestone.

### Accomplished

- **Core Stabilized**: Event Store, PluginRegistry, Replay Engine, Decision Engine, Learning Engine, Marketplace
- **API Frozen**: `core`, `workspace`, `screener_sdk`, `marketplace` — no breaking changes without RFC
- **Workspace Complete**: 8 apps (Scanner, Inspector, Replay Studio, Strategy Monitor, Plugin Store, Learning Hub, System Monitor, Command Palette), 10 architectural layers
- **Workspace SDK**: `registerCommand`, `registerSearchAdapter`, `registerPanel`, `pushTimelineEvent`
- **953+ tests**, Performance Baseline, API audit, import audit, long-running stress
- **Documentation**: 7 guides, API reference, sequence diagrams, 7 examples

### v1.0.x — Bugfix Releases

Bugfix releases as needed — no new features, only fixes based on user reports.

---

## Generation 2: Runtime API 🔄

The major architectural shift. Workspace transitions from monolithic application to **one of many clients** of the Runtime.

```
Workspace ─┐
Trading Lab─┼── Runtime API ── Event Store
Marketplace┘         │
                     ├── Binance
                     ├── Bybit
                     ├── OKX
                     └── Coinbase
```

### Epics

| Epic | Description |
|------|-------------|
| **Runtime API** | Service layer that owns all domain logic. Workspace, CLI, and future clients call Runtime via a clean API boundary |
| **Multi-Exchange** | Exchange runtime adapters (Binance, Bybit, OKX). Unified order management, position tracking, balance aggregation |
| **Marketplace Cloud** | Remote package registry, sync between instances, publishing workflow, version management |
| **Plugin SDK 2.0** | Cross-exchange strategies, Runtime-aware plugins, lifecycle hooks |

### Why Workspace becomes a client

Today Workspace embeds the engine directly (FastAPI imports `core`). In Gen 2:

- **Runtime** is a standalone process/service
- **Workspace** connects to Runtime via WebSocket / REST
- **Trading Lab** connects to Runtime via gRPC / shared bus
- **CLI** connects to Runtime via the same API surface

This enables: independent scaling, hot-restart of UI without affecting engine, remote deployment (UI on cloud, engine on VPS), and third-party clients.

---

## Generation 3: Simulation Lab

| Feature | Description |
|---------|-------------|
| Monte Carlo | Multi-year simulations with randomized parameters |
| Walk-forward | Rolling window optimization + out-of-sample validation |
| Portfolio Simulation | Multi-asset, multi-strategy P&L aggregation |
| Distributed Compute | Parallel backtesting across worker pool |

---

## Version History

| Version | Date | What |
|---------|------|------|
| v0.5.0 | — | Initial |
| v0.6.0 | — | Replay, Quality, Analytics |
| v0.14.0 | 2026-07-13 | Event Store, Aggregate Streams |
| v0.15.0 | 2026-07-14 | Stabilisation — API audit, boundaries, hardening |
| v0.16.0-rc1 | 2026-07-14 | Release Candidate Cycle |
| **v1.0.0** | **2026-07-14** | **Initial Stable Release 🎉** |
| **Sprint 4.8** | **2026-07-16** | **Live Trading Workspace UI** — 6 panels (Connection, Orders, Positions, Account, Risk, History), ScreenRegistry, Ctrl+9 |

---

## Sprint 4.8 ✅ — Live Trading Workspace UI

6 Live Trading panels, ScreenRegistry registration, keyboard shortcut Ctrl+9. Docker production build. Подтверждено: 32/32 integration tests, 6 panels в Docker.

---

## Gen 2 — Спринты 4.9A / 4.9B / 4.9C 🔄

### Sprint 4.9A — Binance Spot Adapter (функциональный) ✅

**Scope**: Binance Spot REST + WebSocket адаптер. Реализован: `BinanceSpotBrokerAdapter.ts` (972 строки). TypeScript — 0 errors.

| Компонент | Статус |
|-----------|--------|
| REST API: place/cancel/query order, balances | ✅ |
| User Data Stream: reconnect, listenKey refresh | ✅ |
| WebSocket lifecycle: dis/reconnect, delayed/duplicated events | ✅ |
| Symbol filters: LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL | ✅ |
| `recvWindow` через `BrokerClock` | ✅ |
| Signed HMAC-SHA256 requests | ✅ |
| Barrel export + BrokerCapabilities | ✅ |

### Sprint 4.9B — Certification Suite ✅

Отдельный модуль `workspace/certification/` с 75 сценариями в 7 категориях:

```
workspace/certification/
├── CertificationRuntime.ts    — orchestrator
├── ScenarioRunner.ts          — executor + timeout + isolation
├── ScenarioDefinition.ts      — типы, контекст, хуки
├── ScenarioRegistry.ts        — регистрация + фильтры
├── CertificationReport.ts     — отчёт (таблица + JSON)
├── builtins/
│   ├── ConnectivityScenarios  — 12 сценариев
│   ├── OrderScenarios         — 18 сценариев
│   ├── RiskScenarios          — 10 сценариев
│   ├── RecoveryScenarios      — 9 сценариев
│   ├── InfrastructureScenarios — 11 сценариев
│   ├── HistoryScenarios       — 8 сценариев
│   └── MetricsScenarios       — 7 сценариев
└── index.ts
```

Использование:
```ts
const runtime = new CertificationRuntime(broker, gateway)
runtime.registerBuiltins()
const report = await runtime.run()
console.log(CertificationRuntime.formatReport(report))
```

TypeScript — 0 errors. Коммит: `bb6a432`.

### Paper Campaign 🏆

**Приоритет:** сейчас. Observability — после накопления реальных эксплуатационных данных.

**Условия:**
- непрерывная работа 48–72 часа;
- несколько символов (BTCUSDT, ETHUSDT, SOLUSDT);
- разные стратегии;
- переподключения сети;
- рестарт приложения;
- ручные отмены ордеров;
- проверка Recovery.

**Критерии завершения:**
- ни одного «зависшего» ордера;
- отсутствуют рассинхронизации между локальным состоянием и биржей;
- PnL совпадает с расчётным;
- History непрерывен;
- Recovery проходит автоматически;
- Certification Suite 75/75 после каждого изменения.

---

### Sprint 4.9C — Observability Runtime (после Paper Campaign)

Отдельный модуль `workspace/observability/` — только после накопления реальных эксплуатационных данных.

| Метрика | Назначение |
|---------|-----------|
| Feed latency | Задержка входящих данных |
| Broker RTT | Round-trip исполнения ордера |
| WS reconnect count | Количество переподключений |
| REST error rate | Частота ошибок REST |
| Queue depth | Глубина очереди событий |
| Retry count | Количество повторных попыток |
| Rate-limit hits | Срабатывания rate limit |
| Risk rejects | Количество отклонённых по риску |
| Reconciliation duration | Время восстановления состояния |
| Order lifecycle timing | Длительность жизненного цикла ордера |

Состав:
```
workspace/observability/
├── LoggingRuntime     — structured logs
├── TracingRuntime     — distributed tracing
├── HealthRuntime      — health checks
├── MetricsExporter    — метрики (JSON, Prometheus)
├── AlertRuntime       — алерты
└── dashboards/        — шаблоны дашбордов
```

---

### Live Readiness Review (Gate перед Live)

Перед первой реальной сделкой — обязательный чек-лист:

| # | Проверка | Статус |
|---|---------|--------|
| 1 | Certification Suite: 75/75 | ⏳ |
| 2 | Paper Campaign: ≥72 часа | ⏳ |
| 3 | Recovery проверен | ⏳ |
| 4 | Kill Switch проверен | ⏳ |
| 5 | Reconciliation проверен | ⏳ |
| 6 | Risk Rules проверены | ⏳ |
| 7 | Binance Spot без ошибок | ⏳ |
| 8 | Нет memory leaks | ⏳ |
| 9 | Нет необработанных исключений | ⏳ |
| 10 | Нет рассинхронизации позиций | ⏳ |

---

### First Live Trade

После выполнения Readiness Review:
- один символ (BTCUSDT);
- минимально допустимый объём (0.001 BTC);
- одна стратегия;
- постоянный мониторинг;
- Kill Switch доступен мгновенно.

### Staged rollout

```
Mock → Replay → Paper Binance Spot (48-72h)
     → Live Readiness Review
     → First Live Trade (0.001 BTC)
     → Long-running Paper (1 week)
     → Production
```

---

## Sprint Sequence (утверждён 2026-07-17)

| Sprint | Что | Когда |
|--------|-----|-------|
| **4.9A** | ✅ Binance Spot Adapter | Завершён |
| **4.9B** | ✅ Certification Suite (75 сценариев) | Завершён |
| **Paper Campaign** | 🏆 Длительная Paper на Binance Spot (48-72h) | **Сейчас** |
| **4.9C** | Observability Runtime (по итогам Paper) | После Paper |
| **Live Readiness** | Чек-лист из 10 пунктов | Перед Live |
| **5.0** | First Live Trade (0.001 BTC) | После Paper + Readiness |
| **5.1** | Long-running Paper → Production | После 5.0 |
