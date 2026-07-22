# Phase 5 — Trading Domain Roadmap

> **Цель:** Превратить платформу из системы исполнения ордеров в полноценный торговый движок,
> используя проверенную механику Freqtrade на более модульной архитектуре.
>
> **Источник:** https://hermes-agent.nousresearch.com/docs (архитектурное решение,
> согласовано 2026-07-20)

---

## Sprint 5.1 — Trade Domain Model

Фундамент всего остального. Полноценная доменная модель вместо примитивных строк.

### Trade (FSM)

```
Created
   ↓
EntryPending
   ↓
EntryPartial
   ↓
EntryFilled
   ↓
Managing
   ↓
ExitPending
   ↓
ExitPartial
   ↓
Closed
```

Альтернативные терминальные состояния: `Cancelled`, `Rejected`.

### Модель Trade

```
Trade
├── id: string
├── strategyId: string
├── symbol: string
├── direction: 'long' | 'short'
├── status: TradeStatus        // текущее состояние FSM
├── lifecycleState: string     // полный путь FSM
├── entry: EntryRecord
├── exits: ExitRecord[]
├── orders: Order[]
├── fills: Fill[]
├── fees: Fee[]
├── realizedPnL: number
├── unrealizedPnL: number
├── metadata: Record<string, unknown>
└── timestamps: { created, updated, ... }
```

### Order (FSM)

```
New
  ↓
Submitted
  ↓
Accepted
  ↓
Working
  ↓
PartialFill
  ↓
Filled
```

Терминальные: `Cancelled`, `Rejected`, `Expired`.

### TradeContext

Один объект, объединяющий всё необходимое для принятия решений:

```typescript
interface TradeContext {
  trade: Trade
  market: MarketData        // цена, объём, спред
  wallet: WalletSnapshot    // баланс, зарезервировано, свободно
  risk: RiskState           // текущие риски, drawdown
  history: Trade[]          //最近的 сделки (N)
  strategy: StrategyMeta    // мета стратегии
}
```

### Lifecycle Events

Все изменения Trade идут через события:

```
TradeOpened
TradeFilled
TradeModified
TradeReduced
TradeClosed
TradeCancelled
TradeErrored
```

Каждый Event — иммутабельный объект с полной копией состояния на момент события.
Источник правды: Runtime генерирует событие → HistoryRuntime пишет → потребители читают.

---

## Sprint 5.2 — TradeLifecycleRuntime ✅

**Статус:** ✅ Реализовано и протестировано (2026-07-20)

### Что сделано

- `TradeLifecycleRuntime` — главный оркестратор, единственный владелец Trade
  - `open()` — создание Trade + entry order через IOrderManager
  - `onOrderEvent()` — роутинг событий OrderManager в EntryController / ExitController
  - `onMarketTick()` — PnL-апдейт, ExitEngine evaluation, trigger exit
  - `requestClose()` — ручное закрытие
  - `updateStopLoss()` / `updateTakeProfit()` — управление стопами
  - `recover()` — восстановление после рестарта
  - `shutdown()` — graceful stop
  - `getActiveTrades()` / `getTrade()` — read-only доступ

- **LifecycleController** — разбиение на 5 контроллеров:
  - `EntryController` — open, onPartialFill, onFilled, onCancelled, onRejected
  - `ManageController` — onMarketTick, updateStopLoss, updateTakeProfit
  - `ExitController` — requestClose, onPartialExitFill
  - `RecoveryController` — recover, createTradeFromPosition
  - `LifecycleEventBus` — typed event bus с wildcard-подписками

- **Event Sourcing** — 13 типов событий, эмитятся при каждом переходе FSM
- **Интерфейсы** — IOrderManager (Sprint 5.3), IExitEngine (Sprint 5.4), IRecoveryGateway
- **trade.runtime/index.ts** — barrel экспорт всего Runtime API

### Структура

```
src/workspace/trade/runtime/
├── index.ts                    — barrel
├── interfaces.ts               — TradeSignal, IOrderManager, IExitEngine, IRecoveryGateway
├── TradeLifecycleRuntime.ts    — главный оркестратор
├── EntryController.ts          — entry lifecycle
├── ManageController.ts         — managing state
├── ExitController.ts           — exit lifecycle
├── RecoveryController.ts       — post-restart recovery
├── LifecycleEventBus.ts        — typed event bus
└── event-factory.ts            — lifecycle event constructors
```

