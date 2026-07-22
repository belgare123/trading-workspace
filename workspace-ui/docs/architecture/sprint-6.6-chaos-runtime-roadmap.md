# Sprint 6.6 — Chaos Runtime / Failure Injection Framework

> **Дата:** 2026-07-22
> **Статус:** Planned
> **Основание:** Event Sourcing Core v1.0 — Frozen (Sprint 6.5 ✅)
> **Цель:** Переход от «код работает» к «код выдерживает отказ сети, биржи, диска и процесса и корректно восстанавливается»
> **Дизайн-принцип:** Управляемые отказы с автоматической проверкой инвариантов, а не хаос ради хаоса

---

## Архитектура

```
┌────────────────────────────────────────────────────┐
│                   CHAOS RUNTIME                      │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  Chaos Scheduler  │───▶│    Failure Injector    │ │
│  │  (timeline engine)│    │  ┌──────────────────┐  │ │
│  └──────────────────┘    │  │   Gateway Layer   │  │ │
│          │               │  │  ┌──────────────┐ │  │ │
│          ▼               │  │  │  WebSocket   │ │  │ │
│  ┌──────────────────┐    │  │  │  REST        │ │  │ │
│  │   Fault Profile   │    │  │  │  Event Bus   │ │  │ │
│  │   (configurator)  │    │  │  └──────────────┘ │  │ │
│  └──────────────────┘    │  └──────────────────┘  │ │
│                          └────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            Assertion Engine                    │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │   │
│  │  │ Kill  │ │ Safe │ │C.Br. │ │ Recovery │   │   │
│  │  │Switch │ │ Mode │ │      │ │          │   │   │
│  │  └──────┘ └──────┘ └──────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  Wallet   │ │ Position │ │  Replay   │   │   │
│  │  │  Consist. │ │ Consist. │ │          │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            Chaos Report                       │   │
│  │  Scenario → Injected → Detected → Recovery → │   │
│  │  SLO → PASS/FAIL                             │   │
│  └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

## 6.6.1 Failure Injector

Уровень перехвата: **Gateway** — единственная точка входа всех внешних взаимодействий.

### Возможности

| Инъекция | Описание | Тип |
|----------|----------|-----|
| **latency** | Задержка от N ms до N s перед передачей ответа | Duration |
| **timeout** | Эмуляция таймаута — ответ не возвращается в течение N ms | Duration |
| **packet_loss** | Процент ответов, которые «теряются» (drop) | Rate |
| **disconnect** | Принудительный разрыв соединения после N запросов | Trigger |
| **reconnect** | Эмуляция reconnect: disconnect → reconnect через N ms | Sequence |
| **partial_response** | Обрезанный/битый ответ (первые N байт, последние N байт) | Mutation |
| **malformed_response** | Некорректный JSON, невалидный protobuf, лишние поля | Mutation |
| **connection_refused** | Соединение отклонено (эмуляция недоступности сервиса) | Trigger |
| **rate_limit** | HTTP 429 / WebSocket close code 1008 | Protocol |

### Design

```typescript
interface FailureInjection {
  type: 'latency' | 'timeout' | 'packet_loss' | 'disconnect' | 'reconnect'
      | 'partial_response' | 'malformed_response' | 'connection_refused' | 'rate_limit'
  params: Record<string, unknown>
  probability?: number        // 0.0 – 1.0 (apply to N% of requests)
  target?: 'all' | 'read' | 'write' | 'subscribe' | 'unsubscribe'
}

interface FailureInjector {
  inject(failure: FailureInjection): Promise<void>
  clear(): Promise<void>
  clearAll(): Promise<void>
  activeInjections(): FailureInjection[]
}
```

---

## 6.6.2 Fault Profiles

Предопределённые сценарии, переключаемые одной строкой:

| Profile | Описание |
|---------|----------|
| `normal` | Без инъекций — baseline |
| `exchange-slow` | latency: 2-5s на 30% запросов |
| `exchange-flaky` | latency + timeout + partial_response + reconnect |
| `network-loss` | packet_loss: 10-30%, disconnect каждые 60s |
| `disk-slow` | Задержка записи в Journal (симуляция I/O contention) |
| `memory-pressure` | Симуляция нехватки памяти (GC pressure, slow allocation) |
| `random-chaos` | Случайный набор инъекций из всего арсенала |

```typescript
type FaultProfile = Record<string, FailureInjection[]>
```

---

## 6.6.3 Chaos Scheduler

Timeline-based сценарий: последовательность инъекций с временными метками.

```typescript
interface ChaosScenario {
  name: string
  profile: string | FailureInjection[]
  schedule: ChaosStep[]
  assertions: Assertion[]
  repeat?: number
}

