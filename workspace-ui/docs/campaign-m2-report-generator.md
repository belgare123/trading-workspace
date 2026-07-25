# Sprint M2 — Campaign Report Generator

**Статус:** Планирование (Freeze Window)
**Цель:** Генерация исчерпывающего HTML/Markdown-отчёта по завершённой кампании.
**Вход:** `snapshots.jsonl` (N записей за период кампании)
**Выход:** Отчёт со статистикой, графиками и выводами.

---

## 1. Изменение модели данных (M2-01)

**Задача M2-01 — Export trade performance statistics**

Расширить `TradingSnapshot` агрегированным блоком `tradeStats` и вынести его вычисление в отдельный сервис `TradeStatisticsCalculator`. Это единственное изменение в коде ядра (Provider → Type → Snapshot); все потребители (campaign-tail, CampaignReporter, CampaignComparator) работают с готовыми полями без пересчёта.

### 1.1. Мотивация

Текущая ситуация: `CampaignMetricsProvider` уже вычисляет `winners`/`losers` (строки 90-92), но эти значения не экспортируются. Вместо того чтобы добавить 3 поля по-минимуму, формируем стабильную модель статистики, которая прослужит M2, M2.5 и всем последующим этапам.

### 1.2. Новый блок `tradeStats` в `TradingSnapshot`

```typescript
interface TradeStatistics {
  /** Total closed trades (realizedPnl !== 0) */
  closedTrades: number

  /** Count of winning trades (realizedPnl > 0) */
  winningTrades: number

  /** Count of losing trades (realizedPnl < 0) */
  losingTrades: number

  /** Win rate in percent (0–100) */
  winRate: number

  /** Sum of all positive realizedPnl */
  grossProfit: number

  /** Sum of all negative realizedPnl (absolute value, always >= 0) */
  grossLoss: number

  /** Net profit from closed trades (grossProfit - grossLoss) */
  netProfit: number

  /** Average winning trade (grossProfit / winningTrades) */
  averageWin: number

  /** Average losing trade (grossLoss / losingTrades) */
  averageLoss: number

  /** Best single trade PnL (currently largestWinner) */
  largestWinner: number

  /** Worst single trade PnL (currently largestLoser) */
  largestLoser: number

  /** Profit factor (grossProfit / grossLoss). Infinity if grossLoss === 0. */
  profitFactor: number

  /** Expectancy per trade: (winRate * avgWin) - ((1-winRate) * avgLoss) */
  expectancy: number
}
```

Все поля вычисляются в одном месте — `TradeStatisticsCalculator` — и приходят в snapshot готовыми. Ни Reporter, ни Comparator, ни tail не пересчитывают win rate, profit factor или expectancy.

### 1.3. Новая архитектура потоков

```
TradeJournal
    │
    ▼
TradeStatisticsCalculator    ← НОВЫЙ: чистая функция, TradeRecord[] → TradeStatistics
    │
    ▼
CampaignMetricsProvider      ← использует calculator.collect(trades)
    │
    ▼
RawMetrics { trading: TradingSnapshot & { tradeStats: TradeStatistics } }
    │
    ▼
CampaignSnapshot.create()    ← normalise + validate
    │
    ▼
snapshots.jsonl              ← serialised
    │
    ┌───────┼───────────┬──────────────┐
    ▼       ▼           ▼              ▼
campaign-  Campaign-   Campaign-    Telegram
tail.ts    Reporter    Comparator   Alerts
(читает    (читает     (сравнивает  (будущее)
 snapshot  готовые     tradeStats
 в real-   поля,       между двумя
 time)     не вычис-   кампаниями)
           ляет сам)
```

**Преимущества:**
- `TradeStatisticsCalculator` — единственное место с формулами
- `CampaignReporter` не пересчитывает win rate / profit factor — он просто читает последний snapshot
- `CampaignComparator` сравнивает готовые `tradeStats` двух кампаний
- `campaign-tail` отображает уже готовые `winningTrades`, `losingTrades`, `winRate`, `profitFactor` из последнего snapshot

### 1.4. TradeStatisticsCalculator

