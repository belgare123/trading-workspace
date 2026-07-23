# Platform Invariants v1.0

> **Дата:** 2026-07-23
> **Платформа:** Trading Workspace (workspace-ui)
> **Статус:** Черновик (ведётся ревизия)
> **Принцип:** Один источник истины. Любой спринт ссылается на этот документ, а не определяет инварианты заново.

---

## Преамбула

Этот документ — **единый реестр платформенных инвариантов**. Инвариант — это свойство системы, которое **должно всегда выполняться** при любых условиях: normal operation, failure, recovery, replay, chaos.

Каждый инвариант имеет:
- Уникальный ID (`INV-xxx`)
- Уровень (critical / high / medium)
- Источник проверки (certification test, runtime guard, invariant assertion)
- Ссылку на конкретный тест или код

**Любое изменение инварианта** — это breaking change, требующий миграционного процесса.

---

## INV-001 — Fill Idempotency

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-001` |
| **Уровень** | Critical |
| **Формулировка** | Каждый Fill применяется ровно один раз. Повторное применение того же Fill не меняет состояние. |
| **Проверка** | Certification: FillAggregator dedup by fill_id, Exchange Consistency Certification (hash match) |
| **Нарушение ведёт к** | Duplicate trades, wallet divergence |
| **Тест** | `ChaosREST.integration.test.ts` (partial response, duplicate), Private WS invariants |
| **Код** | `FillAggregator.ts`, `OrderManager.ts` |

---

## INV-002 — Deterministic Replay

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-002` |
| **Уровень** | Critical |
| **Формулировка** | Replay всегда даёт идентичное финальное состояние при одинаковой последовательности событий. hash(state) = const. |
| **Проверка** | Event Sourcing Certification (242 deterministic tests, 100 random scenarios) |
| **Нарушение ведёт к** | Невоспроизводимые баги, divergence после восстановления |
| **Тест** | `Phase5.certification.test.ts` (Cert 1–6: 100k events, 250k stress, 100 random) |
| **Код** | `EventJournal.ts`, `ReplayEngine.ts` |

---

## INV-003 — Strictly Increasing Sequence

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-003` |
| **Уровень** | Critical |
| **Формулировка** | Sequence номер событий строго возрастает. Нет пропусков, нет перемотки назад. |
| **Проверка** | EventJournal guard on insert |
| **Нарушение ведёт к** | Replay divergence, hash mismatch |
| **Код** | `EventJournal.ts` — sequence check on each append |

---

## INV-004 — Non-Negative Wallet

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-004` |
| **Уровень** | Critical |
| **Формулировка** | Wallet balance никогда не уходит в отрицательное значение. Любой расход проверяется перед исполнением. |
| **Проверка** | WalletManager guard, Runtime Asset Check |
| **Нарушение ведёт к** | Невозможность покрыть обязательства |
| **Тест** | `Wallet.test.ts` |
| **Код** | `Wallet.ts`, `WalletManager.ts` |

---

## INV-005 — Position Persistence

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-005` |
| **Уровень** | Critical |
| **Формулировка** | Position после replay идентична позиции до replay. hash(position_before) = hash(position_after). |
| **Проверка** | Exchange Consistency Certification (Private WS → REST snapshot) |
| **Нарушение ведёт к** | Невосстановимые позиции, PnL divergence |
| **Тест** | `PrivateWS.integration.test.ts` (5 invariants), Block5 (Chaos + Replay) |
| **Код** | `StartupRecoveryRuntime.ts`, `RecoveryController.ts` |

---

## INV-006 — No Forbidden Gateway Transitions

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-006` |
| **Уровень** | High |
| **Формулировка** | GatewayRuntime не делает запрещённых state-транзиций (например, Degraded → Closed, Disconnected → Healthy без Reconnecting). |
| **Проверка** | Gateway State Machine certification, Transport Matrix (8x8 combinations) |
| **Нарушение ведёт к** | Некорректное состояние gateway, потеря ордеров |
| **Тест** | Block1 (Gateway State Machine), Block2 (Transport Matrix) |
| **Код** | `GatewayRuntime.ts`, `GatewayState.ts` |

