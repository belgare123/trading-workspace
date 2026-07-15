# 03 — Market Heatmap

> **Новое:** Market API + EventBus + real-time + capabilities
> **Время:** ~10 минут
> **Концепции:** `MarketApi`, `runtimeEventBus.on()`, `market.read`, `Widget` → `EventBus`

## Что показывает

Real-time тепловая карта рынка. Подписывается на `market.tick` через EventBus и отображает цену с цветовой индикацией изменения.

```
Widget ──on('market.tick')──► EventBus
                                  ▲
                                  │ emit
                             Market Service
```

## Отличия от Example 2

| Концепция | Example 2 | Example 3 |
|-----------|-----------|-----------|
| Widget | ✅ | ✅ |
| Команды | ✅ | ❌ |
| Search | ✅ | ✅ |
| EventBus | ❌ | ✅ `market.tick` |
| Capabilities | ❌ | ✅ `market.read` |
| Service API | ❌ | ✅ MarketApi |

## Код

```typescript
// Подписка на EventBus в React-компоненте
useEffect(() => {
  const unsub = runtimeEventBus.on('market.tick', (evt) => {
    const { symbol, price, change } = evt.payload
    setTickers((prev) => new Map(prev).set(symbol, { symbol, price, change }))
  })
  return () => unsub()
}, [])
```

## Чего здесь НЕТ

❌ Команды — не нужны для heatmap
❌ Notifications — будут в Example 4
❌ Realtime WebSocket — это уровень транспорта (здесь скрыт за MarketApi)
❌ Несколько сервисов — будет в Example 6

## Далее

→ [04-telegram-notifier](../04-telegram-notifier/README.md): команды + уведомления + runtime events