```typescript
// src/workspace/campaign/TradeStatisticsCalculator.ts

export class TradeStatisticsCalculator {
  static calculate(trades: TradeRecord[]): TradeStatistics {
    const closedTrades = trades.filter(t => t.realizedPnl !== 0)
    const winners = closedTrades.filter(t => t.realizedPnl > 0)
    const losers = closedTrades.filter(t => t.realizedPnl < 0)

    const winCount = winners.length
    const lossCount = losers.length
    const total = winCount + lossCount

    const grossProfit = winners.reduce((s, t) => s + t.realizedPnl!, 0)
    const grossLoss = Math.abs(losers.reduce((s, t) => s + t.realizedPnl!, 0))

    const winRate = total > 0 ? (winCount / total) * 100 : 0
    const avgWin = winCount > 0 ? grossProfit / winCount : 0
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
    const expectancy = total > 0
      ? (winCount / total) * avgWin - (lossCount / total) * avgLoss
      : 0

    return {
      closedTrades: total,
      winningTrades: winCount,
      losingTrades: lossCount,
      winRate: round2(winRate),
      grossProfit: round2(grossProfit),
      grossLoss: round2(grossLoss),
      netProfit: round2(grossProfit - grossLoss),
      averageWin: round2(avgWin),
      averageLoss: round2(avgLoss),
      largestWinner: winCount > 0 ? round2(Math.max(...winners.map(t => t.realizedPnl!))) : 0,
      largestLoser: lossCount > 0 ? round2(Math.min(...losers.map(t => t.realizedPnl!))) : 0,
      profitFactor: profitFactor === Infinity ? Infinity : round2(profitFactor),
      expectancy: round4(expectancy),
    }
  }
}
```

### 1.5. Изменения в существующих файлах

#### CampaignMetricsTypes.ts

Добавить интерфейс `TradeStatistics` и включить его в `TradingSnapshot`:

```typescript
export interface TradingSnapshot {
  // ...existing поля...
  tradeStats: TradeStatistics  // НОВОЕ
}
```

Поле `largestWinner`/`largestLoser` остаётся в корне `TradingSnapshot` (уже используется), но дублирование не страшно — `TradeStatisticsCalculator` вычисляет оба набора, а snapshot включает оба.

#### CampaignMetricsProvider.ts

```typescript
import { TradeStatisticsCalculator } from './TradeStatisticsCalculator'

private collectTrading(): TradingSnapshot {
  // ...existing code...
  const tradeStats = TradeStatisticsCalculator.calculate(trades)

  return {
    // ...existing поля...
    tradeStats,
  }
}
```

#### CampaignSnapshot.ts — normaliseTrading

```typescript
tradeStats: {
  closedTrades: Math.round(t.tradeStats.closedTrades),
  winningTrades: Math.round(t.tradeStats.winningTrades),
  losingTrades: Math.round(t.tradeStats.losingTrades),
  winRate: round2(t.tradeStats.winRate),
  grossProfit: round2(t.tradeStats.grossProfit),
  grossLoss: round2(t.tradeStats.grossLoss),
  netProfit: round2(t.tradeStats.netProfit),
  averageWin: round2(t.tradeStats.averageWin),
  averageLoss: round2(t.tradeStats.averageLoss),
  largestWinner: round2(t.tradeStats.largestWinner),
  largestLoser: round2(t.tradeStats.largestLoser),
  profitFactor: t.tradeStats.profitFactor === Infinity ? Infinity : round2(t.tradeStats.profitFactor),
  expectancy: round4(t.tradeStats.expectancy),
}
```

### 1.6. Обновление campaign-tail.ts

Удалить локальные вычисления win/loss, читать готовые поля из snapshot:

```typescript
d.winCount = t.tradeStats?.winningTrades ?? 0
d.lossCount = t.tradeStats?.losingTrades ?? 0
d.winRate = t.tradeStats ? `${t.tradeStats.winRate.toFixed(1)}%` : '?'
d.profitFactor = t.tradeStats?.profitFactor
  ? t.tradeStats.profitFactor === Infinity
    ? '∞'
    : t.tradeStats.profitFactor.toFixed(2)
  : '?'
```

---

## 2. Архитектура (после M2-01)

```
┌──────────────────────┐
│   snapshots.jsonl    │  ← N записей CampaignSnapshotData c tradeStats
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│    ReportGenerator   │  ← Читает JSONL, агрегирует equity curve, drawdown
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   ReportFormatter    │  ← Markdown | HTML | JSON
└──────────────────────┘
```

**Важно:** Reporter не пересчитывает win rate / profit factor / expectancy — эти данные уже есть в каждом snapshot как `tradeStats`. Reporter отвечает за:
- Построение equity curve по временным срезам
- Вычисление Max Drawdown (peak-to-trough по всей equity curve)
- Агрегацию runtime и reliability метрик
- Форматирование и рендеринг

**Pipeline:** Reader → Calculator → Formatter → Writer

- **Reader** — итератор по JSONL с оконной агрегацией (например, hourly buckets для equity curve)
- **Calculator** — чистая функция: `(snapshots[]) → ComputedMetrics`
- **Formatter** — рендерит в нужный формат (Markdown | HTML | JSON)
- **Writer** — сохраняет файл + печатает сводку в консоль

---

## 3. Поля ComputedMetrics

### 3.1. Campaign Info

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

### 3.2. Runtime Statistics

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

### 3.3. Trading Statistics

