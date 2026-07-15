# 02 — Hello Plugin

> **Новое:** lifecycle + команды + поиск
> **Время:** ~10 минут
> **Концепции:** `register()`, `unregister()`, `CommandRegistry`, `SearchAdapter`, `PluginContext`

## Что показывает

Полноценный плагин с тремя точками расширения.

```
PluginLoader
    │
    ├── register() ──► WidgetRegistry
    │                    (1 виджет)
    │
    ├── ctx.commands ──► CommandRegistry
    │                     (1 команда: greet)
    │
    └── ctx.search ──► SearchAdapter
                       (1 адаптер: hello)
```

## Отличия от Example 1

| Концепция | Example 1 | Example 2 |
|-----------|-----------|-----------|
| Widget | ✅ | ✅ |
| Команды | ❌ | ✅ |
| Search | ❌ | ✅ |
| PluginContext | ❌ | ✅ |
| register/unregister | ✅ | ✅ |

## Код

```typescript
export function register(ctx: PluginContext) {
  // 1. Регистрация виджета
  WidgetRegistry.register(widgetDef)

  // 2. Регистрация команды
  ctx.commands.register({
    id: 'hello-plugin.greet',
    name: 'Greet',
    shortcut: 'Ctrl+Shift+G',
    execute: (name: string) => greetCommand(name),
  })

  // 3. Регистрация поиска
  ctx.search.register({
    id: 'hello-plugin-search',
    name: 'Hello Search',
    search: (query) => [/* результаты */],
  })
}
```

## Чего здесь НЕТ

❌ EventBus — будет в Example 3
❌ Сервисы Runtime — будут в Example 3
❌ Capabilities — будут в Example 3
❌ Notifications — будут в Example 4

## Далее

→ [03-market-heatmap](../03-market-http/README.md): Market API + EventBus + real-time данные