---

## INV-007 — Circuit Breaker Mutual Exclusion

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-007` |
| **Уровень** | High |
| **Формулировка** | Circuit Breaker не может одновременно находиться в состояниях Closed и Degraded. Состояния — взаимоисключающие. |
| **Проверка** | FSM guard, certification |
| **Нарушение ведёт к** | Двойное исполнение (trade через degraded + closed каналы) |
| **Тест** | `CircuitBreaker.test.ts`, `GatewayCircuitBreaker.test.ts` |
| **Код** | `CircuitBreakerFSM.ts` |

---

## INV-008 — Snapshot Consistency

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-008` |
| **Уровень** | High |
| **Формулировка** | Snapshot никогда не содержит sequence номер меньше последнего применённого события. snapshot.seq ≥ lastApplied.seq. |
| **Проверка** | EventJournal snapshot guard |
| **Нарушение ведёт к** | Replay из некорректного состояния |
| **Код** | `EventJournal.ts` — snapshot seq invariant |

---

## INV-009 — Chaos Trace Completeness

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-009` |
| **Уровень** | High |
| **Формулировка** | Каждая инъекция отказа имеет соответствующее событие в ChaosTrace. Количество инъекций = количество trace-событий. |
| **Проверка** | ChaosTrace certification, Observability Block 6 |
| **Нарушение ведёт к** | Потеря visibility при отказе, невозможность аудита |
| **Тест** | `ChaosTrace.test.ts`, Block6 (Observability certification) |
| **Код** | `ChaosTraceRuntime.ts` |

---

## INV-010 — SLO Timing Guarantees

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-010` |
| **Уровень** | High |
| **Формулировка** | Ключевые операции укладываются в SLO: Gateway recovery <5s, Replay <2s (per 10k events), Wallet sync <1s, Chaos detection <500ms, CB open <250ms. |
| **Проверка** | SLO Certification (Block 4, 6.6.6) |
| **Нарушение ведёт к** | Деградация качества эксплуатации, но не к потере данных |
| **Тест** | Block4 (SLOCertification), Campaign Engine `.assert(checkGatewayRecoverySLO(5000))` |
| **Примечание** | SLO могут быть превышены при экстремальной нагрузке — это signal, не alarm |

---

## INV-011 — Gateway Health Consistency

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-011` |
| **Уровень** | Medium |
| **Формулировка** | Все health-проверки Gateway консистентны: `Workspace.health()` включает uptime, gateway status, runtime states, safe mode. |
| **Проверка** | Observability certification (Block 6.6.5) |
| **Нарушение ведёт к** | Ложноположительные/ложноотрицательные алерты |
| **Тест** | Block6 (Observability certification) |
| **Код** | `HealthAggregator.ts`, `WorkspaceBuilder.health()` |

---

## INV-012 — Safe Mode Isolation

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-012` |
| **Уровень** | High |
| **Формулировка** | В Safe Mode новые сделки блокируются, но существующие exit-ордера продолжают исполняться. |
| **Проверка** | Kill Switch certification (Scenario7) |
| **Нарушение ведёт к** | Невозможность выйти из позиции в экстренной ситуации |
| **Тест** | `Scenario7.kill-switch-certification.test.ts` |
| **Код** | `LifecycleManager.ts`, `SafeMode FSM` |

---

