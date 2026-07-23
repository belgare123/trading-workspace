# Production Readiness Review v2.0

> **Дата:** 2026-07-23
> **Платформа:** Trading Workspace (workspace-ui)
> **Версия документа:** 2.0
> **Основание:** Sprint 6.6.6 ✅ — Chaos Runtime v1.0 Frozen
> **Предыдущая ревизия:** Sprint 5.8 — Production Readiness Checklist v1.1
> **Статус:** 🏗 Черновик (план прохождения)

---

## Преамбула

PRR v2.0 — это **контракт выпуска Production Candidate RC1**. В отличие от предыдущей ревизии (Sprint 5.8), учтены все инфраструктурные спринты 6.1–6.6.6:

- Event Sourcing Core + Deterministic Replay (Sprint 6.5)
- Observability Runtime + Telemetry (Sprint 6.3–6.4)
- Chaos Runtime + Certification (Sprint 6.6)
- Campaign Engine + SLO Certification (Sprint 6.6.6)

**Принципы прохождения:**
1. Каждый пункт завершается только при наличии **evidence** (log, test output, document)
2. Ни один пункт не закрывается «на веру» — только PASS/FAIL с доказательством
3. Все FAIL блокируют RC1 до разрешения

---

## Phase A — Platform Freeze

Убедиться, что платформа готова к безопасной эксплуатации.

### A1. Configuration Freeze

**Артефакт:** `docs/release/configuration-freeze-v2.0.md`

#### Чек-лист

| # | Проверка | Метод проверки | Evidence | Статус |
|---|----------|---------------|----------|--------|
| A1.1 | Production Configuration Manifest — единый файл конфигурации | Поиск config-файла в проекте | `docs/release/configuration-freeze-v2.0.md` | ✅ PASS |
| A1.2 | Immutable production config — ни один параметр не переопределяется runtime | Аудит кода на runtime-изменения config-объектов | EnvSecretStore.read-only, SecretsProvider.read-only для env | ✅ PASS |
| A1.3 | Safe defaults — feature flags откатываются к безопасным значениям при ошибке | Аудит DefaultFeatureFlags и fallback-логики | Все 35 параметров имеют safe defaults, 10 feature flags default true | ✅ PASS |
| A1.4 | Feature Flag Matrix — все флаги документированы с production-значениями | Таблица флагов, значений по умолчанию, production-значений | 10 UI flags + 4 Chaos runtime flags | ✅ PASS |
| A1.5 | Secrets — API keys передаются через ENV, не через файлы/код | Аудит seed-файлов, .env-файлов, кода | `git grep BYBIT_API` — только в .env (gitignored) и scripts (process.env) | ✅ PASS |
| A1.6 | Secrets rotation — смена ключей без перезапуска платформы | Runbook §7 — проверка | Restart required. Hot-reload отложен до RC2 | ⚠ PASS (ограничение) |
| A1.7 | Recovery Configuration — timeout, retry, backoff, maxAttempts задокументированы | Аудит констант recovery | StartupRecoveryRuntime: 30s timeout, 5 retries, exp backoff | ✅ PASS |

---

### A2. Dependency & Compatibility Audit

**Артефакт:** `docs/release/dependency-audit-v2.0.md`

#### Таблица проверки

