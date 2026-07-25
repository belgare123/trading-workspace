# Sprint M2.5 — Campaign Comparator

**Статус:** Планирование (Freeze Window)
**Цель:** Объективное сравнение двух кампаний после разных коммитов.
**Зачем:** Переход от субъективной оценки («кажется стало лучше») к объективным метрикам.

---

## 1. Концепция

```
Campaign A (commit 3e6587b)
vs
Campaign B (commit 5615c62)

Trades           137 → 141    (+4)
Win Rate        61.2 → 63.4%  (+2.2pp)
Profit Factor   1.42 → 1.57   (+0.15)
Max Drawdown    8.4 → 6.7%    (-1.7pp)  ✅
Fees            12.4 → 11.8   (-0.6)
Runtime incidents  2 → 0      (-2)      ✅
```

Comparator не просто выводит два набора чисел — он **подсвечивает значимые изменения**.

---

## 2. Архитектура

```
┌──────────────────┐    ┌──────────────────┐
│  Report A        │    │  Report B        │  ← Вывод M2 report generator
│  (baseline.json)  │    │  (candidate.json) │
└────────┬─────────┘    └────────┬──────────┘
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │   DiffEngine         │  ← Вычисляет diff с порогами
         └────────┬─────────────┘
                  ▼
         ┌──────────────────────┐
         │   DiffFormatter      │  ← Markdown | HTML | JSON
         └────────┬─────────────┘
                  ▼
         ┌──────────────────────┐
         │   Запись в файл      │
         │   + exit code        │
         └──────────────────────┘
```

**Важно:** Comparator работает на **выходе M2**, а не напрямую на JSONL.
Это даёт:
- Независимость от схемы snapshots (M2 может меняться)
- Возможность сравнить кампании разной длительности (нормализация per-trade)
- Простота: два JSON-файла → один diff

---

## 3. Diff-формат

### 3.1. Вход (ComparativeReport)

```typescript
interface ComparativeReport {
  baseline: {
    id: string           // campaignId
    commit: string       // git commit
    startedAt: string    // ISO
    duration: string     // human
    metrics: ComputedMetrics  // from M2
  }
  candidate: {
    id: string
    commit: string
    startedAt: string
    duration: string
    metrics: ComputedMetrics
  }
  diff: DiffSection[]
}
```

### 3.2. DiffSection

```typescript
interface DiffDelta {
  from: number
  to: number
  abs: number          // to - from
  rel: number          // (to - from) / from * 100
  significance: 'improvement' | 'degradation' | 'unchanged'
}

interface DiffSection {
  title: string         // e.g. "Trading Performance"
  rows: DiffRow[]
}

interface DiffRow {
  label: string         // e.g. "Win Rate"
  baseline: string      // formatted: "61.2%"
  candidate: string     // formatted: "63.4%"
  delta: string         // formatted: "+2.2pp"
  significance: '✅' | '❌' | '➡️'
  abs: number           // numeric for sorting/thresholds
}
```

---

## 4. Пороги значимости (configurable)

| Метрика | Единица | Degradation порог | Improvement порог |
|---|---|---|---|
| Win Rate | pp | < -2% | > +2% |
| Profit Factor | ratio | < -0.10 | > +0.10 |
| Max Drawdown | % equity | > +1% | < -1% |
| Total PnL | USDT | < -$5 | > +$5 |
| Sharpe Ratio | ratio | < -0.3 | > +0.3 |
| Trades | count | < -10% | > +10% |
| Runtime Incidents | count | > +1 | < -1 |
| Avg Commission | USDT | > +0.01 | < -0.01 |
| Avg Slippage | USDT | > +0.01 | < -0.01 |

Если diff выходит за порог, строка получает `✅` (improvement) или `❌` (degradation).
Иначе `➡️` (unchanged).

---

## 5. CLI интерфейс

