# Sprint M2 — Campaign Report Generator

**Статус:** Планирование (Freeze Window)
**Цель:** Генерация исчерпывающего HTML/Markdown-отчёта по завершённой кампании.
**Вход:** `snapshots.jsonl` (N записей за период кампании)
**Выход:** Отчёт со статистикой, графиками и выводами.

---

## 1. Архитектура

```
┌──────────────────────┐
│   snapshots.jsonl    │  ← N записей CampaignSnapshotData
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│    ReportGenerator   │  ← Читает JSONL, вычисляет метрики
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   ReportFormatter    │  ← Markdown | HTML | JSON
└──────────────────────┘
```

**Pipeline:** Reader → Calculator → Formatter → Writer

- **Reader** — итератор по JSONL с оконной агрегацией (например, hourly buckets для equity curve)
- **Calculator** — чистая функция: `(snapshots[]) → ComputedMetrics`
- **Formatter** — рендерит в нужный формат
- **Writer** — сохраняет файл + печатает сводку в консоль

---

## 2. Поля ComputedMetrics

### 2.1. Campaign Info

| Поле | Источник | Формат |
|---|---|---|
| campaignId | snapshots[0].campaign.id | string |
| startedAt | snapshots[0].campaign.startedAt | ISO |
| endedAt | snapshots[-1].timestamp | ISO |
| duration | endedAt - startedAt | human readable |
| exchange | snapshots[0].campaign.exchange | string |
| strategy | snapshots[0].campaign.strategy | string |
| gitCommit | snapshots[0].campaign.gitCommit | hash |
| buildVersion | snapshots[0].campaign.buildVersion | semver |

### 2.2. Runtime Statistics

| Поле | Формула | Ед.изм |
|---|---|---|
| uptime | max(runtime.uptimeSec) | sec → human |
| avgCpu | avg(runtime.cpuPercent) | % |
| maxCpu | max(runtime.cpuPercent) | % |
| avgRss | avg(runtime.rssMB) | MB |
| maxRss | max(runtime.rssMB) | MB |
| avgHeapUsed | avg(runtime.heapUsedMB) | MB |
| avgEventLoopDelay | avg(runtime.eventLoopUtilization) | 0–1 |
| maxEventLoopDelay | max(runtime.eventLoopUtilization) | 0–1 |
| totalGcCount | max(runtime.gcCount) | count |
| maxGcPauseMs | max(runtime.gcPauseMaxMs) | ms |
| totalReconnects | last(runtime...) сумма health.*.reconnects | count |

### 2.3. Trading Statistics

| Поле | Формула | Ед.изм |
|---|---|---|
| totalTrades | max(trading.tradesRecorded) | count |
| winningTrades | max(trading.winningTrades) | count |
| losingTrades | max(trading.losingTrades) | count |
| avgWinSize | sum(winning trades) / winCount | USDT |
| avgLossSize | sum(losing trades) / lossCount | USDT |
| **Win Rate** | winningTrades / totalTrades * 100 | % |
| **Profit Factor** | grossProfit / grossLoss | ratio |
| **Total PnL** | last(trading.realisedPnl) | USDT |
| **Equity Final** | last(trading.equity) | USDT |
| **Max Drawdown** | max peak-to-trough equity drop | % + USDT |
| **Total Fees** | last(trading.totalFees) | USDT |
| **Total Slippage** | sum of slippage events | USDT |
| **Avg Commission %** | avgCommission / avgTradeSize * 100 | % |
| **Avg Slippage %** | avgSlippage / avgTradeSize * 100 | % |
| **Avg Hold Time** | avg(trading.averageHoldTimeSec) | sec → human |
| **Expectancy** | (winRate * avgWin) - ((1-winRate) * avgLoss) | USDT/trade |
| **Exposure %** | avg(trading.exposurePct) | % |
| **Max Leverage** | max(trading.leverage) | ratio |

### 2.4. Risk Metrics

| Поле | Формула | Комментарий |
|---|---|---|
| **Sharpe Ratio** | mean(returns) / std(returns) * sqrt(periods) | Если > 1h выборки |
| **Calmar Ratio** | CAGR / MaxDrawdown % | Если > 1 дня |
| **Sortino Ratio** | mean(returns) / downside_std * sqrt(periods) | Только отрицательные |
| **Recovery Factor** | Total PnL / MaxDrawdown | ratio |
| **Ulcer Index** | RMS of drawdown series | % |
| **Average Exposure** | mean(exposurePct) | % |