### Тесты

**17 тестов** в `src/workspace/trade/__tests__/TradeLifecycleRuntime.test.ts`:
- C1: open → Filled → Managing
- C2: Multiple partials → Filled
- C3: Cancel/Reject before fill
- C4: Manual close
- C5: TP через ExitEngine
- C6: SL через ExitEngine
- C7: Recovery with open position
- C8: Market tick after recovery
- C9: All lifecycle events emitted
- C10: Trade read-only from outside
- Edge: shutdown, zero-quantity, event-bus, getActiveTrades

**Общий счёт:** 44/44 тестов (27 Trade + 17 Runtime)

---

**Единственный владелец сделки.** Никто, кроме него, не вызывает методы Trade.

### Архитектура

```
TradeLifecycleRuntime
   │
   ├── EntryController      — open(), onOrderAccepted(), onPartialFill(), onFilled()
   ├── ManageController     — onMarketTick(), updateStopLoss(), updateTakeProfit()
   ├── ExitController       — requestClose(), onClosed(), integrate ExitEngine
   ├── RecoveryController   — recover() после рестарта/разрыва WS
   └── LifecycleEventBus    — эмиссия Lifecycle Events
```

### API

```typescript
interface TradeLifecycleRuntime {
  // Entry
  open(signal: Signal): Promise<Trade>           // сигнал → создание сделки → отправка ордера

  // Order lifecycle (от OrderManager)
  onOrderAccepted(orderId: string): void         // ордер принят биржей
  onPartialFill(fill: Fill): void                // частичное исполнение → update VWAP
  onFilled(orderId: string): void                // ордер полностью исполнен

  // Management
  onMarketTick(market: MarketSnapshot): void      // каждый тик: PnL → ExitEngine → решение
  updateStopLoss(tradeId: string, price: number): void
  updateTakeProfit(tradeId: string, price: number): void

  // Exit
  requestClose(tradeId: string, reason: ExitReason): Promise<void>  // ручной/автоматический выход
  onClosed(tradeId: string): void

  // Recovery
  recover(): Promise<void>                        // восстановление из TradeDB + биржа

  // Lifecycle
  shutdown(): void                                // graceful stop
  getActiveTrades(): Trade[]                      // для внешних запросов (readonly)
}
```

### Что слушает TradeLifecycleRuntime

| Источник | Событие | Реакция |
|----------|---------|---------|
| **Market Feed** | onMarketTick | PnL update → ExitEngine.evaluate(TradeContext) |
| **OrderManager** | onOrderAccepted | trade status remains EntryPending/ExitPending |
| **OrderManager** | onPartialFill | addEntryFill / addExitFill → VWAP update |
| **OrderManager** | onFilled | completeEntry → setManaging (entry) OR close exit |
| **OrderManager** | onCancelled | если EntryPending → trade.cancel() |
| **OrderManager** | onRejected | trade.reject(reason) |
| **ExitEngine** | ExitDecision | requestClose с причиной |
| **Recovery** | recover() | создание Trade из позиции биржи + переход в Managing |

### Recovery — встроить сразу

После рестарта процесса:

```
Биржа → getPositions() → Position BTCUSDT существует, Trade в БД нет
                                     ↓
                          TradeRecoveryController
                                     ↓
                          TradeLifecycleRuntime
                                     ↓
                          Trade создан → Managing
```

RecoveryController:
1. Fetch открытые позиции с биржи (через Gateway)
2. Fetch активные ордера
3. Создать Trade для каждой позиции (статус Managing)
4. Привязать активные ордера к Trade (OrderManager)
5. Возобновить мониторинг (ManageController.onMarketTick)

Не ждать действий стратегии — восстановление автоматическое.

### Event Sourcing

TradeLifecycleRuntime **генерирует**, но **не слушает** собственные события:

```typescript
// После каждого изменения Trade:
eventBus.emit(new TradeLifecycleEvent(trade, 'trade:opened'))
eventBus.emit(new TradeLifecycleEvent(trade, 'trade:filled'))
eventBus.emit(new TradeLifecycleEvent(trade, 'trade:closed'))
// ...
// TradeLifecycleRuntime НЕ подписан на свои события
```

### Pipeline

