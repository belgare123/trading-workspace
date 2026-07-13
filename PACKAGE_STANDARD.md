# Crypto Screener — Strategy Package Standard v2

> **Версия:** 2.0.0  
> **Статус:** DRAFT  
> **Применяется с:** screener_sdk >= 0.1.0, core >= 0.12.0  

Данный документ определяет официальный стандарт упаковки стратегий для платформы Crypto Screener. Стратегия, соответствующая этому стандарту, гарантированно работает на любой реализации платформы, проходящей certified compliance.

---

## 1. Структура директории

```
MyStrategy/
├── manifest.yaml        # Метаданные (обязательно)
├── strategy.py          # Реализация (обязательно)
├── config.yaml          # Конфигурация по умолчанию (опционально)
├── README.md            # Описание стратегии (рекомендуется)
├── CHANGELOG.md         # История изменений (рекомендуется)
├── LICENSE              # Лицензия (рекомендуется)
├── icon.png             # Иконка 128×128 (опционально)
├── icon.svg             # Иконка векторная (опционально)
├── requirements.txt     # Python-зависимости (опционально)
├── tests/               # Тесты (рекомендуется)
│   ├── __init__.py
│   ├── test_strategy.py
│   └── conftest.py
└── references/          # Материалы (опционально)
    ├── whitepaper.md
    └── backtest_results.json
```

### 1.1. Правила именования

| Элемент | Правило | Пример |
|---------|---------|--------|
| Директория | PascalCase, буквы + цифры | `Momentum`, `MACDCrossV2` |
| `manifest.yaml` | строго `manifest.yaml` | — |
| `strategy.py` | строго `strategy.py` | — |
| `config.yaml` | строго `config.yaml` | — |
| Тесты | `test_*.py` | `test_strategy.py` |
| requirements | строго `requirements.txt` | — |

### 1.2. Файлы опциональные, но рекомендованные