| Поле | Формула | Ед.изм |
|---|---|---|
| totalTrades | last(trading.tradeStats.closedTrades) | count |
| winningTrades | last(trading.tradeStats.winningTrades) | count |
| losingTrades | last(trading.tradeStats.losingTrades) | count |
| **Win Rate** | last(trading.tradeStats.winRate) | % |
| **Profit Factor** | last(trading.tradeStats.profitFactor) | ratio |
| grossProfit | last(trading.tradeStats.grossProfit) | USDT |
| grossLoss | last(trading.tradeStats.grossLoss) | USDT |
| netProfit | last(trading.tradeStats.netProfit) | USDT |
| averageWin | last(trading.tradeStats.averageWin) | USDT |
| averageLoss | last(trading.tradeStats.averageLoss) | USDT |
| largestWinner | last(trading.tradeStats.largestWinner) | USDT |
| largestLoser | last(trading.tradeStats.largestLoser) | USDT |
| **Expectancy** | last(trading.tradeStats.expectancy) | USDT/trade |
| **Total PnL** | last(trading.realisedPnl) | USDT |
| **Equity Final** | last(trading.equity) | USDT |
| **Max Drawdown** | max peak-to-trough equity drop | % + USDT |
| **Total Fees** | last(trading.totalFees) | USDT |
| **Total Slippage** | sum of slippage events | USDT |
| **Avg Commission %** | avgCommission / avgTradeSize * 100 | % |
| **Avg Slippage %** | avgSlippage / avgTradeSize * 100 | % |
| **Avg Hold Time** | last(trading.averageHoldTimeSec) | sec → human |
| **Exposure %** | avg(trading.exposurePct) | % |
| **Max Leverage** | max(trading.leverage) | ratio |

**Все выделенные поля** берутся из `tradeStats` — они не пересчитываются Reporter-ом.

### 3.4. Risk Metrics

| Поле | Формула | Комментарий |
|---|---|---|
| **Sharpe Ratio** | mean(returns) / std(returns) * sqrt(periods) | Если > 1h выборки |
| **Calmar Ratio** | CAGR / MaxDrawdown % | Если > 1 дня |
| **Sortino Ratio** | mean(returns) / downside_std * sqrt(periods) | Только отрицательные |
| **Recovery Factor** | Total PnL / MaxDrawdown | ratio |
| **Ulcer Index** | RMS of drawdown series | % |
| **Average Exposure** | mean(exposurePct) | % |

*Примечание: Sharpe при < 24 часов данных — информационный, не статистический.*

### 3.5. Reliability Statistics

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

## 4. Формат отчёта

### 4.1. Markdown (default)

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
| Average Win | +$0.19 |
| Average Loss | -$0.14 |
| Expectancy | +$0.042/trade |
| Gross Profit | $116.28 |
| Gross Loss | $81.67 |
| Net Profit | $34.61 |
| Total PnL | +$42.61 |
| Max Drawdown | -$83.20 (-0.83%) |
| Recovery Factor | 0.51 |
| Avg Hold Time | 3m 42s |

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

### 4.2. HTML (опционально)

HTML-версия с графиками через Chart.js (equity curve, drawdown, распределение PnL). Формируется как самодостаточный `.html` файл.

---

## 5. Компоненты (code structure)

```
scripts/
  campaign-report.ts         ← CLI entry point

src/workspace/campaign/
  TradeStatisticsCalculator.ts ← НОВЫЙ: чистая функция расчёта tradeStats
  CampaignReportGenerator.ts   ← Calculator (equity curve, drawdown etc.)
  CampaignReportFormatter.ts   ← Renderer (Markdown / HTML / JSON)
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

## 6. Зависимости (нужны новые)

- Нет внешних зависимостей для Markdown. Всё чистое Node.js.
- Для HTML: `chart.js` (CDN — не пакет, просто ссылка в HTML)
- Для CLI: `commander` — но можно обойтись ручным `process.argv`

---

## 7. Критерии готовности M2

### M2-01 — Export trade performance statistics

- [ ] Создан `TradeStatisticsCalculator` с полным набором полей (раздел 1.2)
- [ ] `TradeStatistics` добавлен в `TradingSnapshot` интерфейс
- [ ] `CampaignMetricsProvider.collectTrading()` вызывает `TradeStatisticsCalculator.calculate(trades)`
- [ ] `CampaignSnapshot.normaliseTrading()` прокидывает `tradeStats`
- [ ] `campaign-tail.ts` читает `tradeStats` вместо локального вычисления
- [ ] Действующий burn-in показывает `276W / 149L` и `64.9%` вместо `0W / 0L`

### M2-02 — Report Generator

- [ ] `campaign-report.ts` читает `snapshots.jsonl`
- [ ] Вычисляет equity curve, Max Drawdown, Sharpe, Sortino, Calmar
- [ ] Форматирует Markdown-отчёт (полный шаблон раздела 4.1)
- [ ] `--format html` генерирует HTML с equity curve chart
- [ ] Проверка: exit code 1 при пустом/повреждённом JSONL
- [ ] Проверка: корректность Max Drawdown (проверено вручную)
- [ ] Проверка: отчёт на реальных 24h данных из текущего burn-in
