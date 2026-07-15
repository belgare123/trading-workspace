# 06 — Risk Dashboard

> **Новое:** несколько сервисов + timeline + несколько виджетов + команды + search
> **Время:** ~15 минут
> **Концепции:** Multi-widget, `portfolio.*` события, `strategy.signal`, timeline, multi-command

## Что показывает

Плагин с тремя виджетами, двумя командами и поиском. Использует Portfolio, Strategy и Market сервисы одновременно.

```
Portfolio Service ──► portfolio.position ──► RiskOverviewWidget
    │                                         RiskPositionsWidget
    │
Strategy Service ──► strategy.signal ──────► RiskTimelineWidget
    │
Commands ──► close-all ──► NotificationApi
          ──► summary   ──► NotificationApi
```

## Отличия от Example 5

| Концепция | Example 5 | Example 6 |
|-----------|-----------|-----------|
| Виджетов | 1 | 3 |
| Команд | 0 | 2 |
| Search | ❌ | ✅ |
| Timeline | ❌ | ✅ |
| Сервисов | 1 (Market) | 3 (Portfolio, Strategy, Market) |
| Подписок | 1 | 4 |

## Код

```typescript
// Три независимых виджета — один плагин
WidgetRegistry.register(riskOverview)      // portfolio.position
WidgetRegistry.register(riskPositions)      // portfolio.position
WidgetRegistry.register(riskTimeline)       // strategy.signal + portfolio.position
```

## Далее

→ [07-ml-predictor](../07-ml-predictor/README.md): полный стек ML