- **README.md** — Markdown-описание: цель, параметры, примеры, риск-предупреждение
- **CHANGELOG.md** — SemVer-лог изменений в формате [Keep a Changelog](https://keepachangelog.com/)
- **LICENSE** — SPDX-идентификатор в первой строке (например `SPDX-License-Identifier: MIT`)
- **icon.png** — PNG 128×128, квадратная, прозрачный фон или цветная
- **icon.svg** — SVG-иконка (приоритет выше png)
- **requirements.txt** — зависимости, каждая на отдельной строке: `numpy>=1.24`, `pandas>=2.0`

---

## 2. manifest.yaml (v2)

### 2.1. Полная схема

```yaml
# ── Обязательные поля ──
name: Momentum                    # Уникальное имя стратегии (PascalCase, [a-zA-Z][a-zA-Z0-9_ -]{0,63})

# ── Идентификация ──
version: 1.2.0                    # SemVer (обязательно)
author: Vitaliy                   # Имя автора (обязательно)
description: >                    # Описание (рекомендуется)
  Trend following strategy based
  on EMA crossover with RSI filter
homepage: https://example.com     # URL проекта (опционально)
repository: https://github.com/   # URL репозитория (опционально)
license: MIT                      # SPDX-идентификатор (опционально)

# ── Совместимость ──
api_version: "2.0"                # API платформы (обязательно)
min_core: "0.12.0"                # Минимальная версия ядра (рекомендуется)

# ── Категоризация ──
category: trend                   # Категория (см. 2.2)
tags:                             # Теги для поиска (опционально)
  - EMA
  - Trend
  - Breakout

# ── Торговые параметры ──
exchange:                         # Поддерживаемые биржи (опционально)
  - binance
  - bybit
markets:                          # Типы рынков (опционально)
  - spot
  - futures
timeframes:                       # Таймфреймы (опционально)
  - 1m
  - 5m
  - 15m
  - 1h

# ── Поведенческий профиль ──
profile:
  style: trend_following          # Стиль (см. 2.3)
  holding_time: intraday          # Время удержания
  signal_frequency: medium        # Частота сигналов
  expected_win_rate: 0.55         # Ожидаемая доля прибыльных сделок
  expected_rr: 2.5                # Риск/прибыль
  risk_level: medium              # Уровень риска
  preferred_market_regime:        # Предпочтительные режимы рынка
    - trending
    - high_volatility

# ── Возможности и разрешения ──
capabilities:                     # Признаки, необходимые стратегии
  - candles
  - ema
  - rsi
  - atr
permissions:                      # Разрешения (опционально)
  - filesystem:read               # Чтение своих файлов
  - market_data                   # Доступ к рыночным данным
  - signals                       # Отправка сигналов

# ── Технические поля ──
entry: strategy.py                # Точка входа (по умолч. strategy.py)
config_schema:                    # Схема config.yaml (см. 5.3)
  parameters:
    fast_period:
      type: int
      default: 9
      min: 3
      max: 50
      description: "Fast EMA period"
dependencies:                     # Зависимости от других плагинов (опционально)
  - name: DataNormalizer
    version: ">=1.0"
    optional: true
```

### 2.2. Категории (поле `category`)

| Значение | Описание |
|----------|----------|
| `trend` | Трендовая (следует за трендом) |
| `momentum` | Моментум (импульсная) |
| `mean_reversion` | Контр-трендовая (возврат к среднему) |
| `scalping` | Скальпинг (микро-сделки) |
| `breakout` | Пробой уровней |
| `pattern` | Паттерн-трейдинг |
| `market_making` | Маркет-мейкинг |
| `arbitrage` | Арбитраж |
| `whale` | Кит-детекция |
| `custom` | Другая |

### 2.3. Profile — поведенческий профиль

Поле `profile` декларирует ожидаемое поведение стратегии. Не конфигурация, а **декларация намерений**.

```yaml
profile:
  style:                  # trend_following | mean_reversion | breakout | scalping
  holding_time:           # intraday | swing | position
  signal_frequency:       # high | medium | low
  expected_win_rate:      # float 0.0–1.0
  expected_rr:            # float >= 0.0
  risk_level:             # conservative | medium | aggressive
  preferred_market_regime: # list: trending, ranging, high_volatility, low_volatility
```

**Семантика:** Платформа НЕ использует profile для изменения поведения. Profile предназначен для:
- **Decision Engine** — какие стратегии включать в текущем режиме рынка
- **Quality Engine** — сравнение expected vs actual метрик
- **Marketplace** — фильтрация по стилю, риску, частоте сигналов
- **Dashboard** — рекомендации пользователю

### 2.4. Permissions — разрешения

| Значение | Описание |
|----------|----------|
| `market_data` | Доступ к рыночным данным (цены, объёмы) |
| `signals` | Разрешено отправлять сигналы |
| `trades` | Разрешено отправлять торговые поручения |
| `filesystem:read` | Чтение файлов в своей директории |
| `filesystem:write` | Запись файлов в своей директории |
| `network` | Прямые сетевые вызовы (не через API платформы) |
| `all` | Все разрешения |

По умолчанию стратегия получает `market_data` и `signals`. Остальные требуют явного указания.

### 2.5. Override — переопределение полей

Платформа может переопределить поля manifest.yaml через config.yaml стратегии с префиксом `manifest_`. Например:
```yaml
# config.yaml
manifest_tags:
  - custom_tag
manifest_category: scalping
```

---

## 3. strategy.py — контракт

Каждая стратегия обязана:
1. Импортировать `BaseStrategy` из `screener_sdk`
2. Наследовать `BaseStrategy`
3. Реализовать `async def analyze(self, ctx: StrategyContext) -> SignalBundle`
4. Иметь дефолтный конструктор без обязательных аргументов (кроме `name`, `manifest_path`)

```python
from screener_sdk import BaseStrategy, StrategyContext, SignalBundle

class MyStrategy(BaseStrategy):
    async def analyze(self, ctx: StrategyContext) -> SignalBundle:
        # Trading logic here
        ...
        return bundle
```

### 3.1. Запрещено

- Использовать `import os`, `import subprocess`, `import socket` и другие модули вне белого списка (см. Sandbox)
- Писать файлы за пределами своей директории
- Делать прямые HTTP-вызовы (используйте `ctx.api.*`)
- Блокировать event loop синхронными операциями

---

## 4. config.yaml — конфигурация

Должна соответствовать `config_schema` из manifest.yaml. Пример:

```yaml
fast_period: 9
slow_period: 21
rsi_period: 14
atr_period: 14
rsi_overbought: 70
rsi_oversold: 30
atr_multiplier: 2.0
min_confidence: 50
symbols:
  - BTC/USDT
  - ETH/USDT
```

Параметры, не указанные в config.yaml, получают значения `default` из `config_schema`.

---

## 5. Процесс публикации

1. **Validate** — `core.strategy.validate(plugin)` проходит все проверки
2. **Certificate** — платформа вычисляет SHA256 всех файлов стратегии
3. **Package** — стратегия упаковывается в `.spkg` (tar.gz с метаданными)
4. **Registry** — стратегия регистрируется в PluginManager

---

## 6. Версионирование

- **manifest.yaml** — `version: <semver>`
- **api_version** — версия публичного API платформы (не меняется внутри мажорной версии)
- **min_core** — минимальная версия ядра, с которой совместима стратегия

Правила:
- `MAJOR` bump — ломающие изменения схемы сигналов
- `MINOR` bump — новые параметры, обратно совместимые
- `PATCH` bump — исправления, оптимизации, новые таймфреймы

---

## 7. Compliance Checklist

- [ ] Директория названа PascalCase
- [ ] `manifest.yaml` существует, все обязательные поля заполнены
- [ ] `strategy.py` существует, наследует `BaseStrategy` из `screener_sdk`
- [ ] `strategy.py` не импортирует заблокированные модули
- [ ] `api_version` совместима с платформой
- [ ] `config_schema` (если есть) валидна
- [ ] `config.yaml` (если есть) соответствует `config_schema`
- [ ] `README.md` существует (рекомендуется)
- [ ] `LICENSE` существует (рекомендуется)
- [ ] `CHANGELOG.md` существует (рекомендуется)
- [ ] `icon.png` — 128×128 (если есть)
- [ ] `permissions` не запрашивает избыточных прав
- [ ] `profile` заполнен (рекомендуется)
- [ ] SHA256-отпечаток вычислен