```bash
# Сравнить две папки кампаний
npx tsx scripts/campaign-comparator.ts \
  --baseline /tmp/campaign-a/report.json \
  --candidate /tmp/campaign-b/report.json

# Сравнить с last known good (LKG) коммитом
npx tsx scripts/campaign-comparator.ts \
  --lkg \
  --candidate /tmp/campaign-b

# Вывод сводки в консоль
npx tsx scripts/campaign-comparator.ts \
  --baseline /tmp/a.json \
  --candidate /tmp/b.json \
  --summary-only
```

**Exit codes:**
- `0` — diff вычислен, нет degradations
- `10` — diff вычислен, есть **деградации** (exit code > 0 для CI)
- `1` — один из отчётов не найден или повреждён

Формат вывода (Markdown):

```markdown
# Campaign Comparator

## Campaign Info

| | Baseline | Candidate |
|---|---|---|
| Campaign ID | paper-20260725 | paper-20260726 |
| Commit | 5615c62 | 3e6587b |
| Started | 2026-07-25 17:00 | 2026-07-26 17:00 |
| Duration | 24h 0m | 24h 2m |
| Snapshot interval | 60s | 58s |

## Trading Performance

| Metric | Baseline | Candidate | Δ | Sig |
|---|---|---|---|---|
| Trades | 1,024 | 1,137 | +113 (+11.0%) | ✅ |
| Win Rate | 59.8% | 63.4% | +3.6pp | ✅ |
| Profit Factor | 1.42 | 1.57 | +0.15 | ✅ |
| Max Drawdown | -$83.20 (-0.83%) | -$67.10 (-0.67%) | -0.16pp | ✅ |
| Recovery Factor | 0.51 | 0.63 | +0.12 | ➡️ |

## Expenses

| Metric | Baseline | Candidate | Δ | Sig |
|---|---|---|---|---|
| Total Fees | $12.40 | $11.80 | -$0.60 | ✅ |
| Avg Commission | $0.0121 | $0.0104 | -$0.0017 | ➡️ |
| Avg Slippage | $0.0098 | $0.0095 | -$0.0003 | ➡️ |

## Risk

| Metric | Baseline | Candidate | Δ | Sig |
|---|---|---|---|---|
| Sharpe (hourly) | 1.87 | 2.14 | +0.27 | ➡️ |
| Sortino | 2.41 | 2.89 | +0.48 | ✅ |
| Exposure (avg) | 47.3% | 45.1% | -2.2pp | ✅ |

## Reliability

| Metric | Baseline | Candidate | Δ | Sig |
|---|---|---|---|---|
| Runtime Incidents | 2 | 0 | -2 | ✅ |
| Invariant Failures | 0 | 0 | 0 | ➡️ |
| Snapshot Gaps | 0 | 0 | 0 | ➡️ |

---

**Summary:** 8 improvements, 0 degradations, 5 unchanged
**Exit code:** 0
```

---

## 6. Компоненты (code structure)

```
scripts/
  campaign-comparator.ts    ← CLI entry point

src/workspace/campaign/
  CampaignComparator.ts     ← DiffEngine
  CampaignComparatorTypes.ts ← type definitions
```

**Источник данных:**
- Базовая линия: `report.json` (выход M2)
- Candidate: `report.json` из другой кампании
- LKG: сохраняется в `reports/lkg-report.json` после каждого завершённого прогона

---

## 7. Интеграция с Git (опционально)

```
pre-push hook:
  npx tsx scripts/campaign-comparator.ts --lkg --candidate ./latest-report.json
  if [ $? -eq 10 ]; then
    echo "❌ Push blocked: performance regression detected"
    exit 1
  fi
```

---

## 8. Критерии готовности M2.5

- [ ] `campaign-comparator.ts` читает два `report.json`
- [ ] Вычисляет diff по всем метрикам из M2
- [ ] Подсвечивает значимые изменения (✅ / ❌ / ➡️)
- [ ] `--summary-only` для быстрой проверки
- [ ] Exit code 10 при деградациях
- [ ] Проверка: сравнение двух копий одного отчёта → 0 изменений
- [ ] Проверка: exit code 10 при искусственной деградации
- [ ] `--lkg` режим (сравнение с last known good)
- [ ] Документированы пороги значимости
