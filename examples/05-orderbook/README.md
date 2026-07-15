# 05 — Order Book

> **Новое:** real-time streaming + throttling + React.memo оптимизация
> **Время:** ~15 минут
> **Концепции:** `market.depth`, `throttle()`, `React.memo`, виртуализация списка, cumulative totals

## Что показывает

Real-time книга ордеров с оптимизированным рендерингом. Обрабатывает высокочастотные обновления (market.depth) с throttling 100ms.

```
market.depth (1000/s) ──► throttle(100ms) ──► React.memo(OrderBookRow)
                                                    │
                                              Visual bar + price
```

## Оптимизации

| Техника | Зачем | Где |
|---------|-------|-----|
| `throttle(100ms)` | Не рендерить 1000 раз/с | `updateDepth` ref |
| `React.memo` | Не перерисовывать строки без изменений | `OrderBookRow` |
| `slice(0, 15)` | Не рендерить 100+ уровней | В `updateDepth` |
| `useRef` | Не создавать throttle при ререндере | `updateDepth` ref |

## Код

```typescript
// Throttling высокочастотных обновлений
const updateDepth = throttle((payload: DepthPayload) => {
  setBids(payload.bids.sort(...).slice(0, 15))
  setAsks(payload.asks.sort(...).slice(0, 15))
}, 100)

// Оптимизированная строка
const OrderBookRow = memo(function OrderBookRow({ level, maxSize, side }) {
  const barWidth = (level.size / maxSize) * 100
  return <div style={{ width: `${barWidth}%` }} />
})
```

## Далее

→ [06-risk-dashboard](../06-risk-dashboard/README.md): несколько сервисов + timeline + команды
