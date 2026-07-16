# Trading Workspace — Integration Scenarios v1.0

> **Status:** Draft · **Date:** 2026-07-16  
> **Purpose:** Formal verification that all Runtime components work together in realistic user scenarios.  
> **Principle:** No new Runtime modules — only end-to-end validation of the existing architecture.

---

## 1. Scope

This document defines five canonical integration scenarios that exercise every major Runtime in the platform. A scenario passes when it completes without manual intervention, state divergence, or unexpected hangs.

### Runtime Inventory

| Runtime | Module | Sprint |
|---------|--------|--------|
| Market Data | `LiveFeedRuntime`, `MarketEventBus` | 4.1 |
| Strategy | `StrategyRuntime` | 3.4 |
| Signal | `SignalEngine` | 3.4 |
| Condition | `ConditionEngine` | 3.4 |
| Action | `ActionEngine` | 3.4 |
| Risk | `RiskRuntime` | 4.7 |
| Execution Gateway | `ExecutionGateway`, `GatewayRuntime` | 4.1 |
| Paper Provider | `PaperProvider` | 4.3 |
| Live Provider | `LiveProvider` | 4.5 |
| Rate Limiter | `RateLimiter` | 4.6.1 |
| Retry Policy | `RetryPolicy` | 4.6.1 |
| Broker Session | `BrokerSession` | 4.5 |
| Order Router | `OrderRouter` | 4.5 |
| Position Sync | `PositionSynchronizer` | 4.5 |
| Account Sync | `AccountSynchronizer` | 4.5 |
| OrderStateReconciler | `OrderStateReconciler` | 4.6.2 |
| Clock Sync | `BrokerClock` | 4.6.3 |
| Secrets Provider | `SecretsProvider` | 4.6.4 |
| Execution Recovery | `ExecutionRecoveryRuntime` | 4.6.6 |
| History | `HistoryRuntime`, `OrderHistoryStore` | 4.4 |
| Metrics | `MetricsRuntime` | 4.4 |
| Reports | `ReportEngine` | 3.5 |

### Pipeline (Forward)

```
MarketData → Strategy → Signal → Condition → Action → Risk
  → ExecutionGateway → LiveProvider
      ├─ RateLimiter → RetryPolicy → BrokerAdapter → Exchange
      └─ SecretsProvider · BrokerClock · OrderRouter → BrokerSession
```

### Pipeline (Feedback)

```
Exchange → OrderStateReconciler → ExecutionRecoveryRuntime
  → OrderHistoryStore → MetricsRuntime → ReportEngine
```

---

## 2. Scenario 1 — Full Paper Round-Trip

**Goal:** Verify that a complete strategy execution cycle produces correct state transitions from market data through to reports.

### Preconditions

| Item | Value |
|------|-------|
| Market Data | MockFeedAdapter with 30 days of 1m candles (BTC/USDT) |
| Strategy | Simple moving average crossover (slow=50, fast=20) |
| Execution Mode | `paper` |
| Initial Balance | 10,000 USDT |
| Risk Rules | Max position 20%, max drawdown 5%, stop-loss 2% |
| Rate Limiter | Disabled |
| Retry Policy | Disabled |

### Steps

| # | Action | Expected State |
|---|--------|----------------|
| 1.1 | Start market data feed | `MarketEventBus` delivering ticker events |
| 1.2 | Start strategy | `StrategyRuntime` producing `SignalBundle` on each candle close |
| 1.3 | Signal → Condition → Action | `ActionEngine` emits `OrderRequest` |
| 1.4 | Risk evaluation | `RiskRuntime` returns `allow` (no rules breached) |
| 1.5 | ExecutionGateway receives order | `GatewayRuntime.status.connected = true` |
| 1.6 | PaperProvider fills order | `Order.status = filled`, `Position` created |
| 1.7 | Position triggers PnL update | `Position.unrealizedPnl ≠ 0` |
| 1.8 | Close condition met → exit order | Opposite order fills, position closes |
| 1.9 | History records the trade | `OrderHistoryStore` has entry with entry+exit |
| 1.10 | Metrics computed | `MetricsRuntime` shows Sharpe, win rate, total PnL |
| 1.11 | Report generated | `ReportEngine` produces PDF/JSON report |

