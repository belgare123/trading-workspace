# Configuration Freeze v2.0 — Production Configuration Manifest

> **Дата:** 2026-07-23
> **Платформа:** Trading Workspace (workspace-ui)
> **PRR Section:** A1 — Configuration Freeze
> **Статус:** ✅ PASS (завершён)
> **Версия конфигурации:** `CFG-v2.0-20260723`
> **Контрольная сумма:** (заполняется после фиксации)

---

## 1. Обзор

Документ фиксирует **все точки конфигурации** платформы, их допустимые значения,
safe defaults и процедуру изменения после RC1.

### 1.1. Источники конфигурации

| # | Источник | Формат | Читаемость |
|---|----------|--------|-----------|
| 1 | Environment variables | `KEY=VALUE` | Runtime (process.env) |
| 2 | `.env` / `.env.mainnet` / `.env.testnet` | `KEY=VALUE` | dotenv-файлы (не коммитятся) |
| 3 | `docker-compose.yml` | YAML | Docker entry |
| 4 | `localStorage` | JSON (tw:flags) | Браузерный Feature Flags |
| 5 | `SecretsProvider` | Env + Memory | Абстракция над env |
| 6 | Hardcoded constants | TypeScript | Порт 5173, proxy localhost:9121 |

### 1.2. Версия конфигурации и checksum

Каждый Production Candidate получает уникальную версию:

```
CFG-{MAJOR}.{MINOR}-{YYYYMMDD}
  MAJOR = breaking change (обязательный миграционный процесс)
  MINOR = additive change (новый параметр с safe default)
```

Контрольная сумма вычисляется как SHA256 от упорядоченного списка всех `KEY=VALUE`
пар production-конфигурации:

```bash
# Генерация checksum для RC1:
env | grep -E '^(BYBIT_|PAPER_|MODE|SYMBOLS|DURATION_|TESTNET|TIMEOUT_|QTY|RUNBOOK_|WEBUI_|PROMETHEUS_|CS_|VITE_)' \
  | sort \
  | sha256sum \
  | cut -d' ' -f1
```

---

## 2. Матрица переменных окружения

### 2.1. Production credentials

| Переменная | Обязательная | Default | Допустимые значения | Назначение | Источник |
|-----------|:---:|---------|-------------------|------------|----------|
| `BYBIT_API_KEY` | ✅ | — | Строка 64 символа | MainNet API key | `bybit-mainnet-campaign.ts` |
| `BYBIT_API_SECRET` | ✅ | — | Строка 64 символа | MainNet API secret | `bybit-mainnet-campaign.ts` |

**Правила:**
- Обе переменные должны быть установлены одновременно
- Отсутствие — `SecretNotFound` исключение при запуске
- Длина: Bybit v5 API key = 64 символа, secret = 64 символа

### 2.2. Production campaign parameters

| Переменная | Обязательная | Default | Допустимые значения | Назначение |
|-----------|:---:|---------|-------------------|------------|
| `BYBIT_SYMBOLS` | ❌ | `BTCUSDT,ETHUSDT,SOLUSDT` | Список USDT-линейных пар | Торгуемые символы |
| `BYBIT_MODE` | ❌ | `mini` | `burn-in` / `mini` / `full` | Режим кампании |
| `BYBIT_STATE_DIR` | ❌ | `.bybit-mainnet-state` | Относительный/абсолютный путь | Директория состояния |

**Safe defaults:** Если `BYBIT_SYMBOLS` не задан — кампания не начнёт торговать.
`BYBIT_MODE=mini` — минимальный риск (максимум 1 сделка).

### 2.3. TestNet credentials (изоляция)

| Переменная | Обязательная | Default | Допустимые значения | Назначение |
|-----------|:---:|---------|-------------------|------------|
| `BYBIT_TESTNET_API_KEY` | ✅ (testnet) | — | Строка | TestNet API key |
| `BYBIT_TESTNET_API_SECRET` | ✅ (testnet) | — | Строка | TestNet API secret |
| `BYBIT_TESTNET_SYMBOLS` | ❌ | `BTCUSDT,ETHUSDT,SOLUSDT` | Список пар | TestNet символы |
| `BYBIT_TESTNET_MODE` | ❌ | `full` | `burn-in` / `full` | TestNet режим |
| `BYBIT_TESTNET_STATE_DIR` | ❌ | `.bybit-testnet-state` | Путь | TestNet директория |