| # | Компонент | Версия | Checked | Совместимость | Риск | Статус |
|---|-----------|--------|---------|---------------|------|--------|
| A2.1 | Node.js | `package.json.engines` | v24.18.0 | LTS (окт 2025–апр 2027) | Low | ✅ PASS |
| A2.2 | TypeScript | `package.json devDeps` | ~6.0.2 | Совместим с Node 24 | Low | ✅ PASS |
| A2.3 | Bybit REST API | v5 | Проверено 15 сценариями ChaosREST | Стабилен с 2024 | Low | ✅ PASS |
| A2.4 | Bybit Public WebSocket | v5 | ContinuousCertification (6 инвариантов) | Стабилен | Low | ✅ PASS |
| A2.5 | Bybit Private WebSocket | v5 | Private WS certification (6 semantic categories) | Стабилен | Low | ✅ PASS |
| A2.6 | better-sqlite3 | `package.json` ^13.0.1 | Совместим с Node 24 | Low | ✅ PASS |
| A2.7 | better-sqlite3 для EventJournal | Проверка работоспособности при 250k+ events | WAL-mode, sync=NORMAL, checkpoint 1000 | Low | ✅ PASS |
| A2.8 | OpenTelemetry JS SDK | `package.json` (косвенная) | TelemetryRuntime + MetricsRegistry | Косвенная, через Vite | Low | ✅ PASS |
| A2.9 | OpenTelemetry Prometheus Exporter | Совместимость с Python Prometheus client | Python Prometheus client (Sprint 6.4) | Low | ✅ PASS |
| A2.10 | vitest | `package.json devDeps` ^4.1.10 | Совместим с TS 6, Vite 8 | Low | ✅ PASS |
| A2.11 | ws (WebSocket library) | `package.json` — версия | Bybit WebSocket integration | Low | ✅ PASS |

---

### A3. Security Review

**Артефакт:** `docs/release/security-review-v2.0.md`

#### Чек-лист

| # | Проверка | Метод | Evidence | Статус |
|---|----------|-------|----------|--------|
| A3.1 | API keys только через process.env | `git grep BYBIT_API` — не должно быть в коде, seed-файлах, .env versioned | Только process.env. `.env*` в .gitignore | ✅ PASS |
| A3.2 | API keys не попадают в логи | Аудит StructuredLogger, ChaosTrace, console.log — фильтрация ключей | `grep apiKey` + `grep log` — 0 результатов | ✅ PASS |
| A3.3 | TestNet/MainNet строго изолированы | Разные ENV-переменные, разные credentials | `BYBIT_*` vs `BYBIT_TESTNET_*` — полное разделение | ✅ PASS |
| A3.4 | SQLite file permissions | Файлы .db не должны быть world-readable | 755/644, OS-level контроль | ⚠ WARNING |
| A3.5 | npm audit — zero critical | `npm audit` exit code | 0 critical, 0 high | ✅ PASS |
| A3.6 | No secrets in git history | `git log -p` — проверка seed-коммитов | Никогда не было коммитов с ключами | ✅ PASS |
| A3.7 | Singleton guard — prevent double execution | Lock-файл, PID check | `singleton-guard.ts` — lock + PID + stale cleanup | ✅ PASS |
| A3.8 | Graceful shutdown — cleanup resources | SIGINT/SIGTERM handlers | Все скрипты: SIGINT + SIGTERM + guard.release() | ✅ PASS |

---

## Phase B — Operational Validation

Проверить эксплуатацию на практике. Каждая проверка — это не чтение документа, а **выполнение сценария**.

### B1. Operational Runbook Verification

**Метод:** Пошагово пройти каждый раздел runbook `docs/ops/operational-runbook-v1.0.md`

