# Event Sourcing — Core v1.0 Freeze

> **Дата:** 2026-07-22
> **Версия:** v1.0
> **Область применения:** `src/event-journal/`
> **Commit:** *(будет обновлён после подписания)*
> **Тег:** `event-sourcing-v1.0`
> **Проект:** Trading Platform
> **Статус:** **Заморожен (Frozen)**
> **Сертификация:** 242/242 тестов, 16 файлов, Deterministic Fuzz 100/100, Randomized 100/100

---

## 1. Version

| Поле | Значение |
|------|----------|
| Major версия | 1 |
| Minor версия | 0 |
| Статус | Frozen |
| Предыдущая версия | — |
| Дата заморозки | 2026-07-22 |
| Спринты | 5.4 – 6.5 |

---

## 2. Scope

Event Sourcing Core — инфраструктурный слой платформы, обеспечивающий надёжное журналирование событий, snapshot-механизм, детерминированный replay и восстановление после сбоев. Не является UI-подсистемой; используется как backend-фундамент для Trading Domain, Runtime и Observability.

### 2.1. Включено

- **EventEnvelope** — структура события, сериализация/десериализация
- **Journal (SQLite + WAL)** — персистентный журнал с буферизацией, flush, atomic checkpoint
- **EventStream** — потоковое чтение с фильтрацией по sequence, типу, runtime, traceId, tradeId
- **SnapshotManager** — создание, хранение, восстановление, валидация, прунинг snapshot'ов
- **SnapshotPolicy** — стратегия создания snapshot'ов (eventThreshold, timer, emergency, shutdown)
- **SnapshotSerializer** — сериализация + checksum (SHA-256/CRC32) + опциональное gzip-сжатие
- **SnapshotValidator** — структурная и checksum-валидация, cross-aggregate проверки
- **SnapshotRecovery** — пайплайн восстановления: load → validate → replay → report
- **SnapshotHealth** — мониторинг здоровья snapshot-системы
- **ReplayEngine** — детерминированный replay с поддержкой:
  - `replay()` — полный/частичный replay
  - `replayAggregate()` — replay отдельного aggregate из snapshot
  - `replayFrom()/replayTo()` — range replay
  - `dryRun()` — replay без мутации состояния
  - `validate()` — пост-replay валидация
- **ReplayCursor** — курсор для point-to-point replay и resume
- **ReplayValidator** — пост-replay проверка (apply errors, sequence regression, state hash)
- **ReplayMetrics** — метрики replay (events/s, timing, errors)
- **RecoveryReport** — structured recovery result
- **ReplayReport** — structured replay result
- **Telemetry** — интеграция с Runtime Telemetry (SLI, Prometheus/OTel)
- **Certification Suite** — 16 тестовых файлов, 242 теста

### 2.2. Не входит в Scope

- Incremental snapshots (Phase 8+)
- Copy-on-write snapshot isolation (Phase 8+)
- Remote/S3 snapshot storage (Phase 8+)
- Event versioning / schema registry (Phase 8+)
- Multi-writer journal (Phase 8+)
- Distributed journal / replication (Phase 8+)

---

## 3. Frozen Components

### 3.1. Frozen (ядро — изменения только через новую major-версию)

| Модуль | Путь | Причина |
|--------|------|---------|
| EventEnvelope | `src/event-journal/EventEnvelope.ts` | Базовая структура данных, затрагивает все потребители |
| EventApplier | `src/event-journal/EventApplier.ts` | Контракт приложения событий |
| IEventJournal | `src/event-journal/IEventJournal.ts` | Интерфейс журнала — фундамент всех операций |
| ReplayEngine | `src/event-journal/ReplayEngine.ts` | Единственная точка входа для replay (архитектурное правило) |
| ReplayCursor | `src/event-journal/ReplayCursor.ts` | Инвариант: только forward, never backwards |
| EventStream | `src/event-journal/EventStream.ts` | Проверка диапазона до yield (guard) |
| SnapshotManager | `src/event-journal/SnapshotManager.ts` | Оркестратор snapshot-системы |
| SnapshotSerializer | `src/event-journal/SnapshotSerializer.ts` | Формат сериализации + checksum |

### 3.2. Extensible (новые реализации через registry/extension)

| Модуль | Путь | Механизм расширения |
|--------|------|---------------------|
| SnapshotPolicy | `src/event-journal/SnapshotPolicy.ts` | Конфигурация: новые trigger'ы через параметры |
| SnapshotValidator | `src/event-journal/SnapshotValidator.ts` | Новые проверки через версионирование |
| ReplayValidator | `src/event-journal/ReplayValidator.ts` | Новые проверки через validate() |
| ReplayMetrics | `src/event-journal/ReplayMetrics.ts` | Новые метрики через интерфейс |