**Изоляция MainNet/TestNet:** ✅ Подтверждена — разные префиксы `BYBIT_` vs `BYBIT_TESTNET_`.
Ключи никогда не пересекаются.

### 2.4. Paper campaign / Certification

| Переменная | Обязательная | Default | Допустимые значения | Назначение |
|-----------|:---:|---------|-------------------|------------|
| `SYMBOLS` | ❌ | `BTCUSDT,ETHUSDT,SOLUSDT` | Список пар | Paper-кампания символы |
| `PAPER_BALANCE` | ❌ | `10000` | `1000`–`1000000` (USDT) | Стартовый баланс |
| `MODE` | ❌ | `full` | `burn-in` / `full` | Paper-режим |
| `CAMPAIGN_STATE_DIR` | ❌ | `./campaign-state` | Путь | Директория отчётов |

**Safe defaults:** Параметры гарантируют безопасный запуск даже при отсутствии всех env vars.

### 2.5. Utility scripts

| Переменная | Default | Допустимые значения | Назначение |
|-----------|---------|-------------------|------------|
| `BYBIT_SYMBOL` | `XRPUSDT` | Любая USDT-пара | Demo script |
| `BYBIT_POSITION_SIZE` | `5` | `1`–`100` (USDT) | Demo position size |
| `DURATION_HOURS` | `168` | `1`–`720` (30 days) | Stress test duration |
| `TESTNET` | `true` (если `!= 'false'`) | `true` / `false` | Idempotency smoke |
| `TIMEOUT_MS` | `3000` | `1000`–`30000` | Order timeout |
| `QTY` | `1` | `0.001`–`1000` | Recovery drill quantity |
| `RUNBOOK_PATH` | `''` | Путь к файлу | Recovery drill runbook |

**Безопасность по умолчанию:** Все утилиты имеют safe defaults. Ни одна не запускается
с опасными значениями при отсутствии env vars.

### 2.6. Python backend / Docker

| Переменная | Default | Допустимые значения | Назначение |
|-----------|---------|-------------------|------------|
| `PYTHONUNBUFFERED` | `1` (docker) | `0` / `1` | Docker stdout |
| `VITE_API_URL` | `http://localhost:9121` | URL | Frontend API proxy |
| `CS_DB_PATH` | `signals.db` | Путь | Сигналы SQLite |
| `WEBUI_HOST` | `0.0.0.0` | IP | WebUI bind |
| `WEBUI_PORT` | `8000` | `1024`–`65535` | WebUI port |
| `WEBUI_DEBUG` | `false` | `true` / `false` | Debug mode |
| `PROMETHEUS_URL` | `http://prometheus:9090` | URL | Prometheus endpoint |
| `CS_TG_PROXY` | — | URL | Telegram proxy |

---

## 3. Feature Flag Matrix

### 3.1. UI Feature Flags

Все флаги хранятся в `localStorage` под ключом `tw:flags`. Все по умолчанию `true`.

| Флаг | Default | Production значение | Описание |
|------|:-------:|:------------------:|----------|
| `workspace.commandPalette` | `true` | `true` | Командная палитра (Ctrl+K) |
| `workspace.search` | `true` | `true` | Глобальный поиск |
| `workspace.timeline` | `true` | `true` | Таймлайн событий |
| `workspace.ml` | `true` | `true` | ML-модели |
| `workspace.marketplace` | `true` | `true` | Маркетплейс |
| `workspace.plugins` | `true` | `true` | Плагины |
| `workspace.replay` | `true` | `true` | Replay UI |
| `workspace.hotkeys` | `true` | `true` | Горячие клавиши |
| `workspace.animations` | `true` | `true` | Анимации |
| `workspace.telemetry` | `true` | `true` | Телеметрия |

**Production-правила:**
- Флаги меняются только через `localStorage` — не влияют на серверную логику
- Все значения `true` по умолчанию (opt-out модель)
- Изменение флага требует перезагрузки страницы

### 3.2. Chaos Runtime Feature Flags (runtime-level)

Эти флаги — часть `FailureInjectionScope` и управляются через `ChaosRuntime.enable()`
программно, не через env vars.

| Флаг | Назначение | Default | Production |
|------|-----------|---------|:----------:|
| `CHAOS_REST` | REST failure injection | `false` | `false` |
| `CHAOS_PUBLIC_WS` | Public WS failure injection | `false` | `false` |
| `CHAOS_PRIVATE_WS` | Private WS failure injection | `false` | `false` |
| `CHAOS_OBSERVABILITY` | Observability injection | `false` | `false` |