## INV-013 — Singleton Execution

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-013` |
| **Уровень** | High |
| **Формулировка** | Только один экземпляр кампании может быть запущен одновременно. Lock-файл + PID check. |
| **Проверка** | Singleton guard certification |
| **Нарушение ведёт к** | Дублирование ордеров, race condition |
| **Код** | `SingletonGuard.ts`, demo scripts |

---

## INV-014 — Telemetry Monotonic Counters

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-014` |
| **Уровень** | Medium |
| **Формулировка** | SLI-счётчики монотонно возрастают. Ни один счётчик не может уменьшиться без сброса. |
| **Проверка** | Telemetry certification, Metric consistency check |
| **Нарушение ведёт к** | Некорректная статистика, ложные алерты |
| **Код** | `MetricsRegistry.ts`, `RuntimeTelemetry.ts` |

---

## INV-015 — Kafka/Event Bus Ordering

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-015` |
| **Уровень** | High |
| **Формулировка** | События в Event Bus обрабатываются в порядке sequence номера. Event Bus гарантирует FIFO в рамках одного partition/strategy. |
| **Проверка** | Event Bus certification |
| **Нарушение ведёт к** | Out-of-order обработка, некорректное состояние |
| **Код** | `EventBus.ts` |

---

## INV-016 — Restart Recovery Completeness

| Свойство | Значение |
|----------|----------|
| **ID** | `INV-016` |
| **Уровень** | Critical |
| **Формулировка** | После restart (kill → boot) все открытые на момент сбоя позиции, ордера и exit-стратегии восстанавливаются. Нет потерянных позиций. |
| **Проверка** | Recovery certification (Scenario6, Block5 6.6.5) |
| **Нарушение ведёт к** | Потеря позиций и капитала |
| **Тест** | `Scenario6.recovery-open-trade.test.ts` (6 тестов), Block5.chaos-replay.test.ts |
| **Код** | `StartupRecoveryRuntime.ts`, `RecoveryController.ts` |

---

## Сводная таблица

| ID | Инвариант | Уровень | Source | Тест |
|----|-----------|---------|--------|------|
| INV-001 | Fill idempotency | Critical | Certification | FillAggregator, Consistency |
| INV-002 | Deterministic replay | Critical | Certification | Phase5 (242 tests) |
| INV-003 | Increasing sequence | Critical | Runtime guard | EventJournal |
| INV-004 | Non-negative wallet | Critical | Runtime guard | Wallet.test.ts |
| INV-005 | Position persistence | Critical | Certification | PrivateWS, Block5 |
| INV-006 | Forbidden gateway transitions | High | Certification | Block1, Block2 |
| INV-007 | CB mutual exclusion | High | FSM guard | CircuitBreaker.test.ts |
| INV-008 | Snapshot consistency | High | Runtime guard | EventJournal |
| INV-009 | Chaos trace completeness | High | Certification | ChaosTrace, Block6 |
| INV-010 | SLO timing guarantees | High | Certification | Block4 (SLO) |
| INV-011 | Health consistency | Medium | Certification | Block6 (Observability) |
| INV-012 | Safe mode isolation | High | Certification | Scenario7 |
| INV-013 | Singleton execution | High | Runtime guard | SingletonGuard |
| INV-014 | Monotonic counters | Medium | Certification | Telemetry |
| INV-015 | Event bus ordering | High | Certification | EventBus |
| INV-016 | Restart recovery completeness | Critical | Certification | Scenario6, Block5 |

---

## История изменений

| Версия | Дата | Изменение |
|--------|------|-----------|
| 1.0 | 2026-07-23 | Первая версия. Свод инвариантов из Sprint 6.1–6.6.6 |

---

## Связанные документы

- `docs/release/production-readiness-review-v2.0.md` — контекст PRR
- `src/event-journal/__tests__/Phase5.certification.test.ts` — тесты INV-002, INV-003
- `src/runtime/chaos/campaign/ContinuousCertification.ts` — runtime-проверки INV-009, INV-010
- `src/workspace/live/__integration__/Scenario6.recovery-open-trade.test.ts` — INV-016
- `src/workspace/live/__integration__/Scenario7.kill-switch-certification.test.ts` — INV-012
