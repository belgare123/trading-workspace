# Stage 1 Launch Checklist

> **Дата:** 2026-07-23
> **Платформа:** Trading Workspace (workspace-ui)
> **Назначение:** Пошаговый операционный чек-лист для запуска Stage 1
> **Тип:** Исполнительный документ — каждый пункт должен быть верифицирован перед переходом к следующему

---

## Как пользоваться

1. Проходить строго по порядку
2. Каждый пункт выполнить и отметить □ → ☑
3. Если пункт FAIL — не переходить к следующему, пока не исправлен
4. После прохождения всех 7 секций → кампания готова к запуску
5. Запуск и мониторинг — по отдельному плану мониторинга

---

## 1. Infrastructure

**Цель:** Базовая инфраструктура готова к запуску торговой платформы.

| # | Действие | Команда верификации | Ожидаемый результат | Статус |
|---|----------|---------------------|---------------------|:------:|
| 1.1 | Проверить версию ОС и обновления | `uname -a && lsb_release -a` | Linux, актуальная версия | ⬜ |
| 1.2 | Проверить Node.js | `node --version` | v24.x.x | ⬜ |
| 1.3 | Проверить npm/npx | `npm --version && npx --version` | Установлены, без ошибок | ⬜ |
| 1.4 | Проверить NTP синхронизацию | `timedatectl status` | `System clock synchronized: yes` | ⬜ |
| 1.5 | Проверить свободное место на диске | `df -h /` | Available > 10GB | ⬜ |
| 1.6 | Проверить свободную память | `free -h` | Available > 1GB | ⬜ |
| 1.7 | Настроить log rotation | `cat /etc/logrotate.d/trading-workspace` | Конфигурация существует и корректна | ⬜ |
| 1.8 | Настроить автоматический перезапуск | `systemctl status trading-workspace` (или `pm2 status`) | Зарегистрирован, `enabled`, `active` | ⬜ |
| 1.9 | Проверить network connectivity к Bybit | `curl -s -o /dev/null -w "%{http_code}" https://api.bybit.com/v5/market/time` | `200` | ⬜ |
| 1.10 | Проверить WS connectivity | `timeout 5 bash -c 'echo > /dev/tcp/stream.bybit.com/443' && echo OK` | `OK` | ⬜ |

**Блокер:** Все пункты 1.x должны быть ☑ перед переходом к секции 2.

---

## 2. Configuration

**Цель:** Конфигурация развёрнута, проверена и заморожена.

| # | Действие | Команда верификации | Ожидаемый результат | Статус |
|---|----------|---------------------|---------------------|:------:|
| 2.1 | Развернуть `.env.production` | `ls -la /opt/trading-workspace/.env.production` | Файл существует, права `600` | ⬜ |
| 2.2 | Проверить BYBIT_API_KEY | `grep BYBIT_API_KEY .env.production | head -c 20` | Не пустой, не дефолтный | ⬜ |
| 2.3 | Проверить BYBIT_API_SECRET | `grep BYBIT_API_SECRET .env.production | head -c 10` | Не пустой, не дефолтный | ⬜ |
| 2.4 | Проверить SYMBOLS | `grep SYMBOLS .env.production` | `XRPUSDT` (только один!) | ⬜ |
| 2.5 | Проверить RISK_PER_TRADE | `grep RISK_PER_TRADE .env.production` | `0.25` | ⬜ |
| 2.6 | Проверить MAX_DAILY_LOSS | `grep MAX_DAILY_LOSS .env.production` | `200` (или согласованное значение) | ⬜ |
| 2.7 | Проверить MAX_POSITIONS | `grep MAX_POSITIONS .env.production` | `1` | ⬜ |
| 2.8 | Проверить MAX_DRAWDOWN | `grep MAX_DRAWDOWN .env.production` | `5` | ⬜ |
| 2.9 | Проверить Testnet/Mainnet | `grep BYBIT_TESTNET .env.production` | `false` (если Mainnet) ИЛИ `true` (если Testnet) | ⬜ |
| 2.10 | Проверить отсутствие лишних env | `cat .env.production \| wc -l` | Соответствует production шаблону | ⬜ |
| 2.11 | Зафиксировать SHA256 конфигурации | `env \| sort \| sha256sum` | Сохранить в `/var/log/trading-workspace/config-checksum.txt` | ⬜ |
| 2.12 | Убедиться, что `.env` не в git | `git check-ignore .env.production` | `.env.production` игнорируется | ⬜ |
| 2.13 | Проверить feature flags | `grep FEATURE_CHAOS .env.production && grep FEATURE_MAINNET .env.production` | `FEATURE_CHAOS=false`, `FEATURE_MAINNET=true` | ⬜ |

**Блокер:** Если BYBIT_API_KEY или BYBIT_API_SECRET — пустые, дефолтные или тестовые → STOP. Не запускать кампанию.

---

## 3. Security

**Цель:** API-ключи, секреты и доступы защищены.

