# Live Transition Checklist

**Статус:** Планирование (Freeze Window)
**Назначение:** Чек-лист для перехода от Paper Trading к минимальной реальной торговле.
**Принцип:** Каждый переход — формальный, с объективными критериями. Никаких «ну вроде готов».

---

## Stage 0 — Предварительные условия

*Должны быть выполнены ДО начала любых обсуждений Live.*

### Paper Campaign (7d)

- [ ] 7-дневная Paper Campaign завершена без перезапусков
- [ ] Uptime > 99.9% (макс 10 минут downtime за 7 дней)
- [ ] Все 24×7 = 168 часов покрыты snapshot-ами
- [ ] Zero invariant violations за весь период
- [ ] Zero orphan orders
- [ ] Zero unhandled exceptions
- [ ] Certification pass rate = 100% на каждом прогоне
- [ ] M2 Report сгенерирован за 7 дней
- [ ] M2.5 diff: Paper vs Paper (baseline) — не более 2% variance

### Infrastructure

- [ ] `campaign:health` настроен как cron (каждые 5 мин)
- [ ] `campaign:verify` настроен как cron (каждые 1 час)
- [ ] Telegram-уведомления о падении кампании
- [ ] Kill switch (Telegram command + auto-detection)
- [ ] Daily loss limit — stop trading
- [ ] Position limit — stop opening
- [ ] Order rate limit — throttle

### Risk Parameters (pre-set)

```yaml
risk_limits:
  max_capital: 200          # USDT
  max_daily_loss: 10        # USDT (5%)
  max_daily_loss_pct: 5     # % of capital
  max_position_size: 50     # USDT (25%)
  max_open_positions: 2
  max_strategies: 1
  cooldown_after_loss: 3600 # 1 hour
  cooldown_after_stop: 86400 # 24 hours
```

---

## Stage 1 — Testnet Validation (3+ дней)

### 1.1. Bybit Testnet (USDT pair)

- [ ] API key created (testnet)
- [ ] Manual: deposit test USDT
- [ ] `paper-campaign.ts` переключен на Testnet
- [ ] Burn-in (24h) — без ошибок
- [ ] M2.5: Paper vs Testnet — divergence < 2%
- [ ] Kill switch test: Telegram stop → trading halts < 5s
- [ ] Kill switch test: auto (daily loss) → trading halts
- [ ] Manual: place a trade via UI → fills correctly
- [ ] Manual: cancel trade → cancelled correctly
- [ ] Reconciliation: positions match exchange

### 1.2. Bybit Testnet (BTC pair)

- [ ] Repeat 1.1 with BTCUSDT
- [ ] Требование: stable на 3 дня

### 1.3. Binance Testnet (USDT + BTC)

- [ ] Repeat 1.1–1.2 with Binance
- [ ] Требование: stable на 3 дня

### 1.4. Trading Validation Report

- [ ] Сводка по всем testnet-прогонам
- [ ] M2 отчёты за каждый прогон
- [ ] Сравнение Paper vs Testnet (M2.5)
- [ ] Список расхождений (если есть)

---

## Stage 2 — Minimal Live

### 2.1. Pre-Launch

#### Legal & Security

- [ ] Условия использования биржи прочитаны
- [ ] Налоговые последствия понятны (если применимо)
- [ ] API key permissions: только TRADE (ничего лишнего)
- [ ] API key IP whitelist установлен
- [ ] API key withdrawal: DISABLED
- [ ] 2FA на exchange аккаунте включена
- [ ] Exchange email alerts включены
- [ ] Telegram bot — единственный канал управления

#### Risk (hard)

- [ ] `max_capital = $200` (настраивается в коде)
- [ ] `max_daily_loss = $10` (stop trading hard limit)
- [ ] `max_position_size = $50` (25% капитала)
- [ ] `cooldown = 1h` после стоп-лосса
- [ ] Daily manual sign-off required (>$5 loss = review)

