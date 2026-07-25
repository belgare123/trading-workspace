# Roadmap Update — Post-RC1

**Date:** 2026-07-25
**HEAD:** `144d583` (feat(campaign): Sprint M1.1 — Operational Health)

---

## Phase 0 — Foundation ✅

| Sprint | Status | Description |
|---|---|---|
| RC1 Core | ✅ | TradeLifecycleRuntime, CashLedger, TradeLedger, PositionRuntime, CertificationRuntime |
| Validation at Scale | ✅ | 1k → 5k → 10k → 20k replay, zero divergence |
| Exchange Adapters | ✅ | Bybit + Binance (REST + WS) |
| Paper Trading | ✅ | PaperBrokerAdapter + PaperExecutionGateway |

---

## Phase 1 — Campaign Infrastructure ✅

| Sprint | Status | Description |
|---|---|---|
| M1 — Campaign Metrics Module | ✅ | Collector → Provider → Snapshot → Writer |
| M1.1 — Operational Health | ✅ | campaign-health, campaign-tail, campaign-verify |
| **Freeze Window (24h)** | 🔒 | 2026-07-25 17:10 → 2026-07-26 17:10 |

### M1.1 Deliverables

| Tool | File | Function |
|---|---|---|
| `campaign:health` | `scripts/campaign-health.ts` | Liveness probe, exit 0/1 |
| `campaign:tail` | `scripts/campaign-tail.ts` | Live dashboard, --watch mode |
| `campaign:verify` | `scripts/campaign-verify.ts` | Deep integrity check |

Все три инструмента кроссплатформенные, используют `os.tmpdir()`.

---

## Phase 2 — Operational Validation

### Sprint M2 — Campaign Report Generator ⏳ (next)

После завершения Freeze Window.

**Pipeline:** `snapshots.jsonl` → Reader → Calculator → Formatter → `report.{md|html|json}`

**Метрики:**
- Runtime: uptime, CPU, RSS, GC, reconnects
- Trading: trades, win rate, profit factor, PnL, max drawdown, expectancy, exposure
- Risk: Sharpe, Sortino, Calmar, recovery factor, ulcer index
- Reliability: certification, divergences, orphan orders, invariant failures, snapshot gaps

**Формат вывода:** Markdown (по умолчанию), HTML с графиками (опционально).

*Детали: `docs/campaign-m2-report-generator.md`*

---

### Sprint M2.5 — Campaign Comparator ⏳

После M2. Сравнение двух прогонов с подсветкой значимых изменений.

**Вход:** Два `report.json` (выход M2)
**Выход:** Markdown-дифф с ✅/❌/➡️

**Ключевое:** Каждый коммит можно оценивать объективно.
- Push заблокирован, если M2.5 показывает degradation.
- Last Known Good (LKG) хранится в репозитории.

*Детали: `docs/campaign-comparator.md`*

---

### Sprint M3 — Health Dashboard (будущее)

Веб-дашборд в реальном времени на основе `state.json`.
- Текущее состояние кампании
- Equity curve (из snapshots.jsonl)
- Alert status
- История проверок

*Не спринтовать до завершения M2 + M2.5.*

---

### Sprint M4 — Event Alerts (будущее)

Telegram/Slack уведомления о:
- Падении кампании
- Degradation компонентов (feed, broker)
- Invariant violation
- Exception threshold exceeded

*Не спринтовать до M3.*

---

## Phase 3 — Trading Validation

После завершения Phase 2 (M2 + M2.5, 7d Paper Campaign).

### Критерии входа в Phase 3

- [ ] 7-дневная Paper Campaign без сбоев
- [ ] Uptime > 99.9%
- [ ] Zero invariant violations
- [ ] Zero orphan orders
- [ ] Zero unhandled exceptions
- [ ] Certification pass rate = 100%
- [ ] Snapshot gaps = 0
- [ ] M2 report за 7 дней
- [ ] M2.5 diff между 7-дневными прогонами

### Этапы Phase 3

| Этап | Описание | Длительность |
|---|---|---|
| 3.1 | Bybit Testnet (USDT) | 3 дня |
| 3.2 | Bybit Testnet (BTC) | 3 дня |
| 3.3 | Binance Testnet | 3 дня |
| 3.4 | Trading Validation Report | 1 день |

*Детали: `docs/live-transition-checklist.md`*

---

## Phase 4 — Minimal Live

С очень жёсткими лимитами.

| Параметр | Limit |
|---|---|
| Max capital | $200 |
| Max daily loss | $10 (5%) |
| Max position size | $50 |
| Max open positions | 2 |
| Max strategies | 1 |
| Kill switch | Telegram + auto |
| Daily manual sign-off | Required |

*Детали: `docs/live-transition-checklist.md`*

---

## Phase 5+ — Full Platform (будущее)

- Portfolio Manager (>1 strategy)
- Multi-exchange (Binance + Bybit)
- Risk Engine (dynamic limits, cooldown)
- P&L reconciliation auto
- Crash recovery tests (kill -9, network loss, process hang)

---

## График (ориентировочный)

| Период | Milestone |
|---|---|
| 2026-07-25–26 | 🔒 Freeze Window |
| 2026-07-26–28 | Sprint M2 |
| 2026-07-28–30 | Sprint M2.5 |
| 2026-07-30–08-06 | 7d Paper Campaign |
| 2026-08-06–08 | Phase 3 decision |
| 2026-08-08–14 | Phase 3 (Testnet) |
| 2026-08-15+ | Phase 4 (Minimal Live) |

> **Note:** Все даты — ориентировочные. Каждый переход требует формального sign-off по критериям предыдущей фазы. Никаких переходов «на глаз».