```
Strategy Runtime
     │
     ▼ (open/signal)
TradeLifecycleRuntime
     │
     ├── EntryController → OrderManager → Gateway
     │
     ├── MarketFeed.onMarketTick
     │       │
     │       ▼
     │   ManageController → ExitEngine.evaluate(TradeContext)
     │       │
     │       ▼
     │   ExitController → OrderManager → Gateway
     │
     ├── RecoveryController → Gateway.getPositions()
     │
     └── LifecycleEventBus → HistoryRuntime, MetricsRuntime, UI, Observability
```

### Критерий готовности Sprint 5.2

Спринт завершён, если проходят следующие сценарии:

| # | Сценарий | Описание |
|---|----------|----------|
| 1 | **Strategy → open() → Filled → Managing** | Полный цикл входа: сигнал → ордер → fill → Managing |
| 2 | **Частичное исполнение → Partial → Filled** | EntryPartial с VWAP → completeEntry → Managing |
| 3 | **Cancel до Fill** | Отмена ордера до fill → trade в Cancelled |
| 4 | **Manual Close** | requestClose → ExitPending → ордер → fill → Closed |
| 5 | **TP через ExitEngine** | onMarketTick достигает ROI → ExitDecision → Close |
| 6 | **SL через ExitEngine** | onMarketTick достигает SL → ExitDecision → Close |
| 7 | **Recovery после рестарта** | Есть позиция на бирже → Recovery → Trade в Managing |
| 8 | **Восстановление после разрыва WS** | WS reconnect → getPositions → reconcile → resume |
| 9 | **Все переходы → Lifecycle Events** | Каждое изменение Trade сопровождается событием |
| 10 | **Trade immutable для внешних** | Trade не изменяется напрямую нигде, кроме Runtime |

---

## Sprint 5.3 — OrderManager

**State machine для ордеров. Gateway остаётся тонким прокси к бирже.**

### Ответственность

- Отправка ордера через Gateway
- Polling статуса (1s → 5s → 15s → exponential backoff)
- Retry при временных ошибках
- Replace зависших лимиток (cancel + re-place)
- Timeout контроль (лимитки, IOC, FOK)
- Reconciliation (сверка с биржей)
- Подписка на private WS для статусов

### НЕ входит в OrderManager

- Расчёт размера позиции — WalletManager
- Решение о входе/выходе — TradeLifecycleRuntime
- Логика тейков/стопов — ExitEngine

---

## Sprint 5.4 — Exit Engine

**Chain of responsibility для решений о выходе.**

### PolicyChain

```
ExitEngine.evaluate(context: TradeContext): ExitDecision
     │
     ▼
  ROIPolicy         ← если ROI target достигнут → Exit
     │
     ▼
  StopLossPolicy    ← если SL сработал → Exit
     │
     ▼
  TrailingPolicy    ← если trailing стоп активирован → Exit
     │
     ▼
  TimePolicy        ← если таймаут сделки истёк → Exit
     │
     ▼
  EmergencyPolicy   ← если экстренные условия → Exit
     │
     ▼
  → null (continue)
```

### Контракт политики

```typescript
interface ExitPolicy {
  name: string
  evaluate(context: TradeContext): ExitDecision | null
}

interface ExitDecision {
  reason: string              // 'roi', 'stoploss', 'trailing', 'time', 'emergency'
  exitPrice: number
  exitType: 'market' | 'limit'
  quantity: 'all' | number    // полный или частичный выход
  priority: number            // 0 (ROI) → 100 (emergency)
}
```

---

## Sprint 5.5 — WalletManager

**Владелец всего капитала. Единая точка расчёта размера позиции.**

### Состояние

```
Balance      ← баланс на бирже
Reserved     ← занято под открытые ордера
Free         ← доступно для торговли
Margin       ← маржа открытых позиций
Available    ← Free - Margin
Exposure     ← текущая экспозиция
Leverage     ← плечо
Fees         ← комиссии (накопленные)
Funding      ← funding rate (если perp)
```

### API

```typescript
interface WalletManager {
  getSnapshot(): WalletSnapshot
  calculatePositionSize(params: {
    riskPercent: number
    entryPrice: number
    stopLossPrice: number
    leverage: number
  }): number
  canOpenTrade(symbol: string, size: number): boolean
  reserve(size: number): void       // зарезервировать под ордер
  release(size: number): void       // освободить (отмена/закрытие)
  getMaxPosition(symbol: string): number
}
```

---

## Sprint 5.6 — Protection Runtime

**Защиты, не привязанные к конкретной сделке.**