#### Monitoring

- [ ] `campaign:health` — cron 5 min → Telegram alert if exit 1
- [ ] `campaign:verify` — cron 1h
- [ ] `campaign:tail` — dashboard на видном месте
- [ ] Reconciliation auto — после каждого restart + каждые N min
- [ ] Telegram kill switch: `/trade stop` → немедленный stop
- [ ] Telegram kill switch: `/trade status` → состояние

#### Paper Channel

- [ ] Параллельно работает Paper Campaign на том же market data
- [ ] Можно сравнивать Live vs Paper в реальном времени

### 2.2. Launch Sequence

```yaml
day_1:
  - 09:00 — Fund account ($50 из $200 лимита)
  - 09:05 — Start campaign (minimal mode)
  - 09:10 — First 15 min: watch only
  - 09:25 — Allow trading
  - 17:00 — Day 1 manual sign-off

day_2_7:
  - Ежедневный manual sign-off
  - Telegram daily report (M2 summary)
```

### 2.3. Daily Sign-off Template

```markdown
# Live Trading — Day N Sign-off

## Date: 2026-08-15

## PnL: +$2.34 / -$1.20 / $0.00

## Risk Limits
- Max daily loss ($10): ❌ not triggered
- Max position ($50): ❌ not exceeded
- Cooldown: ❌ not active

## Health
- Feed: ✅ healthy
- Broker: ✅ healthy
- Strategy: ✅ healthy

## Exceptions
- Today: 0
- Campaign total: 0

## Verification
- campaign-health: ✅ exit 0
- campaign-verify: ✅ exit 0

## Signed off by: [manual]

## Decision: [continue / halt / review]
```

---

## Stage 3 — Gradual Scaling

*Только если Stage 2 стабилен минимум 7 дней.*

| Step | Capital | Max Loss/Day | Max Position | Duration |
|---|---|---|---|---|
| 3.1 | $200 → $500 | $10 → $25 | $50 → $125 | 7 days |
| 3.2 | $500 → $1,000 | $25 → $50 | $125 → $250 | 14 days |
| 3.3 | $1,000 → $2,000 | $50 → $100 | $250 → $500 | 30 days |

**Критерий для каждого шага:**
- Zero days with max loss triggered
- Win rate > 50% на дистанции
- Sharpe > 1.0 (daily)
- Recovery factor > 2.0

---

## Stage 4 — Full Live Platform

*Только после 90+ дней стабильной работы.*

- Portfolio Manager (>1 strategy)
- Multi-exchange
- Risk Engine (dynamic limits)
- Automated reconciliation
- Monthly M2 report
- Quarterly review

---

## Emergency Procedures

### Kill Switch

```
/stop             → немедленно завершить все позиции market order
/stop-cooldown    → close-only режим на N часов
/status           → текущее состояние (PnL, positions, orders)
/limits           → текущие лимиты
```

### Auto-Stop Triggers

| Trigger | Action |
|---|---|
| Daily loss > 5% | Hard stop, cooldown 24h |
| Drawdown > 10% | Hard stop, manual review required |
| Feed disconnect > 60s | Close-only mode |
| 3 consecutive invariant failures | Hard stop |
| Unhandled exception in trade path | Hard stop |

### Recovery

1. Stop all trading
2. Reconcile positions manually
3. Compare Paper vs Live divergence
4. Fix root cause
5. Re-test on Paper (24h minimum)
6. Resume Live only after Paper green

---

## Итог

```
Paper (7d, clean)  ──→  Testnet (3d, clean)  ──→  Live ($200, min)
                                                            │
                                                    ┌───────┴───────┐
                                                    │               │
                                            Scale (step 3)  Paper (parallel)
```

Переход в Live — это не старт, а **процесс**.
Каждый этап требует formal sign-off.
Если что-то идёт не так — возврат на предыдущий этап.