interface ChaosStep {
  at: number            // ms from start
  action: 'inject' | 'clear' | 'clear_all' | 'switch_profile'
  injection?: FailureInjection
  profile?: string
  waitFor?: {
    condition: 'circuit_breaker_open' | 'kill_switch_active' | 'recovery_complete'
    timeout: number     // max ms to wait
  }
}
```

Пример:

```
T=0:     baseline (no faults)
T=5min:  disconnect gateway
T=5min30s: reconnect
T=7min30s: add latency 5s
T=8min30s: kill websocket
T=10min: clear all + verify recovery
```

---

## 6.6.4 Assertion Engine

Автоматическая проверка инвариантов после/во время хаоса:

| Assertion | Проверяет |
|-----------|-----------|
| **Kill Switch active** | `KillSwitch.isActive() === true` при фатальных ошибках |
| **Safe Mode entry** | `SafeMode.isActive()` когда exceeded failure threshold |
| **Circuit Breaker state** | `CircuitBreaker.state === 'OPEN'` после N failures |
| **Circuit Breaker recovery** | `CircuitBreaker.state === 'HALF_OPEN' → 'CLOSED'` после timeout |
| **Recovery replay** | `ReplayEngine.report().ok === true` после восстановления |
| **Wallet consistency** | `wallet.balance === Σ events` (invariant) |
| **Position consistency** | `position.size === Σ fills - Σ closes` |
| **No duplicate orders** | Журнал ордеров не содержит дубликатов |
| **No lost trades** | Каждый Fill имеет соответствующий Order |
| **Sequence gap** | `journal.currentSequence === max(events)` — нет пропусков |
| **Snapshot valid** | `SnapshotValidator.validate()` после recovery |

```typescript
interface Assertion {
  id: string
  name: string
  check(): Promise<AssertionResult>
  category: 'resilience' | 'consistency' | 'recovery'
}

interface AssertionResult {
  passed: boolean
  actual: unknown
  expected: unknown
  details?: string
}
```

---

## 6.6.5 Chaos Report

```typescript
interface ChaosReport {
  scenario: string
  startTime: number
  endTime: number
  duration: number
  
  injectedFailures: {
    type: string
    at: number
    params: Record<string, unknown>
  }[]
  
  detectedEffects: {
    type: string              // 'circuit_breaker_opened' | 'kill_switch' | etc.
    at: number
    trigger: string
  }[]
  
  recoveryEvents: {
    type: string
    at: number
    duration: number          // recovery time in ms
  }[]
  
  assertions: {
    id: string
    passed: boolean
    actual: unknown
    expected: unknown
  }[]
  
  sloViolations: {
    slo: string               // 'max_recovery_time', 'max_downtime'
    threshold: number
    actual: number
    severity: 'warning' | 'critical'
  }[]
  
  verdict: 'PASS' | 'FAIL'
  summary: string             // human-readable one-liner
}
```

---

## Инварианты, проверяемые Chaos Runtime

1. **После любого сбоя → ReplayEngine восстанавливает консистентное состояние**
2. **После любого сбоя → Wallet.consistency() === true**
3. **После любого сбоя → Position.consistency() === true**
4. **Circuit Breaker открывается при превышении порога ошибок**
5. **Circuit Breaker автоматически восстанавливается (HALF_OPEN → CLOSED)**
6. **Kill Switch активируется при фатальных ошибках**
7. **Safe Mode предотвращает отправку ордеров при нестабильности**
8. **Нет дублирования ордеров после reconnect**
9. **Нет потерянных Fill'ов после disconnect**
10. **Sequence journal'а остаётся монотонным**

---

## Критерии готовности (DoD)

- [ ] Failure Injector реализован для WebSocket и REST gateway
- [ ] Fault Profiles: normal, exchange-slow, exchange-flaky, network-loss, random-chaos
- [ ] Chaos Scheduler с timeline-синтаксисом
- [ ] Assertion Engine: KillSwitch, SafeMode, CircuitBreaker, Recovery, Wallet, Position
- [ ] Chaos Report с verdict PASS/FAIL
- [ ] Automatable: `npm run chaos:run -- --scenario exchange-flaky`
- [ ] Все assertion'ы проходят на normal profile (baseline)
- [ ] Хотя бы 3 profile'а дают различное детектируемое поведение CB/KillSwitch
- [ ] Документация: как добавить новый failure type, assertion, profile