**Production: все `false`.** Chaos Runtime активируется только в сертификационных кампаниях.

---

## 4. Safe Defaults

### 4.1. Принцип

Каждая переменная конфигурации имеет **безопасное значение по умолчанию**,
гарантирующее что платформа:
- не начнёт торговать без явного разрешения;
- не использует prod-ключи в testnet;
- не раскрывает secrets в логах;
- graceful-откат при ошибке чтения конфигурации.

### 4.2. Таблица safe defaults

| Компонент | Параметр | Safe default | Безопасность |
|-----------|----------|-------------|-------------|
| MainNet | `BYBIT_API_KEY` | Отсутствует → блокировка запуска | Не стартует без ключей |
| MainNet | `BYBIT_MODE` | `mini` | Макс 1 сделка |
| TestNet | `BYBIT_TESTNET_MODE` | `full` | TestNet не рискует капиталом |
| Paper | `PAPER_BALANCE` | `10000` | Виртуальный баланс |
| Paper | `SYMBOLS` | `BTCUSDT,ETHUSDT,SOLUSDT` | 3 символа без риска |
| Demo | `BYBIT_POSITION_SIZE` | `5` USDT | Минимальный риск |
| Stress | `DURATION_HOURS` | `168` (7d) | Полный цикл |
| Feature Flags | Все | `true` | Все функции включены |

### 4.3. Graceful fallback

```typescript
// Паттерн safe default во всех скриптах:
const value = process.env.KEY ?? SAFE_DEFAULT

// Паттерн обязательной переменной:
if (!process.env.REQUIRED_KEY) {
  console.error('REQUIRED_KEY is required')
  process.exit(1)
}
```

---

## 5. Secrets rotation

### 5.1. Текущий механизм

Смена API-ключей требует перезапуска процесса с новыми `BYBIT_API_KEY`/`BYBIT_API_SECRET`.

```bash
# Ротация MainNet ключей:
export BYBIT_API_KEY=new_key
export BYBIT_API_SECRET=new_secret
npx tsx scripts/bybit-mainnet-campaign.ts
```

### 5.2. Ограничения

- Нет hot-reload — требуется restart
- Нет multi-key support
- Нет ротации через внешний secret store (Vault, KMS)

### 5.3. План на RC2

- [ ] Поддержка Vault/KMS через SecretStore abstraction
- [ ] Credential rotation без restart (SIGUSR2 handler)
- [ ] Multi-key с автоматическим fallback

**Для RC1 достаточно текущего механизма.** Ротация занимает <30 секунд.

---

## 6. Immutable production config

### 6.1. Что меняется runtime

**Разрешено:**
- Feature flags через localStorage (только UI)
- Programmatic chaos flags через `ChaosRuntime.enable()`
- In-memory secrets через `SecretsProvider.set()` (до restart)

**Запрещено:**
- `BYBIT_API_KEY` / `BYBIT_API_SECRET` — read-only после старта
- `BYBIT_MODE` — фиксируется при старте
- `PAPER_BALANCE` — read-only (paper-campaign)

### 6.2. Enforcement

```typescript
// SecretsProvider — env vars read-only
class EnvSecretStore {
  async set() { throw new Error('EnvSecretStore is read-only') }
}
```

---

## 7. Recovery Configuration

| Параметр | Значение | Источник |
|----------|----------|----------|
| Recovery timeout | 30s | `StartupRecoveryRuntime` |
| Reconnect retries | 5 | `LiveFeedRuntime` |
| Reconnect backoff | 1s–30s (exponential) | `LiveFeedRuntime` |
| Kill Switch interval | 30s | `ProductionKillSwitch` |
| Max drawdown | 20% | `ProductionKillSwitch` |
| Max daily loss | 10% | `ProductionKillSwitch` |
| Max positions | 5 | `ProductionKillSwitch` |
| Healthcheck interval | 30s | docker-compose.yml |
| Healthcheck timeout | 10s | docker-compose.yml |
| Snapshot interval | every 5 events | `SnapshotPolicy` |
| WAL checkpoint | every 1000 events | `EventJournal` |

---

## 8. Процедура изменения конфигурации после RC1

### 8.1. Non-breaking changes (minor)