| # | Действие | Команда верификации | Ожидаемый результат | Статус |
|---|----------|---------------------|---------------------|:------:|
| 3.1 | Проверить права API-ключа на Bybit | Вручную в Bybit Dashboard | Только чтение + торговля, без вывода | ⬜ |
| 3.2 | Проверить IP whitelist на API-ключе | Вручную в Bybit Dashboard | Только IP сервера | ⬜ |
| 3.3 | Проверить, что secrets не попадают в логи | `grep -r 'apiKey\|apiSecret\|BYBIT_API' /opt/trading-workspace/logs/ 2>/dev/null \| head -5` | Пусто | ⬜ |
| 3.4 | Проверить umask | `umask` | `0027` (или restrictive) | ⬜ |
| 3.5 | Проверить права на `.env.production` | `stat -c '%a' /opt/trading-workspace/.env.production` | `600` (только owner) | ⬜ |
| 3.6 | Проверить SQLite permissions | `stat -c '%a' /opt/trading-workspace/data/` | `700` или restrictive | ⬜ |
| 3.7 | Проверить, что lock-file работает | `ls -la /tmp/trading-workspace.lock 2>/dev/null` | Отсутствует (если кампания не запущена) | ⬜ |
| 3.8 | Проверить отсутствие ключей в git history | `cd /opt/trading-workspace && git log --all --oneline \| head -5` | Нет случайных коммитов с ключами | ⬜ |

**Блокер:** API-ключ с правами на вывод средств → STOP. Снять права вывода перед запуском.

---

## 4. Monitoring

**Цель:** Наблюдаемость настроена, алерты работают.

| # | Действие | Команда верификации | Ожидаемый результат | Статус |
|---|----------|---------------------|---------------------|:------:|
| 4.1 | Проверить Grafana доступна | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` | `200` или `302` | ⬜ |
| 4.2 | Проверить Prometheus endpoint | `curl -s http://localhost:9090/api/v1/query?query=up` | JSON с `status":"success"` | ⬜ |
| 4.3 | Проверить метрики приложения | `curl -s http://localhost:9119/metrics \| head -10` | OpenTelemetry метрики, не пусто | ⬜ |
| 4.4 | Проверить дашборд | Вручную: открыть Grafana → дашборд Stage 1 | Все панели отображают данные | ⬜ |
| 4.5 | Тест алерта: отключить WS | `kill -STOP $(pgrep -f "paper-campaign")` (на 5с, затем `-CONT`) | Алерт в Telegram: "Campaign connection lost" | ⬜ |
| 4.6 | Тест алерта: exception | Запустить тестовый алерт через healthcheck | Алерт в Telegram: "Exception detected" | ⬜ |
| 4.7 | Проверить HealthAggregator | `curl -s http://localhost:9119/health` | `{"overall":"healthy",...}` | ⬜ |
| 4.8 | Проверить Telegram бот (если настроен) | Отправить тестовое сообщение | Сообщение доставлено | ⬜ |
| 4.9 | Проверить log rotation в действии | `logrotate -d /etc/logrotate.d/trading-workspace` | Без ошибок | ⬜ |

**Блокер:** Если алерты не работают → STOP. Без алертов запуск невозможен.

---

## 5. Recovery

**Цель:** Все процедуры восстановления проверены и работают.

| # | Действие | Команда верификации | Ожидаемый результат | Статус |
|---|----------|---------------------|---------------------|:------:|
| 5.1 | Создать тестовый snapshot | `cp /opt/trading-workspace/data/events.db /tmp/backup-test/` | Файл скопирован | ⬜ |
| 5.2 | Проверить snapshot checksum | `sha256sum /opt/trading-workspace/data/events.db > /tmp/backup-test/checksum.txt` | Сохранён | ⬜ |
| 5.3 | Проверить восстановление из snapshot | `cp /tmp/backup-test/events.db /opt/trading-workspace/data/events.db.restored && sqlite3 /opt/trading-workspace/data/events.db.restored "SELECT count(*) FROM events;"` | `>0` (если события есть) | ⬜ |
| 5.4 | Проверить WAL checkpoint | `sqlite3 /opt/trading-workspace/data/events.db "PRAGMA wal_checkpoint(FULL);"` | `ok` | ⬜ |
| 5.5 | Проверить восстановление из WAL | `sqlite3 /opt/trading-workspace/data/events.db "PRAGMA integrity_check;"` | `ok` | ⬜ |
| 5.6 | Симуляция crash + recovery | Запустить кампанию → `kill -9 PID` → перезапустить | Healthcheck exit 0 после restart | ⬜ |
| 5.7 | Проверить hash(state) consistency | Сравнить state до и после рестарта | Hash совпадает | ⬜ |
| 5.8 | Проверить ручной Kill Switch | `touch /opt/trading-workspace/data/kill-switch` | Кампания останавливается | ⬜ |
| 5.9 | Проверить graceful shutdown | `kill -TERM $(pgrep -f "paper-campaign")` | Процесс завершается с exit 0, lock-file очищен | ⬜ |
| 5.10 | Проверить cleanup lock-file при stall | Проверить код: `scripts/paper-campaign.ts` → lock-file logic | Stale cleanup корректный | ⬜ |