### Verification Table

| Check | Pass/Fail | Evidence |
|-------|-----------|----------|
| Orders reach PaperProvider | □ | OrderRouter log + PaperProvider order book |
| Fills produce Positions | □ | PositionSynchronizer position list |
| PnL reflects entry − exit | □ | Position.unrealizedPnl after price move |
| Trade recorded in History | □ | OrderHistoryStore.query({symbol}) |
| Metrics non-zero | □ | MetricsRuntime.snapshot() |
| Report generated | □ | ReportEngine.lastReport path exists |

### Failure Modes

| Failure | Symptom | Root Cause |
|---------|---------|------------|
| Order not routed | Log silent after `route()` | RateLimiter block or OrderRouter not wired |
| Fill never arrives | PaperProvider sees no order | Gateway → Provider dispatch broken |
| Position not created | PositionSynchronizer empty | `onOrderFilled` event not fired |
| PnL stuck at 0 | Position has no price link | `currentPrice` not updated by feed |
| History empty | Store.query returns `[]` | `ExecutionEvent` not emitted after fill |

---

## 3. Scenario 2 — Disconnect & Recovery

**Goal:** Verify that the platform survives a simulated network disconnection, correctly reconciles state, and resumes trading without data loss or duplicate orders.

### Preconditions

| Item | Value |
|------|-------|
| Execution Mode | `live` (with MockBrokerAdapter) |
| Open Orders | 2 limit orders (one partially filled) |
| Open Position | 1 long (0.5 BTC at 30,000) |
| Network Drop | Simulated via `BrokerAdapter.disconnect()` |

### Steps

| # | Action | Expected State |
|---|--------|----------------|
| 2.1 | Place 3 orders via OrderRouter | 2 open, 1 filled → position created |
| 2.2 | Simulate network drop | `BrokerSession.state → DISCONNECTED` |
| 2.3 | All pending orders marked `pending_recovery` | `OrderStateReconciler` flags mismatch |
| 2.4 | Wait 5 seconds | `BrokerSession` auto-reconnect fires |
| 2.5 | Reconnect succeeds | `BrokerSession.state → CONNECTED` |
| 2.6 | `ExecutionRecoveryRuntime.recover()` triggered | Recovery phase = `fetching_broker_state` |
| 2.7 | Broker returns open orders + positions | Recovery phase = `reconciling` |
| 2.8 | Reconciler compares local vs broker state | Issues generated for each divergence |
| 2.9 | Missing orders resubmitted | New `clientOrderId` with `retry: true` |
| 2.10 | Positions reconciled | `PositionSynchronizer` matches broker |
| 2.11 | Trading resumes | Gateway accepts new orders |
| 2.12 | Recovery report emitted | `RecoveryReport` with issue count, action taken |
| 2.13 | History event logged | `ExecutionEventType.RECOVERY_COMPLETE` |

### Verification Table

| Check | Pass/Fail | Evidence |
|-------|-----------|----------|
| State transitions: CONNECTED → DISCONNECTED → CONNECTED | □ | BrokerSession.log |
| Reconciler detected order mismatch | □ | ReconciliationResult.issues.length > 0 |
| Resubmitted orders have new clientOrderId | □ | BrokerAdapter.placeOrder calls logged |
| Position size unchanged after recovery | □ | PositionSynchronizer.getPositions() |
| No duplicate fills | □ | TradeJournal shows no duplicate trade IDs |
| Recovery report has `completed: true` | □ | RecoveryRuntime.lastReport.completed |
| History contains `RECOVERY_COMPLETE` entry | □ | OrderHistoryStore.query({type: 'recovery'}) |

### Failure Modes

