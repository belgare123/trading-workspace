# 07 — ML Predictor

> **Новое:** полный стек Runtime
> **Время:** ~20 минут
> **Концепции:** ML Service, `ml.*` события, custom event, middleware, capabilities `ml.read`/`ml.write`

## Что показывает

ML-плагин, задействующий практически все возможности Runtime:

```
MLService ──► ml.predict ──► Widget (chart + history)
    │                           │
    │                           ├── Notification (команда)
    │                           ├── Timeline (ml.predict)
    │                           ├── Search (models)
    │                           └── EventRegistry (custom schema)
    │
    ├── Command: predict ──► Notification
    └── Command: train   ──► Notification
```

## Отличия от Example 6

| Концепция | Example 6 | Example 7 |
|-----------|-----------|-----------|
| ML Service | ❌ | ✅ `ml.read`, `ml.write` |
| Custom Event | ❌ | ✅ `ml.predict` (registered) |
| Middleware | ❌ | ✅ для `ml.*` |
| Custom Schema | ❌ | ✅ EventRegistry |
| Widget | 3 | 1 (но плотный) |
| Commands | 2 | 2 |
| Search | ✅ | ✅ |

## Весь стек задействован

```
   Manifest          → permissions, dependencies
   WidgetRegistry    → ML widget with prediction UI
   EventBus          → ml.predict events
   EventRegistry     → custom schema registration
   Middleware        → logging all ml.* events
   PluginContext     → commands + search + notifications
   Capabilities      → ml.read, ml.write, market.read, event.write
   PluginLoader      → lifecycle (register/unregister)
```

## Код

```typescript
// Custom event schema + middleware
EventRegistry.register({
  topic: 'ml.predict',
  description: 'ML model prediction result',
  payload: {} as PredictionResult,
})
runtimeEventBus.use((event, next) => {
  if (event.topic.startsWith('ml.')) console.log(event.payload)
  next()
})

// Emit prediction result
runtimeEventBus.emit('ml.predict', { modelId, prediction, confidence }, {
  source: 'MLPredictor',
  severity: 'info',
})
```

## Поздравляю!

Ты прошёл все 7 шагов. Теперь ты знаешь:
- ✅ Как зарегистрировать виджет (01)
- ✅ Как использовать PluginLoader + команды + search (02)
- ✅ Как работать с Market API + EventBus (03)
- ✅ Как отправлять уведомления и реагировать на события (04)
- ✅ Как оптимизировать real-time рендеринг (05)
- ✅ Как комбинировать несколько сервисов (06)
- ✅ Как интегрировать ML + кастомные события + middleware (07)

Следующий шаг — [plugin-template](../plugin-template/): создай свой плагин!