| # | Раздел runbook | Действие | Expected | Evidence | Статус |
|---|----------------|----------|----------|----------|--------|
| B1.1 | §1. Запуск платформы | Запустить paper campaign | exit 0, процесс жив | | ⬜ |
| B1.2 | §2. Остановка | Ctrl+C / SIGTERM | exit 0, cleanup | | ⬜ |
| B1.3 | §3. Kill Switch | Проверить auto-trigger | Orders cancelled, positions closed | | ⬜ |
| B1.4 | §4. Обновление ПО | git pull + npm ci | Сборка проходит | | ⬜ |
| B1.5 | §5. Откат | git revert | Возврат к предыдущей версии | | ⬜ |
| B1.6 | §6. Восстановление после сбоя | Убить процесс → перезапустить | Recovery корректный | | ⬜ |
| B1.7 | §7. Смена API ключей | Изменить ENV → перезапуск | Новые ключи работают | | ⬜ |
| B1.8 | §8. Логи | Чтение structured logs в stdout | Формат корректный | | ⬜ |
| B1.9 | §9. Healthcheck | `npx tsx scripts/healthcheck.ts` | exit 0 ✅ healthy | | ⬜ |
| B1.10 | §10. Safe Mode | Симулировать Wallet sync failure | New trades blocked, exit orders active | | ⬜ |
| B1.11 | §11. Метрики | `curl localhost:9119/metrics` | Prometheus-совместимый вывод | | ⬜ |
| B1.12 | Потеря интернета | Отключить сеть → восстановить | Reconnect + recovery | | ⬜ |
| B1.13 | Переполнение диска | Симулировать ENOSPC | Graceful error, не паника | | ⬜ |
| B1.14 | Ротация логов | Проверить log rotation | Старые логи не теряются | | ⬜ |

---

### B2. Capacity Validation

**Артефакт:** `docs/release/capacity-report-v2.0.md`

#### Краткосрочные (run once)

| # | Тест | Условия | Измеряется | Порог | Evidence | Статус |
|---|------|---------|-----------|-------|----------|--------|
| B2.1 | Replay 100k events | EventJournal replay | Время выполнения | <2s (SLO) | | ⬜ |
| B2.2 | Replay 250k events | EventJournal stress | Время выполнения | <5s (SLO×2) | | ⬜ |
| B2.3 | SQLite WAL growth | 10k concurrent inserts | WAL file size | <50MB | | ⬜ |
| B2.4 | Gateway — 10 concurrent connections | WebSocket storm | Connection time, memory | <1s per conn | | ⬜ |
| B2.5 | Telemetry — metric cardinality | 100 unique metric labels | Export latency, memory | <100ms, <10MB | | ⬜ |

#### Длительные (staged)

| # | Тест | Длительность | Критерий | Evidence | Статус |
|---|------|-------------|----------|----------|--------|
| B2.6 | 24h paper campaign | 24 часа | 0 crashes, stable memory | | ⬜ |
| B2.7 | 48h paper campaign | 48 часов | 0 crashes, stable memory | | ⬜ |
| B2.8 | 7d stress test | 7 дней (кандидат на RC, не блокер) | 0 crashes, 0 lost positions | | ⬜ |

---

### B3. Production Acceptance Test (PAT)

**Артефакт:** `scripts/production-acceptance-test.ts`

Единственный скрипт, который проходит **полный цикл платформы**:

```
Boot
  ↓
Connect (Bybit WebSocket)
  ↓
Receive Market Data
  ↓
Generate Signal (SmaCross BUY/LONG)
  ↓
Risk Check (max drawdown, position sizing)
  ↓
Place Order (LIMIT/ENTER)
  ↓
Receive ACK
  ↓
Receive Fill
  ↓
Update Position
  ↓
Update Wallet
  ↓
Place Exit Order (TP/SL)
  ↓
Shutdown (graceful)
  ↓
Restart (new process)
  ↓
Recovery (replay → restore positions)
  ↓
Resume monitoring
  ↓
Final Shutdown
```

**Критерии прохождения:**
- Все шаги exit 0
- State после restart ≡ state до shutdown
- Wallet delta = P&L
- Replay hash verifies
- Ни одной ручной операции

