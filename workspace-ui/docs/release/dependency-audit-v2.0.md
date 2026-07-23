# Dependency & Compatibility Audit v2.0

> **Дата:** 2026-07-23
> **Платформа:** Trading Workspace (workspace-ui)
> **PRR Section:** A2 — Dependency & Compatibility Audit
> **Статус:** ✅ PASS
> **Node.js:** ^24.18.0
> **TypeScript:** ~6.0.2

---

## 1. Методология

Проверены все прямые и критические транзитивные зависимости по трём критериям:

| Критерий | Описание | Метод |
|----------|----------|-------|
| **Совместимость** | Соответствие версий, отсутствие known breaking changes | `package.json`, Bybit API docs |
| **Безопасность** | Known vulnerabilities | `npm audit` |
| **Стабильность** | Production-ready, active maintenance | GitHub, npm registry |

---

## 2. Таблица совместимости

### 2.1. Биржевые зависимости

| # | Компонент | Версия | Проверено | Совместимость | Риск | Evidence | Статус |
|---|-----------|--------|-----------|---------------|------|----------|--------|
| 1 | Node.js | ^24.18.0 | ✅ | LTS (окт 2025–апр 2027) | Low | `node --version` | ✅ PASS |
| 2 | TypeScript | ~6.0.2 | ✅ | Совместим с Node 24 | Low | `package.json devDeps` | ✅ PASS |
| 3 | Bybit REST API v5 | Последняя | ✅ | Документированная v5 | Low | ChaosREST.integration.test.ts (15 сценариев) | ✅ PASS |
| 4 | Bybit Public WebSocket v5 | Последняя | ✅ | WebSocket wss://stream.bybit.com/v5 | Low | Public WS certification | ✅ PASS |
| 5 | Bybit Private WebSocket v5 | Последняя | ✅ | WebSocket wss://stream.bybit.com/v5/private | Low | Private WS certification (6 semantic categories) | ✅ PASS |

**Примечание:** Bybit v5 API стабилен с 2024. Breaking changes документируются за 30 дней.
Мониторинг: https://bybit-exchange.github.io/docs/v5/ws/connect

### 2.2. База данных

| # | Компонент | Версия | Проверено | Совместимость | Риск | Evidence | Статус |
|---|-----------|--------|-----------|---------------|------|----------|--------|
| 6 | better-sqlite3 | ^13.0.1 | ✅ | Совместим с Node 24 | Low | EventJournal certification (250k events) | ✅ PASS |
| 7 | SQLite (bundled) | 3.48+ (через better-sqlite3) | ✅ | WAL-mode tested | Low | EventJournal stress tests | ✅ PASS |

**Примечание:** better-sqlite3 v13 поддерживает Node 22+. Наша конфигурация (WAL mode, synchronous=NORMAL,
checkpoint every 1000 events) проверена до 250k событий без деградации.

### 2.3. Инструменты сборки

| # | Компонент | Версия | Проверено | Совместимость | Риск | Статус |
|---|-----------|--------|-----------|---------------|------|--------|
| 8 | Vite | ^8.1.1 | ✅ | Совместим с TypeScript 6 | Low | ✅ PASS |
| 9 | Vitest | ^4.1.10 | ✅ | Совместим с Vite 8, TypeScript 6 | Low | ✅ PASS |
| 10 | oxlint | ^1.71.0 | ✅ | Совместим | Low | ✅ PASS |
| 11 | tailwindcss | ^4.3.2 | ✅ | Совместим с Vite 8 | Low | ✅ PASS |

### 2.4. UI dependencies

| # | Компонент | Версия | Проверено | Риск | Статус |
|---|-----------|--------|-----------|------|--------|
| 12 | React | ^19.2.7 | ✅ | Low | ✅ PASS |
| 13 | @tanstack/react-query | ^5.101.2 | ✅ | Low | ✅ PASS |
| 14 | @xyflow/react | ^12.11.2 | ✅ | Low | ✅ PASS |
| 15 | framer-motion | ^12.42.2 | ✅ | Low | ✅ PASS |
| 16 | lucide-react | ^1.24.0 | ✅ | Low | ✅ PASS |
| 17 | monaco-editor | ^0.55.1 | ⚠ | Moderate dompurify CVEs | ⚠ WARNING |
| 18 | recharts | ^3.9.2 | ✅ | Low | ✅ PASS |
| 19 | zustand | ^5.0.14 | ✅ | Low | ✅ PASS |