| Failure | Symptom | Root Cause |
|---------|---------|------------|
| Reconnect never fires | Session stuck in DISCONNECTED | `autoReconnect` not configured in BrokerSession |
| Duplicate orders | Client order ID collision | Resubmit doesn't generate new ID |
| Position doubled | Reconciler adds position on top of existing | `setLocalState` not called before reconcile |
| Recovery not triggered | No `recover()` call after connect | Event hook missing in LiveProvider.onReconnect |

---

## 4. Scenario 3 — Kill Switch (Emergency Stop)

**Goal:** Verify that the Kill Switch immediately stops all trading, cancels all open orders, closes all positions, and prevents new order submissions.

### Preconditions

| Item | Value |
|------|-------|
| Execution Mode | `live` (MockBrokerAdapter) |
| Open Orders | 5 limit orders at various prices |
| Open Position | 2 positions (1 long BTC, 1 short ETH) |
| Rate Limiter | Enabled (10 req/s) |

### Steps

| # | Action | Expected State |
|---|--------|----------------|
| 3.1 | Place orders + open positions | 5 open orders, 2 positions active |
| 3.2 | Trigger Kill Switch | `RiskRuntime.kill()` called |
| 3.3 | All open orders cancelled | BrokerAdapter.cancelOrder called for each |
| 3.4 | All positions closed | BrokerAdapter.placeOrder for opposite sides |
| 3.5 | New order submission blocked | `OrderRouter.route()` throws `KillSwitchError` |
| 3.6 | Gateway status = `emergency_stop` | `GatewayRuntime.getStatus().mode = 'kill'` |
| 3.7 | Kill event written to history | `ExecutionEventType.KILL_SWITCH_ACTIVATED` |
| 3.8 | Report snapshot taken | Current portfolio state saved to `KillReport` |

### Verification Table

| Check | Pass/Fail | Evidence |
|-------|-----------|----------|
| 5 orders cancelled | □ | BrokerAdapter logs show 5 cancel calls |
| 2 positions closed | □ | PositionSynchronizer reports 0 positions |
| `route()` throws on new order | □ | try/catch returns `KillSwitchError` |
| Gateway status = emergency_stop | □ | gatewayRuntime.getStatus().mode |
| History contains kill event | □ | OrderHistoryStore.query({type: 'kill'}) |
| Kill report saved | □ | File exists at `reports/kill/*.json` |

### Failure Modes

| Failure | Symptom | Root Cause |
|---------|---------|------------|
| Orders not cancelled | Cancel calls missing | KillSwitch not connected to OrderRouter |
| Position close rejected by broker | Broker returns error on market order | PositionSynchronizer bypasses Risk on kill |
| New orders still accepted | `route()` returns normally | OrderRouter doesn't check kill flag |
| Partial cancel | Some orders remain open | Async cancellation not awaited |

---

## 5. Scenario 4 — Rate Limit & Retry

**Goal:** Verify that the rate limiter correctly throttles requests and that the retry policy recovers from transient broker errors without data loss.

### Preconditions

| Item | Value |
|------|-------|
| Execution Mode | `paper` |
| Rate Limiter | 5 req/s burst, 10 req/s sustained |
| Retry Policy | 3 attempts, exponential backoff (1s, 2s, 4s) |
| Broker | MockBrokerAdapter configured to fail every 3rd call with `TemporaryUnavailableError` |

### Steps

| # | Action | Expected State |
|---|--------|----------------|
| 4.1 | Send 12 order requests rapidly (within 1 second) | First 5 pass, next 7 queued by RateLimiter |
| 4.2 | Rate limit kicks in | `RateLimiter.acquire()` blocks for requests 6–12 |
| 4.3 | Requests throttle to 5/s | Requests 6–10 emitted after 1s window |
| 4.4 | MockBroker returns `TemporaryUnavailableError` on 3rd, 6th, 9th order | `RetryPolicy.execute()` catches |
| 4.5 | Retry fires with backoff | Delay: 1s → 2s → 4s |
| 4.6 | Order succeeds on retry | `OrderRouter.route()` returns `BrokerOrder` |
| 4.7 | All 12 orders eventually filled | `Order.status = filled` for all |
| 4.8 | History records rate limit events | `RATE_LIMIT_WARNING` events in store |
| 4.9 | Metrics show retry count | `MetricsRuntime.retryCount > 0` |