### 3.3. Excluded (вспомогательные — изменения без ограничений)

| Модуль | Путь |
|--------|------|
| SQLiteEventJournal | `src/event-journal/SQLiteEventJournal.ts` |
| SnapshotRecovery | `src/event-journal/SnapshotRecovery.ts` |
| SnapshotHealth | `src/event-journal/SnapshotHealth.ts` |
| RecoveryReport | `src/event-journal/RecoveryReport.ts` |
| ReplayReport | `src/event-journal/ReplayReport.ts` |
| Certification Suite | `src/event-journal/__tests__/*` |

---

## 4. Public API (Frozen)

Следующие экспорты гарантированно стабильны. Любое изменение, нарушающее обратную совместимость, требует major-версии:

### 4.1. EventEnvelope

```typescript
interface EventEnvelope {
  event_id: string
  aggregate_id: string
  sequence: number
  timestamp: number
  type: string
  payload: Record<string, unknown>
  metadata: {
    version: number
    schemaVersion: number
    eventType: string
    correlationId: string
    causationId: string
  }
  traceId?: string
  tradeId?: string
  runtime?: string
}
```

### 4.2. IEventJournal

```typescript
interface IEventJournal {
  append(event: Omit<EventEnvelope, 'sequence'>): Promise<EventEnvelope>
  read(filter?: JournalFilter): AsyncIterable<EventEnvelope>
  flush(): Promise<void>
  close(): void
  currentSequence: number
  // snapshots
  saveSnapshot(record: SnapshotRecord): void
  loadSnapshot(aggregateId: string): SnapshotRecord | null
  listAggregateIds(): string[]
  pruneSnapshots(aggregateId: string, keepLast: number): void
  // checkpoint
  checkpoint(events: EventEnvelope[], snapshot: SnapshotRecord): void
  // health / recovery
  getHealth(): JournalHealth
  getRecoveryStatus(): RecoveryStatus
}
```

### 4.3. ReplayEngine

```typescript
class ReplayEngine {
  replay(request?: Partial<ReplayRequest>): Promise<ReplayReport>
  replayAggregate(aggregateId: string, request?: Partial<ReplayRequest>): Promise<ReplayReport>
  replayFrom(afterSequence: number, aggregateIds?: string[]): Promise<ReplayReport>
  replayTo(beforeSequence: number, aggregateIds?: string[]): Promise<ReplayReport>
  dryRun(request?: Partial<ReplayRequest>): Promise<Pick<ReplayReport, 'ok' | 'eventsProcessed'>>
  validate(report: ReplayReport): ReplayValidationResult
}
```

### 4.4. ReplayRequest

```typescript
interface ReplayRequest {
  fromSequence: number
  toSequence: number
  aggregateIds: string[]
  initialStates: AggregateInitialState[]
  useCursor: boolean
}
interface AggregateInitialState {
  aggregateId: string
  state: unknown
  sequence: number
}
```

### 4.5. SnapshotRecord (структура хранения)

```typescript
interface SnapshotRecord {
  snapshot_id: string
  aggregate_id: string
  sequence: number
  last_applied_sequence: number
  snapshot_version: number
  checksum: string
  payload: string  // JSON → checksum → maybe gzip
  created_at: number
}
```

---

## 5. Platform Change Rule

> **Любое изменение Event Sourcing API, нарушающее обратную совместимость, допускается только в рамках следующей major-версии (v2.0).**

### 5.1. Разрешено (без изменения версии)

- Bug fixes в реализации frozen-модулей (не меняющие сигнатуры)
- Performance improvements (оптимизация SQLite-запросов, buffering, batch sizes)
- Observability additions (новые метрики, логи, трейсинг)
- Новые validation checks в `ReplayValidator` / `SnapshotValidator`
- Новые trigger'ы в `SnapshotPolicy`
- Добавление новых интерфейсов/типов (при условии, что существующие не меняются)
- Расширение `ReplayReport` / `RecoveryReport` новыми полями (только опциональными)

### 5.2. Запрещено (требует v2.0)

