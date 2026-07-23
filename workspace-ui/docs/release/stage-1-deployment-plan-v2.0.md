# Stage 1 Production Deployment Plan

> **Дата:** 2026-07-23
> **Платформа:** Trading Workspace (workspace-ui)
> **PRR Section:** Phase C3 — Stage 1 Deployment Plan
> **Статус:** ⏳ **PLANNED** (ожидает утверждения RC1)

---

## Stage 1 — Overview

**Цель:** Запуск первой торговой кампании на Production с минимальным риском.

| Параметр | Значение |
|----------|----------|
| Environment | MainNet (TestNet по согласованию) |
| Strategy | SmaCross (единственная, проверена в Paper Campaign) |
| Symbol | XRPUSDT (единственный) |
| Position size | 0.25% от баланса (minimal) |
| Duration | 48 часов (2 дня) |
| Monitoring | Постоянный (healthcheck каждые 15м) |
| Kill Switch | Автоматический (5% drawdown, $200 loss, 5 positions) |

---

## Pre-Deployment Checklist

### Network & Connectivity

| # | Шаг | Детали | Owner |
|---|-----|--------|-------|
| D-01 | Развернуть VPS | Сервер с Node 24.x, доступ в Bybit (REST/WS) | DevOps |
| D-02 | Настроить Prometheus endpoint | OpenTelemetry exporter → Prometheus scrape | DevOps |
| D-03 | Настроить Grafana dashboard | Дашборд: memory, exceptions, reconnects, cert health, P&L | DevOps |
| D-04 | Проверить DNS/connectivity | Bybit API endpoints: REST, Public WS, Private WS | DevOps |

### Configuration

| # | Шаг | Детали | Owner |
|---|-----|--------|-------|
| C-01 | Развернуть .env.production | 29 env vars: BYBIT_API_KEY, BYBIT_API_SECRET, SYMBOLS, PAPER_BALANCE и т.д. | DevOps |
| C-02 | Проверить SHA256 checksum | `env | sha256sum` → зафиксировать в release notes | DevOps |
| C-03 | Настроить umask 0027 | Безопасные permissions для SQLite | DevOps |
| C-04 | Feature Flags: mainnet=true, chaos=false | Через featureFlags.ts или VITE_FEATURE_* | Ops |

### Scripts & Automation

| # | Шаг | Детали | Owner |
|---|-----|--------|-------|
| S-01 | Deploy paper-campaign.ts | Основной процесс | Ops |
| S-02 | Deploy healthcheck.ts | Cron: every 15 minutes | Ops |
| S-03 | Deploy bybit-campaign-report.ts | Cron: daily report | Ops |
| S-04 | Настроить kill switch monitoring | Alarm при срабатывании | Ops |

---

## Deployment Sequence

### Day 1 — Launch

```
T+00:00  Start paper-campaign (XRPUSDT, 0.25%)
T+00:01  Verify WS connected (healthcheck exit 0)
T+00:05  Verify market data flowing
T+00:15  First healthcheck → state.json readable
T+01:00  Verify no exceptions, no reconnects
T+02:00  Verify risk engine active (10 rules)
T+04:00  First trade expected (if signal generated)
T+06:00  Verify position tracking
T+12:00  Verify wallet balance report
T+24:00  Day 1 report → Stage 1 day 1 complete
```

### Day 2 — Monitoring & Verification

```
T+24:00  Day 1 review: exceptions, P&L, positions
T+24:15  Kill Switch self-check
T+30:00  Verify no memory leak (state.json memoryMB)
T+36:00  Verify reconnect count still 0
T+42:00  Mid-campaign health check
T+48:00  Stage 1 complete → Stage 1 report
```

### Post-Stage 1

```
T+48:00  Stop campaign (graceful shutdown)
T+48:05  Gather logs → archive
T+48:10  Generate Stage 1 report
T+48:15  Decision: Stage 2 or rollback
```

---

## Rollback Plan

| Trigger | Action | RTO |
|---------|--------|:---:|
| KillSwitch сработал | Анализ логов, не перезапускать | 1h |
| WS disconnect >5мин | Auto-reconnect, алерт | 5min |
| >3 exceptions | Stop campaign, gather logs | 15min |
| Memory >100MB | Stop campaign, gather logs | 15min |
| Любой unknown error | Stop campaign, notify | 5min |

---

## Monitoring Configuration

### Alerts

| Alert | Trigger | Channel |
|-------|---------|---------|
| Campaign stopped | Process exit | Telegram |
| Exception > 0 | exceptionsCount > 0 | Telegram |
| Reconnect > 0 | reconnectCount > 0 | Telegram |
| KillSwitch triggered | killSwitchArmed = false | Telegram |
| Healthcheck FAIL | healthcheck exit != 0 | Telegram |
| Memory spike | memoryMB > 50 | Telegram |

### Dashboards

| Dashboard | Метрики | Platform |
|-----------|---------|----------|
| Stage 1 Overview | Uptime, Exceptions, Reconnects, Memory | Grafana |
| Trading Activity | Trades, P&L, Positions, Drawdown | Grafana |
| System Health | CPU, RAM, Disk, Node process | Grafana |

---

## Stage 1 — Transition Criteria

### Criteria for Stage 1 → Stage 2

| Критерий | Описание |
|----------|----------|
| 0 lost trades/positions | Ни одна позиция не потеряна |
| 0 duplicate orders | Нет дублирующих ордеров |
| 0 wallet/exchange divergence | Баланс совпадает с брокером |
| 0 emergency stops | KillSwitch ни разу не сработал |
| Stable memory | Рост < 5% за 48ч |
| No false KillSwitch triggers | Ни одного ложного срабатывания |

### Stage 2 Parameters (post-Stage 1)

| Параметр | Stage 1 | Stage 2 |
|----------|:-------:|:-------:|
| Symbols | 1 (XRPUSDT) | 3 (XRP/BTC/ETH) |
| Duration | 48h | 5-7 days |
| Position size | 0.25% | 0.5-1% |
| Strategies | 1 (SmaCross) | 2-3 |
| KillSwitch | 5%/200/5 | 5%/200/5 |

---

## Expected Outcomes

| Параметр | Ожидаемый результат |
|----------|-------------------|
| Total trades | 5-30 (зависит от рынка) |
| Win rate | ~40-60% (SmaCross, исторически) |
| Max drawdown | < 2% (на 0.25%) |
| Max loss | < $50 (на $10k balance) |
| Exceptions | 0 |
| Reconnects | 0 |
| Memory | 15-25 MB |
| Cert | 54/54 (перезапуск после Stage 1) |

---

## Документы Stage 1

| Документ | Описание | Owner |
|----------|----------|-------|
| Stage-1-launch-checklist.md | Чек-лист развёртывания | Ops |
| Stage-1-report.md | Итоговый отчёт Stage 1 | Dev |
| Stage-2-plan.md | План расширения | Arch |