### Verification Table

| Check | Pass/Fail | Evidence |
|-------|-----------|----------|
| RateLimiter blocks >5 req/s | □ | `acquire()` call times > 200ms for burst requests |
| Retry fires on TemporaryUnavailableError | □ | RetryPolicy log shows `attempt=2,3` |
| Backoff delays increase | □ | Measured delay between attempts: ~1s, ~2s, ~4s |
| All 12 orders filled | □ | PaperProvider order book: 12 filled |
| No duplicate fills | □ | Each order ID appears once in TradeJournal |
| Rate limit events in history | □ | OrderHistoryStore.query({type: 'rate_limit'}) |
| Retry count > 0 in metrics | □ | MetricsRuntime.snapshot().retryCount |

### Failure Modes

| Failure | Symptom | Root Cause |
|---------|---------|------------|
| All 12 pass instantly | No rate limiting visible | RateLimiter not wired in OrderRouter |
| Retry gives up after 1 attempt | Only 1 retry logged | RetryPolicy.maxAttempts = 1 |
| Duplicate order execution | Order submitted twice from retry | Retry re-uses same clientOrderId |
| Rate limit never recovers | All subsequent requests blocked | RateLimiter token bucket not refilling |
| Retry fires on non-retryable error | RetryPolicy catches ValidationError | Error classification incorrect |

---

## 6. Scenario 5 — Strategy Restart & Position Recovery

**Goal:** Verify that restarting a strategy preserves open positions and the new strategy instance correctly adopts the existing portfolio state without double-counting.

### Preconditions

| Item | Value |
|------|-------|
| Execution Mode | `paper` |
| Strategy | Grid strategy with 5 active limit orders |
| Open Position | 0.3 BTC long at 29,500 |
| Pending Orders | 3 buy limits, 2 sell limits |
| Persistence | Strategy state saved to `StrategyHistoryStore` |

### Steps

| # | Action | Expected State |
|---|--------|----------------|
| 5.1 | Strategy running with orders + position | Active trading state |
| 5.2 | Strategy restart triggered | StrategyRuntime.shutdown() → init() |
| 5.3 | On restart, `ExecutionRecoveryRuntime` loads broker state | Open orders + positions fetched |
| 5.4 | Reconciler matches broker state with last saved strategy state | 3 buy + 2 sell orders match |
| 5.5 | New strategy instance receives current positions | Position list passed to strategy.onRestore() |
| 5.6 | Strategy emits new signals based on restored state | Grid continues from current price |
| 5.7 | No duplicate positions created | Position count unchanged |
| 5.8 | PnL continuity preserved | `unrealizedPnl` continues from pre-restart value |
| 5.9 | History records `STRATEGY_RESTART` | Entry in OrderHistoryStore |

### Verification Table

| Check | Pass/Fail | Evidence |
|-------|-----------|----------|
| Open orders preserved after restart | □ | Order list unchanged |
| Position count unchanged | □ | PositionSynchronizer: same count |
| Strategy emits signals within 1s | □ | StrategyRuntime signal log |
| No duplicate orders submitted | □ | BrokerAdapter shows no extra `placeOrder` |
| PnL doesn't reset to 0 | □ | unrealizedPnl ≈ same as pre-restart |
| Strategy restored with context | □ | `strategy.getState()` matches pre-restart |
| History has STRATEGY_RESTART event | □ | OrderHistoryStore.query({type: 'restart'}) |

### Failure Modes