**Блокер:** Восстановление после `kill -9` не проходит → STOP. RC1 требует recovery certification.

---

## 6. Stage 1 Limits

**Цель:** Параметры кампании соответствуют Stage 1 ограничениям.

| # | Параметр | Значение | Проверка | Статус |
|---|----------|:--------:|----------|:------:|
| 6.1 | Символ | `XRPUSDT` | `grep SYMBOLS .env.production` | ⬜ |
| 6.2 | Стратегия | `SmaCross` | `grep STRATEGY .env.production` | ⬜ |
| 6.3 | Размер позиции | `0.25%` | `grep RISK_PER_TRADE .env.production` | ⬜ |
| 6.4 | Макс позиций | `1` | `grep MAX_POSITIONS .env.production` | ⬜ |
| 6.5 | Дневной лимит риска | `$200` | `grep MAX_DAILY_LOSS .env.production` | ⬜ |
| 6.6 | Макс просадка | `5%` | `grep MAX_DRAWDOWN .env.production` | ⬜ |
| 6.7 | Kill Switch threshold | `3 consecutive losses` | `grep KILL_SWITCH .env.production` (или feature flag) | ⬜ |
| 6.8 | Длительность кампании | `48 hours` | Установить таймер/планировщик | ⬜ |
| 6.9 | Авто-остановка по времени | Настроена | Crontab: `shutdown-campaign.sh` через 48h | ⬜ |

**Блокер:** Любое несоответствие → STOP. Stage 1 — консервативные параметры.

---

## 7. Exit Criteria

**Цель:** Заранее определены критерии успеха и аварийной остановки.

### 7.1 — Критерии успешного завершения

| # | Критерий | Описание | Статус (после кампании) |
|---|----------|----------|:------------------------:|
| E-01 | 0 исключений | `exceptionsCount = 0` | ⬜ |
| E-02 | 0 реконнектов | `reconnectCount = 0` | ⬜ |
| E-03 | 0 lost trades/positions | Все позиции закрыты корректно | ⬜ |
| E-04 | 0 duplicate orders | Нет дубликатов в EventLog | ⬜ |
| E-05 | 0 wallet/exchange divergence | Баланс совпадает с брокером | ⬜ |
| E-06 | 0 emergency stops | KillSwitch ни разу не сработал | ⬜ |
| E-07 | Стабильная память | Рост < 10% за 48ч | ⬜ |
| E-08 | Healthcheck exit 0 | Все healthcheck-и за кампанию | ⬜ |
| E-09 | Graceful shutdown | Процесс завершён корректно | ⬜ |

### 7.2 — Причины немедленной остановки

| # | Trigger | Действие |
|---|---------|----------|
| S-01 | Любой exception | Stop campaign, gather logs, analyze |
| S-02 | Reconnect > 1 | Stop campaign, investigate WS connectivity |
| S-03 | KillSwitch сработал | Stop campaign, manual review |
| S-04 | Memory spike > 100MB | Stop campaign, gather heap dump |
| S-05 | Wallet divergence > 0.1% | Stop campaign, manual reconciliation |
| S-06 | Healthcheck FAIL 3x подряд | Automatic shutdown via cron |

### 7.3 — Данные для сохранения после кампании

| # | Артефакт | Путь | Сохранён |
|---|----------|------|:--------:|
| D-01 | Event Journal (SQLite) | `/opt/trading-workspace/data/events.db` | ⬜ |
| D-02 | WAL файл | `/opt/trading-workspace/data/events.db-wal` | ⬜ |
| D-03 | State snapshot | `/opt/trading-workspace/data/state.json` | ⬜ |
| D-04 | Health history | `/opt/trading-workspace/data/health.json` | ⬜ |
| D-05 | Metrics history | `/opt/trading-workspace/data/metrics-history.json` | ⬜ |
| D-06 | Логи кампании | `/var/log/trading-workspace/campaign.log` | ⬜ |
| D-07 | Конфигурация | `/opt/trading-workspace/.env.production` | ⬜ |
| D-08 | Config checksum | `/var/log/trading-workspace/config-checksum.txt` | ⬜ |
| D-09 | Report | Stage 1 report (TBD) | ⬜ |

---

## Итоговая верификация

Перед запуском кампании:

| Секция | Пунктов | ☑ | Статус |
|--------|:-------:|:-:|:------:|
| 1. Infrastructure | 10 | /10 | ⬜ |
| 2. Configuration | 13 | /13 | ⬜ |
| 3. Security | 8 | /8 | ⬜ |
| 4. Monitoring | 9 | /9 | ⬜ |
| 5. Recovery | 10 | /10 | ⬜ |
| 6. Stage 1 Limits | 9 | /9 | ⬜ |
| 7. Exit Criteria | | | ⬜ |
| **Total** | **59** | **/59** | ⬜ |

**Вердикт к запуску:** ☐ READY ☐ NOT READY

---

## История изменений

| Дата | Версия | Изменение |
|------|--------|-----------|
| 2026-07-23 | 1.0 | Initial release |
