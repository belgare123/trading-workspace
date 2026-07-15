# 04 — Telegram Notifier

> **Новое:** команды + уведомления + runtime events + настройки
> **Время:** ~10 минут
> **Концепции:** `NotificationApi`, `runtimeEventBus.on('strategy.*')`, команды с `ctx`, плагин с настройками

## Что показывает

Плагин подписывается на `strategy.signal` и отправляет уведомления. Включает виджет настроек, команду тестирования и сохранение конфигурации.

```
strategy.signal ──► EventBus ──► TelegramNotifier
                                    │
                              NotificationApi.send()
```

## Отличия от Example 3

| Концепция | Example 3 | Example 4 |
|-----------|-----------|-----------|
| Widget | ✅ | ✅ (settings) |
| EventBus (on) | ✅ market.tick | ✅ strategy.signal |
| NotificationApi | ❌ | ✅ |
| Команды | ❌ | ✅ (test) |
| Настройки | ❌ | ✅ localStorage |
| Несколько подписок | ❌ | ✅ |

## Код

```typescript
// Подписка на сигналы
runtimeEventBus.on('strategy.signal', (evt) => {
  const signal = evt.payload
  if (signal.confidence >= settings.minConfidence) {
    ctx.notifications.send({
      title: `Signal: ${signal.symbol}`,
      message: `${signal.direction} @ $${signal.price}`,
    })
  }
})
```

## Далее

→ [05-orderbook](../05-orderbook/README.md): realtime + streaming + render optimization
