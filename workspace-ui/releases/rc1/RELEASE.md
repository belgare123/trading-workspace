# RC1 — Runtime Foundation Freeze

**Дата:** 2026-07-28
**Тег:** v0.1.0-rc1
**Репозиторий:** `workspace-ui` (монорепозиторий `trading-workspace`)

---

## Phase 1 — Engineering Complete

### Завершённая цепочка

```
Market Data
      │
      ▼
Runtime
      │
      ▼
Replay
      │
      ▼
Projection
      │
      ▼
Analytics
      │
      ▼
Report Generator
      │
      ▼
Campaign Comparator
      │
      ▼
CI Verdict
```

### Спринты Phase 1

| Спринт | Статус |
|--------|--------|
| Sprint 1.1 — Burn-In & Replay | ✅ |
| Sprint 1.2.1 — Trade Statistics | ✅ |
| Sprint 1.2.2 — Equity Analytics | ✅ |
| Sprint 1.2.3 — Report Generator | ✅ |
| Sprint 1.2.4 — Campaign Comparator | ✅ |

---

## Эталонные хэши

### Deterministic Replay Hashes

| Артефакт | Хэш | Описание |
|----------|-----|----------|
| Equity Curve | `9ba030e1e957b6490483c4e44af73703c0803faa9fc1acec4e3bce49a796d008` | SHA-256 от кривой капитала (1524 точки) |
| Trade Journal | `806505e1640d3f32a3f0e2d4ebdd586aefbfec1336da170fb31d2c6838ccd3f5` | SHA-256 от журнала сделок (72 трейда) |

### Burn-In Report

| Метрика | Значение |
|---------|----------|
| Final Equity | $9,216.57 |
| Total Net PnL | -$63.49 |
| Total Trades | 72 closed, 144 total |
| Win Rate | 37.5% |
| Profit Factor | 0.766 |
| Payoff Ratio | 1.28 |
| Max DD | 8.00% |
| Recovery Factor | 0.079 |
| Ulcer Index | 4.83 |

### Comparator Baseline — Identity Check

| Метрика | Значение |
|---------|----------|
| Verdict | PASS |
| Total metrics | 24 |
| Unchanged | 24 |
| Improved | 0 |
| Degraded | 0 |

---

## Эталонные файлы

Все артефакты сохранены в `releases/rc1/`:

| Файл | Описание |
|------|----------|
| `burnin-report.json` | Полный отчёт Burn-In (schema v1) |
| `comparator-baseline.json` | Identity-верификация Comparator |
| `RELEASE.md` | Данный документ |

---

## Критерии прохождения RC1 Gate

1. **Replay детерминизм:** Equity curve hash стабилен между запусками
2. **Trade journal hash:** стабилен между запусками
3. **Report Generator:** все 7 секций (campaign, trading, equity, risk, runtime, reliability, analysis)
4. **Comparator:** baseline == target → 24 unchanged, PASS
5. **Тесты:** 18 тестов Comparator (10 + 8) + 27 report тестов + 4 replay verification
6. **Весь test suite:** 700+ тестов без regressions
