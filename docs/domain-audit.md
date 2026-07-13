# Domain Audit — V1/V2 Architecture Analysis

> Дата: 2026-07-13
> Контекст: Feature Freeze v0.15.x → v1.0

## Методология

Аудит проведён для каждого модуля, исторически считавшегося "V1 legacy".
Критерии:
- **DELETE** — технический мусор, без функциональной нагрузки
- **REMOVE AFTER MIGRATION** — заменён V2, требуется переключить импорты
- **MIGRATE** — живой домен, требует переезда в целевую архитектуру
- **KEEP** — актуальный компонент новой платформы

## Результаты

### DELETE — можно удалить сейчас

| Модуль | Обоснование |
|---|---|
| `core/legacy/` | Пустой пакет (только `__init__.py` с docstring). Никем не импортируется. |
| `core/app/interfaces.py` | Re-export `core.services.base.IService` с `DeprecationWarning`. Никем не импортируется. |
| `core/decision/models.Decision` | Legacy dataclass (был нужен для `core/signal/engine.py`). Заменён `ConsensusResult`. |

### REMOVE AFTER MIGRATION — миграция импортов на V2

| Модуль | V2-замена | Статус |
|---|---|---|
| `core/consensus/` (engine, models, rank) | `core/decision/engine.py` + `core/decision/consensus.py` + `core/decision/weighting.py` | 🟡 Требует миграции: SignalEngine использует V1 ConsensusResult (score, votes, buy_ratio, total_votes), которых нет в V2. Нужно дополнить V2 ConsensusResult или адаптировать SignalEngine. |

### MIGRATE — живые домены, требующие реархитектуры

| Модуль | LOC | Будущий домен | Задача |
|---|---|---|---|
| `core/signal/engine.py` (SignalEngine) | 243 | `core/execution/signal_orchestrator.py` | P2 — Signal Orchestrator |
| `core/risk/` (RiskEngine + rules) | ~300 | `core/risk/validator.py` + `core/risk/rules/` | P2 — Risk Validator |
| `core/ome/` (OME + sizer + executor + tracker) | ~18k | `core/execution/` (sizer, risk_manager, executor, tracker) | P2 — Execution Engine |

## Архитектурные заметки

### SignalEngine (core/signal/engine.py)
Не legacy, а **Signal Orchestrator** — связующее звено между Decision Engine, Risk, Sizing и Telegram.
Pipeline: consensus → DecisionEngine(cooldown) → RiskEngine → OME → SignalResult → Telegram.
Единственный способ отправки сигналов в Telegram.

### RiskEngine (core/risk/)
Пре-трейд validation layer. Плагинная архитектура (RiskRule) — работает как chain-of-responsibility.
Rules: Spread, ATR, Liquidity, Session.

### OME (core/ome/)
Order Management Engine — фасад над PositionSizer + RiskManager + PositionTracker + OrderExecutor.
18k строк — самый крупный V1-модуль. Это фактически Execution Engine платформы.
V2 Lifecycle Engine имеет частичное пересечение (команды ClosePosition, AdjustStop), но не покрывает полностью.

## После v1.0

### Multi-Exchange Runtime (v1.1)
Execution Engine будет ключевым потребителем ExchangeAdapter.

### Cloud Platform (v1.2)
Workspace Sync и Remote Replay потребуют Event Store.

### Simulation Lab (v2.0)
Scenario Builder → Event Store → Replay → Decision → Lifecycle → Metrics.