| # | Шаг | Expected | Evidence | Статус |
|---|-----|----------|----------|--------|
| B3.1 | Boot | Workspace starts, no errors | | ⬜ |
| B3.2 | Connect | Gateway healthy, WS connected | | ⬜ |
| B3.3 | Market | Last price updates | | ⬜ |
| B3.4 | Signal | SmaCross generates LONG | | ⬜ |
| B3.5 | Risk | Position size correct, within limits | | ⬜ |
| B3.6 | Order | Order placed, ACK received | | ⬜ |
| B3.7 | Fill | Order filled, Trade created | | ⬜ |
| B3.8 | Position | PositionManager reflects correctly | | ⬜ |
| B3.9 | Wallet | Wallet balance adjusted for margin | | ⬜ |
| B3.10 | Exit | TP/SL orders placed | | ⬜ |
| B3.11 | Snapshot | State snapshot verifiable | | ⬜ |
| B3.12 | Restart | Graceful shutdown → new process start | | ⬜ |
| B3.13 | Recovery | Positions restored via replay | | ⬜ |
| B3.14 | Resume | Gateway healthy, order book synced | | ⬜ |
| B3.15 | Shutdown | Clean exit 0 | | ⬜ |

---

## Phase C — Release Decision

Формальное решение о выпуске Production Candidate.

### C1. Production Scorecard

| Раздел | Макс балл | Получено | Требование RC1 |
|--------|-----------|----------|----------------|
| Configuration | 100 | — | ≥80 |
| Security | 100 | — | ≥95 |
| Capacity | 100 | — | ≥80 |
| PAT (Acceptance) | 100 | — | 100 |
| Observability | 100 | — | ≥80 |
| Chaos | 100 | — | ≥80 |

**Блокеры RC1:**
- PAT < 100
- Security < 95 (любая уязвимость — блокер)
- Любой FAIL в Phase A без плана исправления

---

### C2. RC1 Gate Criteria

```
✅ Phase A — Platform Freeze: PASS
✅ Phase B — Operational Validation: PASS
✅ Phase C — Scorecard: ≥80 all sections

→ PRODUCTION CANDIDATE RC1
```

**Дата объявления RC1:** ___ (заполняется после закрытия всех пунктов)

---

### C3. Stage 1 Deployment Plan

| Параметр | Значение |
|----------|----------|
| Symbol | XRPUSDT |
| Strategy | SmaCross (2-period SMA crossover) |
| Risk per trade | 0.5% |
| Max concurrent positions | 1 |
| Duration | 48h непрерывно |
| Rollback | Automatic — Kill Switch + Safe Mode |
| Monitoring | Telemetry + Healthcheck + Logs |
| Exit criteria | 0 lost trades, 0 duplicate orders, 0 wallet divergence, stable memory |

**Риски и митигация:**

| Риск | Митигация |
|------|-----------|
| Single symbol exposure | Макс 1 позиция, 0.5% |
| Bybit API changes | Chaos Runtime проверяет timeout/disconnect/reconnect |
| Network issues | Reconnect + Replay гарантируют консистентность |
| Crash during trade | Recovery гарантирует позиции после restart |
| Kill Switch false positive | Manual review before deactivation |

---

## Матрица ответственных

| Роль | Phase A | Phase B | Phase C |
|------|---------|---------|---------|
| Platform Engineer | A1, A2, A3 | B2 | C1, C2 |
| DevOps/Ops | — | B1 | C3 |
| QA/Audit | A3 (security) | B3 | C1 (scorecard) |

Для v2.0 все роли исполняются одним инженером.

---

## История изменений

| Версия | Дата | Изменение |
|--------|------|-----------|
| 2.0 | 2026-07-23 | Первая версия PRR v2.0 (после Sprint 6.6.6) |

---

## Связанные документы

- `docs/ops/operational-runbook-v1.0.md` — проверяется в B1
- `docs/release/production-readiness-checklist-v1.0.md` — предыдущая ревизия (Sprint 5.8)
- `docs/release/configuration-freeze-v2.0.md` — артефакт A1
- `docs/release/dependency-audit-v2.0.md` — артефакт A2
- `docs/release/security-review-v2.0.md` — артефакт A3
- `docs/release/capacity-report-v2.0.md` — артефакт B2
- `docs/architecture/platform-invariants-v1.0.md` — реестр инвариантов
- `scripts/production-acceptance-test.ts` — артефакт B3