- Изменение полей `EventEnvelope` (добавление/удаление/переименование)
- Изменение семантики sequence (гарантия монотонности, strict monotonic)
- Изменение порядка replay (sequence ordering, batch ordering)
- Изменение формата snapshot (структура `SnapshotRecord`, checksum-алгоритм)
- Изменение интерфейса `IEventJournal` (сигнатуры методов)
- Изменение сигнатуры `ReplayEngine.replay()` / `replayAggregate()`
- Изменение семантики `fromSequence` (exclusive) / `toSequence` (inclusive)
- Изменение поведения `ReplayCursor` (only forward, invariant)
- Удаление или переименование существующих экспортов из barrel (`index.ts`)

---

## 6. Extension Points

Аддитивные изменения (не требующие нарушения frozen API):

| Extension Point | Механизм | Пример |
|-----------------|----------|--------|
| Новый trigger snapshot'а | `SnapshotPolicy` config | `{ onOrderRejected: true }` |
| Новая validator-проверка | `SnapshotValidator` / `ReplayValidator` | Проверка consistency runtimeId |
| Новая метрика | `ReplayMetrics` / `SnapshotMetricsCollector` | `observeSnapshotSize()` |
| Новый фильтр чтения | `JournalFilter` | Фильтр по correlationId |
| Новая стратегия сжатия | `SnapshotSerializer` | Поддержка brotli/zstd |
| Новая имплементация Journal | `IEventJournal` | In-memory journal для тестов |

---

## 7. Verification Results

| Метрика | Значение |
|---------|----------|
| Файлов в модуле | 18 source + 16 test |
| Тестовых файлов | 16 |
| Всего тестов | 242 |
| Статус | ✅ 242/242 passed |
| TS errors | 0 |
| Build | ✅ Vite build success |
| Deterministic Fuzz | ✅ 100/100 runs |
| Crash Recovery | ✅ 3/3 scenarios |
| Snapshot Compatibility | ✅ 3/3 scenarios |
| Journal Integrity | ✅ 3/3 scenarios |
| Long Replay Stress | ✅ 100K (4114 evt/s) + 250K×5 (6999 evt/s) |
| Randomized Certification | ✅ 100/100 scenarios |
| Performance (100K replay) | 24.3s append + 24.2s replay |
| Performance (250K×5 replay) | 35.7s replay |

---

## 8. Compatibility

### 8.1. Inbound (что импортирует Event Sourcing)

- `better-sqlite3` (журнал)
- `uuid` (ID генерация)
- `crypto` (SHA-256 checksums)
- Runtime-типы (HealthAggregator, MetricsCollector)

### 8.2. Outbound (кто импортирует Event Sourcing)

- **Trading Domain** — `OrderManager`, `WalletEngine`, `ExitEngine` (через `EventApplier`)
- **Runtime Layer** — `TelemetryRuntime`, `HealthAggregator`
- **Lifecycle** — `PlatformLifecycle` (graceful shutdown, recovery)
- **Circuit Breaker** — события состояний CB
- **Observability** — `TraceContext`, `CorrelationContext`

---

## 9. Architecture Invariants (закреплённые в коде)

1. **ReplayEngine — единственная точка входа для replay.** Никакой прямой вызов `journal.read()` + ручной apply вне ReplayEngine.
2. **Глобальный sequence не двигается внутри обработки aggregate.** `ReplayCursor.jumpTo(maxSequence)` только после batch.
3. **EventStream.toSequence — проверка ДО yield.** Событие за границей диапазона не может просочиться.
4. **Snapshot — only additive.** Изменение формата snapshot только через schema migration.
5. **Sequence — строго монотонный.** Никаких сбросов, перемоток, дубликатов.
6. **ReplayCursor — только forward.** `jumpTo(seq)` кидает ошибку при seq < current.

---

## 10. Future Evolution

Ближайшие направления (не требуют изменения frozen API):

- **Sprint 6.6 — Chaos Runtime:** Failure Injector на уровне gateway (latency, timeout, disconnect). Не требует изменения Event Sourcing core.
- **Time Travel Debugger:** Визуализация replay, step-through по событиям. Использует существующий `ReplayEngine`.
- **Offline Simulation:** Replay исторических данных через `dryRun()`. Не требует изменений.
- **Live Shadow Mode:** Параллельное исполнение новой стратегии через `replayAggregate()`.

Для следующей major-версии (v2.0):

- Incremental snapshots (diff-based)
- Copy-on-write snapshot isolation
- Remote/S3 snapshot storage
- Multi-writer / partitioned journal

---

## 11. Changelog

| Версия | Дата | Изменения |
|--------|------|-----------|
| v1.0 | 2026-07-22 | Initial freeze. Sprint 5.4–6.5. 242 tests, certification suite. |
