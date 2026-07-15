# 01 — Hello Widget

> **Новое:** первый виджет в Dashboard
> **Время:** ~5 минут
> **Концепции:** `manifest.json`, `WidgetRegistry`, `WidgetDefinition`

## Что показывает

Простейший плагин. Регистрирует React-виджет, который выводит "Hello, Runtime!" в Dashboard.

```
┌─────────────────────┐
│   PluginLoader      │
│   │                 │
│   ▼                 │
│ register()          │
│   │                 │
│   ▼                 │
│ WidgetRegistry      │
│   │                 │
│   ▼                 │
│ Dashboard (UI)      │
└─────────────────────┘
```

## Файлы

| Файл | Назначение |
|------|-----------|
| `manifest.json` | id, версия, permissions, зависимости |
| `index.ts` | `register()` / `unregister()` — точка входа |
| `README.md` | Эта документация |

## Код

```typescript
function HelloWidget() {
  return <h2>👋 Hello, Runtime!</h2>
}

const definition: WidgetDefinition = {
  id: 'hello-widget',
  name: 'Hello Widget',
  category: 'custom',
  defaultSize: { w: 2, h: 2 },
  component: HelloWidget,
}

export function register() {
  WidgetRegistry.register(definition)
}
```

## Чего здесь НЕТ

❌ EventBus — будет в Example 3
❌ Сервисы (Market, Strategy) — будут в Example 3
❌ Команды — будут в Example 2
❌ Уведомления — будут в Example 4
❌ Search — будет в Example 2

Только одна вещь: **регистрация виджета**.

## Далее

→ [02-hello-plugin](../02-hello-plugin/README.md): register/unregister, команды, search