*Примечание: Sharpe при < 24 часов данных — информационный, не статистический.*

### 2.5. Reliability Statistics

| Поле | Формула | Критерий |
|---|---|---|
| certificationRuns | count of health.certification snapshots | > 0 |
| certificationPassed | max passed — min passed | — |
| certificationFailures | total failed snapshots | 0 ✅ |
| divergences | count of !! positionSync.ok | 0 ✅ |
| orphanOrders | count of !! ordersSync.ok | 0 ✅ |
| invariantFailures | total !ok across any invariant | 0 ✅ |
| lastExceptionAge | ms since last event loop anomaly | — |
| snapshotCount | total JSONL entries | > 0 |
| snapshotGaps | пропуски > 90s между snapshot | 0 ✅ |

---

## 3. Формат отчёта

### 3.1. Markdown (default)

````markdown
# Campaign Report — paper-20260725

**Duration:** 2026-07-25 17:00 — 2026-07-26 17:00 (24h)
**Exchange:** Bybit · **Strategy:** SmaCross (5/15)
**Commit:** 144d583 · **Build:** v2.0.0-rc1

---

## Runtime Statistics

| Metric | Value | Trend |
|---|---|---|
| Uptime | 24h 0m | ✅ |
| Avg CPU | 12.4% | ✅ |
| Max RSS | 142 MB @ 06:14 | ✅ (stable) |
| Avg Event Loop | 0.08 | ✅ |
| GC Pauses max | 42 ms @ 03:52 | ✅ |
| Reconnects | 0 | ✅ |

## Trading Performance

| Metric | Value |
|---|---|
| Total Trades | 1,024 |
| Win / Loss | 612 / 412 |
| Win Rate | 59.8% |
| Profit Factor | 1.42 |
| Total PnL | +$42.61 |
| Max Drawdown | -$83.20 (-0.83%) |
| Recovery Factor | 0.51 |
| Avg Hold Time | 3m 42s |
| Expectancy | +$0.042/trade |

## Risk Metrics

| Metric | Value |
|---|---|
| Sharpe Ratio (hourly) | 1.87 |
| Calmar Ratio | 3.14 |
| Sortino Ratio | 2.41 |
| Exposure (avg) | 47.3% |
| Ulcer Index | 0.42% |

## Reliability

| Metric | Value |
|---|---|
| Certification Runs | 1,440 |
| Certification Failures | 0 ✅ |
| Divergences | 0 ✅ |
| Orphan Orders | 0 ✅ |
| Invariant Failures | 0 ✅ |
| Snapshot Gaps | 0 ✅ |

---

_Generated by Campaign Report Generator — M2_
````

### 3.2. HTML (опционально)

HTML-версия с графиками через Chart.js (equity curve, drawdown, распределение PnL). Формируется как самодостаточный `.html` файл.

---

## 4. Компоненты (code structure)

```
scripts/
  campaign-report.ts         ← CLI entry point

src/workspace/campaign/
  CampaignReportGenerator.ts ← Calculator
  CampaignReportFormatter.ts ← Renderer
```

**CLI интерфейс:**

```bash
npx tsx scripts/campaign-report.ts                          # latest campaign
npx tsx scripts/campaign-report.ts --dir /tmp/my-campaign   # arbitrary dir
npx tsx scripts/campaign-report.ts --format html            # HTML output
npx tsx scripts/campaign-report.ts --out ./reports/         # output dir
```

**Exit codes:**
- `0` — отчёт сгенерирован
- `1` — данных недостаточно (меньше 2 snapshot)
- `2` — ошибка чтения / повреждённый JSONL

---

## 5. Зависимости (нужны новые)

- Нет внешних зависимостей для Markdown. Всё чистое Node.js.
- Для HTML: `chart.js` (CDN — не пакет, просто ссылка в HTML)
- Для CLI: `commander` — но можно обойтись ручным `process.argv`

---

## 6. Критерии готовности M2

- [ ] `campaign-report.ts` читает `snapshots.jsonl`
- [ ] Вычисляет все метрики раздела 2
- [ ] Форматирует Markdown-отчёт
- [ ] `--format html` генерирует HTML с equity curve chart
- [ ] Проверка: отчёт на реальных 24h данных
- [ ] Проверка: exit code 1 при пустом/повреждённом JSONL
- [ ] Проверка: корректность Max Drawdown (проверено вручную)
- [ ] Проверка: корректность Profit Factor (grossProfit / grossLoss)
