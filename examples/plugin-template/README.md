# Plugin Template

> **Назначение:** шаблон для нового Runtime плагина
> **Время:** ~1 минута на копирование

## Быстрый старт

```bash
cp -r examples/plugin-template my-plugin
cd my-plugin
# Отредактируйте manifest.json (id, name, permissions)
# Отредактируйте index.ts (widget, commands, search)
# Соберите и установите
```

## Структура

```
plugin-template/
├── manifest.json      ← Метаданные плагина
├── index.ts           ← register() / unregister()
├── package.json       ← Зависимости для сборки
├── tsconfig.json      ← TypeScript конфиг
├── vite.config.ts     ← Vite конфиг для плагина
└── README.md          ← Этот файл
```

## Шаги для создания плагина

1. **manifest.json** — измените `id`, `name`, `permissions`, `dependencies`  
2. **index.ts** — реализуйте `register(ctx)` и `unregister()`
3. **Сборка** — `npm run build` (соберёт в `dist/manifest.json` + `dist/index.js`)
4. **Установка** — загрузите через PluginLoader или PluginStore

## Что умеет шаблон

- ✅ Widget — `WidgetRegistry.register()`
- ✅ Команды — `ctx.commands.register()`
- ✅ Search — `ctx.search.register()`
- ✅ EventBus — `runtimeEventBus.on()`
- ✅ Notification — `ctx.notifications.send()`
- ✅ Build — Vite + TypeScript