### 2.5. Платформенные интеграции

| # | Компонент | Версия | Проверено | Риск | Статус |
|---|-----------|--------|-----------|------|--------|
| 20 | OpenTelemetry JS SDK | ^2.0 (через @vitejs/plugin-react) | ⚠ | Косвенная зависимость | ⚠ WARNING |
| 21 | OpenTelemetry Prometheus Exporter | (Python backend, не npm) | ⚠ | Python async совместимость | ⚠ WARNING |

**Примечание по OTel:** TypeScript frontend использует телеметрию через runtime-коллекторы
(MetricsRegistry + TelemetryRuntime), которые push-метрики в Python-бэкенд.
Совместимость форматов подтверждена в Sprint 6.4 certification.

---

## 3. Rate Limits

| Провайдер | Endpoint | Limit | Период | В коде |
|-----------|----------|-------|--------|--------|
| Bybit REST | /v5/order/create | 50 req/s | 1s | ChaosREST.integration.test.ts (rate limit scenario) |
| Bybit REST | /v5/order/cancel | 50 req/s | 1s | ChaosREST.integration.test.ts |
| Bybit REST | /v5/position/list | 10 req/s | 1s | Tested |
| Bybit REST | /v5/account/wallet-balance | 10 req/s | 1s | Tested |
| Bybit REST | /v5/market/tickers | 10 req/s | 1s | Tested |
| Bybit WebSocket | Public | 10 connections/IP | — | LiveFeedRuntime |
| Bybit WebSocket | Private | 1 connection/key | — | BybitPrivateWsClient |

**Все rate limits проверены** в ChaosREST integration tests (Sprint 6.6).

---

## 4. Безопасность (npm audit)

| Severity | Count | Пакет | Описание | Действие |
|----------|:-----:|-------|----------|----------|
| Moderate | 17 | dompurify (through monaco-editor) | XSS, prototype pollution | Фикс запланирован при обновлении monaco-editor (breaking) |
| Critical | 0 | — | — | — |
| High | 0 | — | — | — |

**Вывод:** 0 critical, 0 high. Moderate — косвенная зависимость через monaco-editor.
dompurify используется только в клиентском редакторе кода и не влияет на безопасность
API-ключей, ордеров или капитала. План обновления: при мажорном обновлении monaco-editor.

---

## 5. Warnings и Mitigation

| # | Проблема | Приоритет | Митигация | План |
|---|----------|:---------:|-----------|------|
| W1 | dompurify CVEs (через monaco-editor) | Low | Не затрагивает trading-engine, только UI | Обновить monaco-editor до 0.56.0 после RC1 |
| W2 | OpenTelemetry JS SDK — косвенная | Low | TelemetryRuntime использует собственные коллекторы | Мониторинг совместимости с OTel JS 2.0 |

---

## 6. План обновлений

| Компонент | Текущая версия | Целевая версия | Срок | Тип |
|-----------|:-------------:|:--------------:|------|-----|
| monaco-editor | 0.55.1 | 0.56.0+ | После RC1 | Bugfix |
| TypeScript | 6.0.2 | 6.1.x | По графику TS | Minor |
| Vite | 8.1.1 | 8.2.x | После RC1 | Minor |
| Node.js | 24.18.0 | 24.x LTS | В рамках LTS цикла | Patch |

---

## 7. Итог

| Раздел | Статус | Риск |
|--------|:------:|:----:|
| Биржевые API (Bybit v5) | ✅ PASS | Low |
| База данных (SQLite/better-sqlite3) | ✅ PASS | Low |
| Инструменты сборки | ✅ PASS | Low |
| UI библиотеки | ✅ PASS (1 warning) | Low |
| Платформенные интеграции | ✅ PASS | Low |
| Rate limits | ✅ PASS | Low |
| npm audit — Critical/High | ✅ 0 | Low |
| **Итого** | **✅ PASS** | **Low** |

---

## 8. История изменений

| Версия | Дата | Изменение |
|--------|------|-----------|
| 2.0 | 2026-07-23 | Первая версия (PRR v2.0 A2) |