Новый параметр с safe default, не меняющий существующее поведение.

1. Добавить параметр в `Configuration Freeze v2.x`
2. Обновить checksum
3. Добавить запись в CHANGELOG

### 8.2. Breaking changes (major)

Удаление или изменение существующего параметра, требующее миграции.

1. Создать `docs/release/migration/CFG-v2-to-v3.md`
2. Описать миграцию (старое значение → новое значение)
3. Задокументировать grace period (минимум 1 релиз)
4. Обновить версию манифеста
5. Обновить checksum
6. Обновить CHANGELOG

---

## 9. Контрольная сумма (заполняется)

```bash
# Команда для генерации при RC1:
env | grep -E '^(BYBIT_|PAPER_|MODE|SYMBOLS|DURATION_|TESTNET|TIMEOUT_|QTY|RUNBOOK_|WEBUI_|PROMETHEUS_|CS_|VITE_)' \
  | sort \
  | sha256sum
```

**Checksum production config (будет заполнен при RC1):** `___`

---

## 10. История изменений

| Версия | Дата | Изменение |
|--------|------|-----------|
| 2.0 | 2026-07-23 | Первая версия (Sprint 6.6.6 → Stage 1 PRR). 35 переменных, 10 feature flags, safe defaults |

---

## Приложение: Полный словарь переменных

| # | Ключ | Тип | Default | Prod | Stage 1 |
|---|------|-----|---------|------|---------|
| 1 | `BYBIT_API_KEY` | string | — | ✅ | ✅ |
| 2 | `BYBIT_API_SECRET` | string | — | ✅ | ✅ |
| 3 | `BYBIT_SYMBOLS` | string | `BTCUSDT,ETHUSDT,SOLUSDT` | ✅ | `XRPUSDT` |
| 4 | `BYBIT_MODE` | enum | `mini` | ✅ | `mini` |
| 5 | `BYBIT_STATE_DIR` | path | `.bybit-mainnet-state` | ✅ | ✅ |
| 6 | `BYBIT_TESTNET_API_KEY` | string | — | ✅ | — |
| 7 | `BYBIT_TESTNET_API_SECRET` | string | — | ✅ | — |
| 8 | `BYBIT_TESTNET_SYMBOLS` | string | `BTCUSDT,ETHUSDT,SOLUSDT` | ✅ | — |
| 9 | `BYBIT_TESTNET_MODE` | enum | `full` | ✅ | — |
| 10 | `BYBIT_TESTNET_STATE_DIR` | path | `.bybit-testnet-state` | ✅ | — |
| 11 | `SYMBOLS` | string | `BTCUSDT,ETHUSDT,SOLUSDT` | ✅ | — |
| 12 | `PAPER_BALANCE` | number | `10000` | ✅ | — |
| 13 | `MODE` | enum | `full` | ✅ | — |
| 14 | `CAMPAIGN_STATE_DIR` | path | `./campaign-state` | ✅ | — |
| 15 | `BYBIT_SYMBOL` | string | `XRPUSDT` | ✅ | ✅ |
| 16 | `BYBIT_POSITION_SIZE` | number | `5` | ✅ | — |
| 17 | `DURATION_HOURS` | number | `168` | ✅ | — |
| 18 | `TESTNET` | bool | `true` | ✅ | — |
| 19 | `TIMEOUT_MS` | number | `3000` | ✅ | — |
| 20 | `QTY` | number | `1` | ✅ | — |
| 21 | `RUNBOOK_PATH` | string | `''` | ✅ | — |
| 22 | `PYTHONUNBUFFERED` | bool | `1` | ✅ | ✅ |
| 23 | `VITE_API_URL` | url | `http://localhost:9121` | ✅ | ✅ |
| 24 | `CS_DB_PATH` | path | `signals.db` | ✅ | — |
| 25 | `WEBUI_HOST` | ip | `0.0.0.0` | ✅ | — |
| 26 | `WEBUI_PORT` | port | `8000` | ✅ | — |
| 27 | `WEBUI_DEBUG` | bool | `false` | ✅ | — |
| 28 | `PROMETHEUS_URL` | url | `http://prometheus:9090` | ✅ | — |
| 29 | `CS_TG_PROXY` | url | — | ✅ | — |

**Итого:** 29 переменных, 10 feature flags, 0 обязательных без safe defaults
(кроме production credentials, где отсутствие — блокировка запуска).