| Failure | Symptom | Root Cause |
|---------|---------|------------|
| Strategy starts empty | No positions loaded | `onRestore()` not called |
| Orders duplicated | Strategy re-submits existing orders | Reconciler not consulted before strategy init |
| Position count doubles | Both recovery + strategy add positions | `LiveProvider` doesn't deduplicate |
| PnL resets to 0 | Position has no `averageEntryPrice` | Position persistence doesn't include entry price |
| Strategy hangs | `onRestore()` blocks forever | Async deadlock in recovery pipeline |

---

## 7. Execution Plan

### Phases

| Phase | Duration | Activities |
|-------|----------|------------|
| P1 — Environment Setup | 1h | Mock data feed, broker simulators, test config, Docker containers |
| P2 — Scenario 1 (Paper Round-Trip) | 3h | Full cycle including History + Metrics verification |
| P3 — Scenario 2 (Disconnect & Recovery) | 2h | Simulate network drop at each pipeline stage |
| P4 — Scenario 3 (Kill Switch) | 1h | Emergency stop, position close, kill lock verification |
| P5 — Scenario 4 (Rate Limit & Retry) | 2h | Burst test, broker fault injection, retry verification |
| P6 — Scenario 5 (Strategy Restart) | 2h | State persistence, restore, PnL continuity |
| P7 — Regression & Report | 2h | Full re-run, consolidated report |

### Success Criteria

- All 5 scenarios pass with **no manual state corrections**
- Each verification table cell marked ✅
- No unexpected errors in any Runtime log
- History + Metrics reflect all actions taken
- Total runtime: < 12 hours (fully automated)

### Tooling

| Need | Solution |
|------|----------|
| Test harness | Custom `IntegrationHarness` class with lifecycle hooks |
| Broker mock | `MockBrokerAdapter` with configurable failure modes |
| Data feed | `MockFeedAdapter` with recorded candle replay |
| Assertions | Per-scenario `ScenarioVerifier` that checks verification tables |
| Reporting | `IntegrationReport` outputs Markdown + JSON to `reports/integration/` |
| CI mode | `npm run test:integration` (or `docker compose up integration`) |

---

## 8. Appendix — Runtime Dependency Map

```
                         ┌─────────────┐
                         │ Market Data │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │   Strategy  │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │   Signal    │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │  Condition  │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │   Action    │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │    Risk     │◄──── Kill Switch
                         └──────┬──────┘
                                │
                         ┌──────▼────────┐
                         │ExecutionGateway│
                         └──────┬────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
             ┌──────▼────┐ ┌───▼────┐ ┌────▼──────┐
             │   Paper   │ │  Live  │ │ Backtest  │
             └───────────┘ └───┬────┘ └───────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
             ┌──────▼───┐ ┌───▼────┐ ┌───▼───────┐
             │RateLimiter│ │RetryPol│ │SecretsProv│
             └──────┬───┘ └───┬────┘ └───────────┘
                    │          │
             ┌──────▼──────────▼────┐
             │     OrderRouter      │
             └──────────┬───────────┘
                        │
             ┌──────────▼───────────┐
             │   BrokerAdapter      │
             │  (Mock / Exchange)   │
             └──────────┬───────────┘
                        │
             ┌──────────▼───────────┐
             │  BrokerSession       │
             │  (connect/reconnect) │
             └──────────┬───────────┘
                        │
             ┌──────────▼───────────┐
             │    Exchange          │
             └──────────┬───────────┘
                        │
             ┌──────────▼──────────────┐
             │OrderStateReconciler     │
             │  ┌──────────────────┐   │
             │  │ExecutionRecovery │   │
             │  │Runtime           │   │
             │  └──────────────────┘   │
             └──────────┬──────────────┘
                        │
             ┌──────────▼──────────────┐
             │   OrderHistoryStore     │
             └──────────┬──────────────┘
                        │
             ┌──────────▼──────────────┐
             │   MetricsRuntime        │
             └──────────┬──────────────┘
                        │
             ┌──────────▼──────────────┐
             │   ReportEngine          │
             └─────────────────────────┘
```

---

*End of document. This specification is version-controlled and evolves with integration test results.*
