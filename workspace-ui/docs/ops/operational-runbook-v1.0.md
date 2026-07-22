# Operational Runbook v1.0 — Trading Workspace Platform

> **Платформа**: Trading Workspace (workspace-ui)
> **Версия документа**: 1.0
> **ОС**: Windows (git-bash) / Docker
> **Репозиторий**: `G:/bot/trading-workspace/workspace-ui/`
> **Последнее обновление**: 2026-07

---

## Содержание

1. [Запуск платформы](#1-запуск-платформы)
2. [Остановка (graceful shutdown)](#2-остановка-graceful-shutdown)
3. [Экстренная остановка (kill switch)](#3-экстренная-остановка-kill-switch)
4. [Обновление ПО](#4-обновление-по)
5. [Откат (rollback)](#5-откат-rollback)
6. [Восстановление после сбоя](#6-восстановление-после-сбоя)
7. [Смена API-ключей](#7-смена-api-ключей)
8. [Чтение логов](#8-чтение-логов)
9. [Проверка здоровья (healthcheck)](#9-проверка-здоровья-healthcheck)
10. [Safe Mode](#10-safe-mode)
11. [Мониторинг метрик](#11-мониторинг-метрик)
12. [Типовые проблемы и их решение](#12-типовые-проблемы-и-их-решение)

---

## 1. Запуск платформы

### 1.1. Бумажная кампания (Paper Campaign)

Без API-ключей, реальные рыночные данные через Bybit WebSocket, виртуальное исполнение.

```bash
cd G:/bot/trading-workspace/workspace-ui

# Простой запуск
npx tsx scripts/paper-campaign.ts

# С кастомными символами и режимом burn-in
SYMBOLS=BTCUSDT,ETHUSDT MODE=burn-in npx tsx scripts/paper-campaign.ts

# Через npm-скрипт
npm run paper-campaign
```

**Переменные окружения**:
| Переменная | По умолчанию | Описание |
|---|---|---|
| `SYMBOLS` | `BTCUSDT,ETHUSDT,SOLUSDT` | Торгуемые символы |
| `MODE` | `full` | `full` — полная кампания, `burn-in` — только прожиг |
| `PAPER_BALANCE` | `10000` | Стартовый баланс в USDT (только для certify.ts) |

**Exit-коды кампании**: `0` — успешно, `1` — ошибка инициализации.

### 1.2. Демо SMA-20 (реальная биржа)

Требуются API-ключи Bybit MainNet.

```bash
export BYBIT_API_KEY=your_api_key
export BYBIT_API_SECRET=your_api_secret
npx tsx scripts/sma20-campaign.ts
```

**Переменные окружения**:
| Переменная | По умолчанию | Описание |
|---|---|---|
| `BYBIT_API_KEY` | — | **Обязательно**. API key MainNet |
| `BYBIT_API_SECRET` | — | **Обязательно**. API secret MainNet |
| `SYMBOLS` | `BTCUSDT,ETHUSDT` | Торгуемые символы |

### 1.3. MainNet кампания (7-дневная)

```bash
export BYBIT_API_KEY=...
export BYBIT_API_SECRET=...
export BYBIT_MODE=mini      # mini | burn-in | full
export BYBIT_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT
export BYBIT_STATE_DIR=.bybit-mainnet-state

npx tsx scripts/bybit-mainnet-campaign.ts
```

**Exit-коды**: `0` — успешное завершение, `1` — ошибка.

### 1.4. TestNet кампания

```bash
export BYBIT_TESTNET_API_KEY=...
export BYBIT_TESTNET_API_SECRET=...
export BYBIT_TESTNET_MODE=full
export BYBIT_TESTNET_SYMBOLS=BTCUSDT,ETHUSDT
export BYBIT_TESTNET_STATE_DIR=.bybit-testnet-state

npx tsx scripts/bybit-testnet-campaign.ts
```

### 1.5. Docker (фронтенд + бэкенд)

```bash
cd G:/bot/trading-workspace/

# Запуск всех сервисов
docker compose up -d

# Проверка состояния
docker compose ps

# Просмотр логов
docker compose logs -f
```

**Порты**: бэкенд `9121`, фронтенд `5173`.

### 1.6. Сертификационный suite

```bash
# Без API-ключей
npx tsx scripts/certify.ts
./scripts/certify.sh        # bash-обёртка
```

**Exit-коды**: `0` — все 75 сценариев пройдены, `1–127` — количество упавших сценариев.

---

## 2. Остановка (Graceful Shutdown)

### 2.1. Через сигналы

Все скрипты обрабатывают `SIGINT` (Ctrl+C) и `SIGTERM`:

| Кампания | Обрабатываемые сигналы |
|---|---|
| `paper-campaign.ts` | `SIGINT`, `SIGTERM` |
| `sma20-campaign.ts` | `SIGINT`, `SIGTERM` |
| `bybit-mainnet-campaign.ts` | `SIGINT`, `SIGTERM`, `SIGHUP` |
| `bybit-testnet-campaign.ts` | `SIGINT`, `SIGTERM`, `SIGHUP` |
| `bybit-demo.ts` | `SIGINT`, `SIGTERM` |

**Что происходит при graceful shutdown**:
1. Вызывается `ws.shutdown()` или `c.requestStop()`
2. Закрываются позиции (если применимо)
3. Останавливается мониторинг Kill Switch
4. Отключается WebSocket-соединение
5. Удаляется lock-файл SingletonGuard
6. Процесс завершается с кодом `0`

```bash
# Ручная отправка сигнала
kill -SIGTERM <PID>
# Или через tasklist/wmic на Windows (если процесс в фоне)
```

### 2.2. Docker

```bash
docker compose down          # Остановить все сервисы
docker compose stop backend  # Остановить конкретный сервис
```

---

## 3. Экстренная остановка (Kill Switch)

### 3.1. Автоматический Kill Switch

`ProductionKillSwitch` (`src/workspace/live/killswitch/ProductionKillSwitch.ts`)
мониторит пороговые значения каждые **30 секунд**:

| Порог | Значение по умолчанию | Описание |
|---|---|---|
| `maxDrawdownPercent` | 20% | Максимальная просадка от пика |
| `maxDailyLossPercent` | 10% | Максимальный дневной убыток |
| `maxPositionCount` | 5 | Максимум открытых позиций |

**При срабатывании**:
1. Отменяются все открытые ордера (`cancelAllOrders`)
2. Закрываются все позиции (reduce-only market order)
3. Блокируются новые ордера через `RiskRuntime.killSwitch.active = true`
4. Вызывается callback `onTrigger` с причиной и деталями

### 3.2. Ручной Kill Switch

Если нужно экстренно остановить всё вручную:

```bash
# 1. Найти PID процесса
ps aux | grep paper-campaign    # Linux
wmic process where "commandline like '%%paper-campaign%%'" get processid /format:csv  # Windows

# 2. Отправить SIGTERM (graceful)
kill -15 <PID>

# 3. Если не реагирует — SIGKILL
kill -9 <PID>                   # Linux
taskkill /F /PID <PID>          # Windows
```

### 3.3. Сброс Kill Switch

После активации Kill Switch для разблокировки торговли:

```typescript
// Через код:
killSwitch.deactivate()
// → устанавливает riskRuntime.killSwitch.active = false
// → перезапускает мониторинг
```

На данный момент **нет CLI-команды** для деактивации — требуется перезапуск процесса.

---

## 4. Обновление ПО

### 4.1. Если платформа работает под Docker

```bash
cd G:/bot/trading-workspace/

# 1. Остановить сервисы
docker compose down

# 2. Обновить код через git
git pull origin main

# 3. Пересобрать образы
docker compose build --no-cache

# 4. Запустить
docker compose up -d
```

### 4.2. Если платформа запущена напрямую (bare-metal)

```bash
cd G:/bot/trading-workspace/workspace-ui

# 1. Остановить кампанию (Ctrl+C или SIGTERM)

# 2. Обновить код
git pull origin main

# 3. Установить новые зависимости
npm ci

# 4. Проверить сборку
npm run build

# 5. Запустить заново
npx tsx scripts/<campaign>.ts
```

**Проверка версии**: `git describe --tags` или `node -e "console.log(require('./package.json').version)"`.

---

## 5. Откат (Rollback)

### 5.1. Docker

```bash
cd G:/bot/trading-workspace/

# Откат на предыдущую версию образа
docker compose stop
docker compose up -d --force-recreate   # пересоздаст контейнеры из текущих образов

# Если нужна конкретная версия — откатить тег в docker-compose.yml вручную
```

### 5.2. Bare-metal

```bash
cd G:/bot/trading-workspace/workspace-ui

# Откат git
git log --oneline -10         # посмотреть историю
git revert HEAD               # откатить последний коммит
# или
git reset --hard <previous-tag-or-commit>

# Переустановить зависимости
npm ci

# Запустить кампанию
npx tsx scripts/<campaign>.ts
```

### 5.3. Откат состояния кампании

Состояние хранится в директории, указанной в `BYBIT_STATE_DIR` (по умолчанию `.bybit-mainnet-state/` или `.bybit-testnet-state/`).

```bash
# Резервная копия перед обновлением
cp -r .bybit-mainnet-state/ .bybit-mainnet-state.bak/

# При проблемах — восстановить
rm -rf .bybit-mainnet-state/
cp -r .bybit-mainnet-state.bak/ .bybit-mainnet-state/
```

---

## 6. Восстановление после сбоя

### 6.1. Механизм восстановления

`WorkspaceBuilder.build()` создаёт `StartupRecoveryRuntime`, который при старте:

1. Запрашивает открытые позиции через `gateway.getPositions()`
2. Воссоздаёт synthetic trade для каждой открытой позиции
3. Синхронизирует историю через `HistoryRuntime`

```bash
# После сбоя достаточно перезапустить кампанию — StartupRecoveryRuntime
# сам найдёт и восстановит открытые позиции.
npx tsx scripts/bybit-mainnet-campaign.ts
```

### 6.2. Зависший lock-файл

SingletonGuard создаёт lock-файл в `/tmp/<name>.lock` (на Windows — `%TEMP%/<name>.lock`).
Если процесс упал некорректно, lock может остаться.

```bash
# Найти lock-файл
ls -la /tmp/bybit-mainnet-campaign.lock
# Windows: dir %TEMP%\bybit-mainnet-campaign.lock

# Принудительно удалить (только если процесс точно мёртв!)
rm /tmp/bybit-mainnet-campaign.lock          # Linux/Msys
rm "$TEMP"/bybit-mainnet-campaign.lock       # Windows git-bash
```

**Проверка живости процесса**:
- SingletonGuard проверяет PID из lock-файла через `process.kill(pid, 0)`
- Если процесс мёртв — lock удаляется автоматически
- Если lock остался — удалить вручную

### 6.3. Healthcheck после восстановления

```bash
npx tsx scripts/healthcheck.ts
# exit 0  — здоров
# exit 1  — degraded (есть исключения, но процесс жив)
# exit 2  — critical (процесс не найден)
```

---

## 7. Смена API-ключей

### 7.1. Через переменные окружения

```bash
# Экспортировать новые ключи перед запуском
export BYBIT_API_KEY=new_api_key
export BYBIT_API_SECRET=new_api_secret
npx tsx scripts/bybit-mainnet-campaign.ts
```

### 7.2. Через .env-файлы

```bash
# Отредактировать файл .env.mainnet или .env.testnet
# MainNet ключи:
#   BYBIT_API_KEY=...
#   BYBIT_API_SECRET=...
# TestNet ключи:
#   BYBIT_TESTNET_API_KEY=...
#   BYBIT_TESTNET_API_SECRET=...

# Загрузить перед запуском
set -a; source workspace-ui/.env.mainnet; set +a
npx tsx scripts/bybit-mainnet-campaign.ts
```

### 7.3. Важные правила

- **Ключи MainNet** (`BYBIT_API_KEY`, `BYBIT_API_SECRET`) — реальная биржа
- **Ключи TestNet** (`BYBIT_TESTNET_API_KEY`, `BYBIT_TESTNET_API_SECRET`) — тестовая сеть
- Для `paper-campaign.ts` и `certify.ts` ключи **не требуются**
- После смены ключей **обязательно перезапустить** процесс
- Поддерживаются только USDT-линейные контракты (linear)

**Проверка ключей**:

```bash
# TestNet
BYBIT_TESTNET_API_KEY=... BYBIT_TESTNET_API_SECRET=... node scripts/bybit-testnet-test.cjs
```

---

## 8. Чтение логов

### 8.1. stdout (консоль)

Все кампании пишут структурированные логи в stdout:

```
[2026-07-20T10:30:00.000Z] [INFO] Starting LiveFeedRuntime with BybitFeedAdapter...
[2026-07-20T10:30:05.000Z] [INFO] Connected. Gateway healthy: true
[2026-07-20T10:30:35.000Z] [📊] LONG 0.1 @ 61234.50 PnL=+1.25%
[2026-07-20T10:31:00.000Z] [🟢 TP] Closing at +3.02%
```

**Формат**: `[timestamp] [level/category] сообщение`

### 8.2. Docker-логи

```bash
docker compose logs -f          # все сервисы, follow
docker compose logs backend     # только бэкенд
docker compose logs frontend    # только фронтенд
docker compose logs --tail=100  # последние 100 строк
```

### 8.3. State-файлы (структурированное состояние)

Каждая кампания сохраняет `state.json`:

```bash
# MainNet (по умолчанию)
cat .bybit-mainnet-state/paper-campaign/state.json

# TestNet (по умолчанию)
cat .bybit-testnet-state/paper-campaign/state.json
```

Healthcheck также сохраняет `health.json`:

```bash
cat "$TMPDIR"/paper-campaign/health.json
```

### 8.4. Ежедневные отчёты

```bash
CAMPAIGN_STATE_DIR=.bybit-mainnet-state npx tsx scripts/bybit-campaign-report.ts
```

Формат отчёта: день, дата, статус, uptime, количество сделок, PnL, исключения, статус Kill Switch.

---

## 9. Проверка здоровья (Healthcheck)

### 9.1. Скрипт healthcheck.ts

```bash
cd G:/bot/trading-workspace/workspace-ui

npx tsx scripts/healthcheck.ts
```

**Exit-коды**:

| Код | Статус | Описание |
|---|---|---|
| `0` | ✅ healthy | Процесс жив, state.json читается, исключений нет |
| `1` | ⚠️ degraded | Процесс жив, но есть исключения (>0) или нет state.json |
| `2` | ❌ critical | Процесс не найден (no running paper-campaign) |

**Что проверяет**:
1. Поиск процесса paper-campaign в списке процессов (через `wmic` на Windows / `ps aux` на Linux)
2. Чтение `state.json` из `$TMPDIR/paper-campaign/`
3. Количество исключений
4. Статус сертификации (`lastCertResult`)
5. Текущий этап кампании (`stage`)

### 9.2. Docker healthcheck

```bash
# Бэкенд
curl -s http://localhost:9121/api/v1/system/health
# Ожидаемый ответ: HTTP 200
```

Docker Compose настроен с `healthcheck` для backend-сервиса:
- Интервал: 30s
- Таймаут: 10s
- Retries: 3
- Start period: 20s

### 9.3. Workspace.health()

Через код:

```typescript
const health = ws.health()
// {
//   status: 'running' | 'stopped' | 'error',
//   uptimeMs: number,
//   gatewayConnected: boolean,
//   runtimes: { feed, gateway, risk, recovery, strategy, trade, history, killswitch }
// }
```

---

## 10. Safe Mode

### 10.1. Paper Mode (Safe Mode по сути)

В платформе нет отдельного `Safe Mode`, но **Paper Mode** выполняет его функцию:

- **Витуальное исполнение** — ордера не попадают на реальную биржу
- **Реальные рыночные данные** — через BybitFeedAdapter (публичный WebSocket)
- **Полный пайплайн рисков** — RiskRuntime с 10+ правилами активен
- **PaperExecutionGateway** — эмулирует гейтвей

**Запуск Safe Mode (Paper)**:

```bash
# Полная бумажная кампания
npx tsx scripts/paper-campaign.ts

# Только burn-in (консервативный режим)
MODE=burn-in npx tsx scripts/paper-campaign.ts

# Certification Suite (75 сценариев)
npx tsx scripts/certify.ts
```

### 10.2. Burn-In Mode

Промежуточный режим между Paper и полной кампанией:

- `CampaignMode.BurnIn` — только прожиг стратегии без открытия реальных позиций
- `CampaignMode.MiniCampaign` — мини-кампания (доступна в mainnet/testnet)
- `CampaignMode.FullCampaign` — полная 7-дневная кампания

```bash
# MainNet в режиме burn-in
BYBIT_MODE=burn-in npx tsx scripts/bybit-mainnet-campaign.ts

# TestNet в режиме full
BYBIT_TESTNET_MODE=full npx tsx scripts/bybit-testnet-campaign.ts
```

---

## 11. Мониторинг метрик

### 11.1. MetricsRuntime

`MetricsRuntime` (`src/workspace/metrics/runtime/MetricsRuntime.ts`) собирает:

**Коллекторы**:
- `TradeCollector` — все трейды (входы/выходы)
- `PositionCollector` — открытые/закрытые позиции
- `EquityCollector` — кривая equity (snapshots + balancePoints)
- `EventCollector` — события жизненного цикла

**Зарегистрированные метрики** (10 шт.):

| Метрика | Категория | Описание |
|---|---|---|
| WinRateMetric | trade | Процент выигрышных сделок |
| ProfitFactorMetric | trade | Отношение прибыли к убыткам |
| ExpectancyMetric | trade | Мат. ожидание сделки |
| SharpeMetric | risk | Коэффициент Шарпа |
| SortinoMetric | risk | Коэффициент Сортино |
| MaxDrawdownMetric | risk | Максимальная просадка |
| RecoveryFactorMetric | performance | Фактор восстановления |
| CalmarMetric | performance | Отношение доходности к просадке |
| SQNMetric | performance | Системное качество (System Quality Number) |
| KellyMetric | performance | Критерий Келли |

### 11.2. Отчёты

```typescript
// Через код:
const metrics = new MetricsRuntime()
metrics.connect(eventBus)

// Доступные отчёты:
const perf    = metrics.performanceReport()   // торговые метрики
const risk    = metrics.riskReport()          // риски + drawdown curve
const summary = metrics.summaryReport()       // сводка
const snap    = metrics.snapshot()            // полный снепшот
```

### 11.3. Healthcheck (быстрая диагностика)

Команда `npx tsx scripts/healthcheck.ts` выводит:

```
✅ Paper Campaign Health: healthy
  Process: ✅ alive (1 pid(s))
  State:   ✅ running 2d 4h 12m
  Exceptions: 0
  Cert: Passed
```

### 11.4. Campaign Reporter (ежедневные метрики)

```bash
CAMPAIGN_STATE_DIR=.bybit-mainnet-state npx tsx scripts/bybit-campaign-report.ts
```

Выводит: PnL, количество сделок, Win Rate, дневную разбивку, статус Kill Switch.

---

## 12. Типовые проблемы и их решение

### 12.1. «❌ BYBIT_API_KEY & BYBIT_API_SECRET required»

**Причина**: Не установлены переменные окружения.
**Решение**:
```bash
export BYBIT_API_KEY=your_key
export BYBIT_API_SECRET=your_secret
```

### 12.2. «❌ Already running» (SingletonGuard, exit code 0)

**Причина**: Предыдущий процесс не завершился или lock-файл не удалён.
**Решение**:
```bash
# Проверить, жив ли процесс
ps aux | grep paper-campaign   # или wmic на Windows

# Если мёртв — удалить lock-файл
rm /tmp/bybit-mainnet-campaign.lock   # Windows: rm "$TEMP"/bybit-mainnet-campaign.lock
```

### 12.3. Healthcheck: «❌ Paper Campaign process NOT FOUND»

**Причина**: Процесс paper-campaign не запущен или упал.
**Решение**:
```bash
# Запустить кампанию
npx tsx scripts/paper-campaign.ts

# Проверить логи
npx tsx scripts/healthcheck.ts
```

### 12.4. WebSocket disconnected / feed timeout

**Причина**: Проблемы с сетевым соединением к Bybit WebSocket.
**Симптомы**: Логи `[feed] Reconnecting...`, зависание стратегии.
**Решение**:
```bash
# 1. Проверить интернет
ping api.bybit.com

# 2. Перезапустить кампанию (FeedRuntime переподключается автоматически,
#    но при длительном отключении требуется перезапуск)
# Ctrl+C, затем снова:
npx tsx scripts/bybit-mainnet-campaign.ts
```

### 12.5. Kill Switch сработал автоматически

**Причина**: Достигнут один из порогов (drawdown 20%, daily loss 10%, >5 позиций).
**Решение**:
```bash
# 1. Проверить причину в логах:
#    «🔴 KILL SWITCH | drawdown 21.3% >= 20% ...»

# 2. Оценить рыночную ситуацию

# 3. Для перезапуска торговли — перезапустить процесс
#    Kill Switch сбросится, мониторинг начнётся заново.
```

### 12.6. Docker: контейнер не стартует

```bash
# Проверить логи контейнера
docker compose logs backend

# Пересобрать образ
docker compose build backend
docker compose up -d

# Проверить healthcheck
docker compose ps
# Статус должен быть "healthy"
```

### 12.7. State-директория не найдена

**Причина**: Не указана или указана неверно `BYBIT_STATE_DIR`.
**Решение**:
```bash
# Проверить текущую директорию
ls -la .bybit-mainnet-state/

# Или указать явно:
export BYBIT_STATE_DIR=C:/trading/state
```

### 12.8. Ошибка «No gateway provided»

**Причина**: Не передан gateway в WorkspaceBuilder.
**Решение**: Проверить bootstrap-скрипт — должен содержать `.withGateway(...)` или `gateway:` в конфиге.

### 12.9. Ошибки при `npm ci` / `npm run build`

```bash
# Очистить кеш и переустановить
rm -rf node_modules package-lock.json
npm cache clean --force
npm ci
npm run build
```

### 12.10. Быстрая диагностика (checklist)

```bash
# 1. Жив ли процесс?
ps aux | grep tsx                    # Linux
wmic process where "commandline like '%%tsx%%'" get processid /format:csv   # Windows

# 2. Здоров ли процесс?
npx tsx scripts/healthcheck.ts
echo $?   # 0=healthy, 1=degraded, 2=critical

# 3. Есть ли локи?
ls -la /tmp/*.lock                   # Linux/Msys
ls -la "$TEMP"/*.lock                # Windows git-bash

# 4. Какие ключи экспортированы?
env | grep BYBIT_API

# 5. Работает ли Docker?
docker ps
docker compose ps
```

---

## Приложение A: Карта скриптов

| Скрипт | Назначение | Требует ключей |
|---|---|---|
| `scripts/paper-campaign.ts` | Бумажная кампания | Нет |
| `scripts/sma20-campaign.ts` | Демо SMA-20 (MainNet) | Да |
| `scripts/bybit-mainnet-campaign.ts` | 7-дневная MainNet | Да |
| `scripts/bybit-testnet-campaign.ts` | 7-дневная TestNet | Да (TestNet) |
| `scripts/demo/bybit-demo.ts` | Демо с TP/SL (MainNet) | Да |
| `scripts/certify.ts` | Сертификация (75 сценариев) | Нет |
| `scripts/certify.sh` | Обёртка для certify.ts | Нет |
| `scripts/healthcheck.ts` | Проверка здоровья | Нет |
| `scripts/bybit-campaign-report.ts` | Ежедневный отчёт | Нет |
| `scripts/bybit-testnet-test.cjs` | Проверка TestNet ключей | Да (TestNet) |
| `scripts/demo/singleton-guard.ts` | Lock-файл (подключается в скрипты) | — |

## Приложение B: Переменные окружения (полный список)

| Переменная | Где используется | Описание |
|---|---|---|
| `BYBIT_API_KEY` | mainnet / sma20 / demo | API ключ MainNet |
| `BYBIT_API_SECRET` | mainnet / sma20 / demo | API секрет MainNet |
| `BYBIT_TESTNET_API_KEY` | testnet | API ключ TestNet |
| `BYBIT_TESTNET_API_SECRET` | testnet | API секрет TestNet |
| `BYBIT_SYMBOLS` | mainnet | Символы для MainNet (через запятую) |
| `BYBIT_TESTNET_SYMBOLS` | testnet | Символы для TestNet (через запятую) |
| `SYMBOLS` | paper / certify / sma20 | Символы (через запятую) |
| `BYBIT_MODE` | mainnet | `mini`, `burn-in`, `full` |
| `BYBIT_TESTNET_MODE` | testnet | `burn-in`, `full` |
| `MODE` | paper | `burn-in`, `full` |
| `BYBIT_STATE_DIR` | mainnet | Директория состояния (по умолч. `.bybit-mainnet-state`) |
| `BYBIT_TESTNET_STATE_DIR` | testnet | Директория состояния (по умолч. `.bybit-testnet-state`) |
| `CAMPAIGN_STATE_DIR` | campaign-report | Директория для чтения отчёта |
| `PAPER_BALANCE` | certify | Стартовый баланс в USDT |
| `BYBIT_POSITION_SIZE` | demo | Размер позиции в USDT (по умолч. 5) |
| `BYBIT_SYMBOL` | demo | Одиночный символ (по умолч. XRPUSDT) |

## Приложение C: Команды одной строкой

```bash
# Paper Campaign
npx tsx scripts/paper-campaign.ts

# MainNet Campaign (mini)
BYBIT_API_KEY=k BYBIT_API_SECRET=s BYBIT_MODE=mini npx tsx scripts/bybit-mainnet-campaign.ts

# TestNet Campaign (full)
BYBIT_TESTNET_API_KEY=k BYBIT_TESTNET_API_SECRET=s npx tsx scripts/bybit-testnet-campaign.ts

# Healthcheck
npx tsx scripts/healthcheck.ts

# Certification
npx tsx scripts/certify.ts

# Daily report
CAMPAIGN_STATE_DIR=.bybit-mainnet-state npx tsx scripts/bybit-campaign-report.ts

# Docker
docker compose up -d
docker compose logs -f

# TestNet keys verification
BYBIT_TESTNET_API_KEY=k BYBIT_TESTNET_API_SECRET=s node scripts/bybit-testnet-test.cjs
```