- **Cooldown Period** — задержка между входами по одному сигналу
- **Max Drawdown Protection** — остановка при превышении просадки
- **Stoploss Guard** — пропуск входа при слишком узком SL
- **Low Profit Protection** — не входить при низком ожидаемом профите
- **Max Concurrent Trades** — лимит на количество открытых сделок
- **Pair Lock** — временная блокировка пары после неудачной сделки

Ложится внутрь `RiskRuntime`. Каждая защита — отдельный класс с методом `check(context): ProtectionVote`.

---

## Sprint 5.7 — Position Manager

**Управление открытой позицией (поверх TradeLifecycleRuntime).**

- Перенос стопа в безубыток (break-even)
- Trailing stop
- Частичное закрытие (partial exit)
- DCA (усреднение)
- Pyramiding (добавление к позиции)
- Повторный вход после частичного выхода

**Статус: v2.** Не требует Sprint 5.1–5.6 для реализации, но опирается на них.

---

## Архитектурные принципы (Frozen API)

### Правило 1. TradeLifecycleRuntime — единственный владелец Trade

После Sprint 5.2 **никто, кроме TradeLifecycleRuntime, не вызывает методы Trade**:
- `trade.completeEntry()`
- `trade.setManaging()`
- `trade.addExitFill()`
- `trade.cancel()`
- `trade.transitionTo()`

Даже OrderManager и ExitEngine **не меняют Trade напрямую**. Они делегируют изменения через TradeLifecycleRuntime.

```
Strategy
   │
   ▼
TradeLifecycleRuntime   ←── единственный owner Trade
   │
   ├── Trade
   ├── OrderManager
   ├── ExitEngine
   └── WalletManager
```

Нарушение = архитектурный debt. Исключений нет.

### Правило 2. Lifecycle Event Sourcing

Lifecycle Events — **единственный способ уведомления** остальных Runtime.

```
TradeOpened
   │
   ├── HistoryRuntime
   ├── MetricsRuntime
   ├── RiskRuntime
   ├── Workspace UI
   └── Observability
```

TradeLifecycleRuntime не знает о существовании UI, History или метрик. Он генерирует событие — подписчики получают его через EventBus.

### Правило 3. LifecycleController

Runtime делится на контроллеры, а не растёт как единый God Object:

```
TradeLifecycleRuntime
   │
   ├── EntryController     — вход в позицию
   ├── ManageController    — управление открытой позицией
   ├── ExitController      — выход из позиции
   ├── RecoveryController   — восстановление после рестарта/разрыва
   └── LifecycleEventBus   — эмиссия событий
```

Контроллеры могут быть маленькими на старте, но через несколько спринтов они вырастут (Trailing Stop, Partial Exit, DCA, Time Exit). Заложить это разделение сразу.

### Правила 4–6 (из Sprint 5.1)

4. **FSM:** Состояния Trade и Order — конечные автоматы с явными переходами.
5. **Policy Chain:** Каждый ExitPolicy — отдельный класс с `evaluate(TradeContext): ExitDecision`.
6. **Gateway thin:** Без логики жизненного цикла ордеров.

---

## Что отложено (v2)

| Компонент | Причина |
|-----------|---------|
| DCA | Требует OrderManager + WalletManager |
| Pyramiding | Требует RiskRuntime + ProtectionRuntime |
| Grid Trading | Отдельная стратегия |
| PairLock | ProtectionRuntime v2 |
| Hyperopt | Отдельный Optimization Runtime |
| FreqAI | ML-слой, не входит в Trading Domain |

---

## Зависимости спринтов

```
5.1 Trade Model ─────────────────────────────────────┐
    │                                                 │
    ├── 5.2 TradeLifecycleRuntime ────────────────┐   │
    │       │                                      │   │
    │       ├── 5.3 OrderManager ────────┐         │   │
    │       │       │                     │         │   │
    │       │       └── 5.4 Exit Engine ──┤         │   │
    │       │                             │         │   │
    │       ├── 5.5 WalletManager ────────┼───┐     │   │
    │       │       │                     │   │     │   │
    │       │       └── 5.6 Protection ───┤   │     │   │
    │       │                             │   │     │   │
    │       └── 5.7 Position Manager ─────┘   │     │   │
    │                                          │     │   │
    └──────────────────────────────────────────┘─────┘   │
                                                         │
    HistoryRuntime (существующий) ←───────────────────────┘
```
