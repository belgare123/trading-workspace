# Runtime Documentation Portal

> **Version:** 2.0.0
> **Status:** ⚡ Active
> **Last Updated:** 2026-07-15

This portal is the official reference for the **Runtime Kernel** — the platform that powers Workspace, Trading Lab, Cloud Console, and all future clients.

## 📚 Sections

### Overview

| Document | Description |
|----------|-------------|
| [Architecture](./Overview/Architecture.md) | System architecture and design decisions |
| [Runtime Kernel](./Overview/RuntimeKernel.md) | Core concepts and mental model |
| [Layer Model](./Overview/LayerModel.md) | Layer separation and responsibilities |
| [Philosophy](./Overview/Philosophy.md) | Platform design principles |

### SDK

| Document | Description |
|----------|-------------|
| [Runtime API](./SDK/RuntimeAPI.md) | Core Runtime API surface |
| [EventBus](./SDK/EventBus.md) | Typed event system |
| [Widget SDK](./SDK/WidgetSDK.md) | Building dashboard widgets |
| [Plugin SDK](./SDK/PluginSDK.md) | Writing Runtime plugins |
| [Command SDK](./SDK/CommandSDK.md) | Registering and invoking commands |
| [Search SDK](./SDK/SearchSDK.md) | Search and discovery |
| [Timeline SDK](./SDK/TimelineSDK.md) | Time-series and replay |

### Services

| Document | Description |
|----------|-------------|
| [Market Service](./Services/Market.md) | Market data and order books |
| [Strategy Service](./Services/Strategy.md) | Trading strategy lifecycle |
| [Portfolio Service](./Services/Portfolio.md) | Balances and positions |
| [Replay Service](./Services/Replay.md) | Historical data replay |
| [ML Service](./Services/ML.md) | Models and predictions |
| [EventStore Service](./Services/EventStore.md) | Persistent event storage |

### Events

| Document | Description |
|----------|-------------|
| [Topic Convention](./Events/Topics.md) | Event naming and namespaces |
| [RuntimeEvent](./Events/RuntimeEvent.md) | Canonical event format |
| [Event Recorder](./Events/Recorder.md) | Recording and replay of events |
| [Middleware Pipeline](./Events/Middleware.md) | Intercepting and transforming events |

### Plugins

| Document | Description |
|----------|-------------|
| [Manifest](./Plugins/Manifest.md) | Plugin package manifest |
| [Lifecycle](./Plugins/Lifecycle.md) | Plugin state machine |
| [Capabilities](./Plugins/Capabilities.md) | Permission model |
| [Sandbox](./Plugins/Sandbox.md) | Security isolation |
| [Versioning](./Plugins/Versioning.md) | Dependency resolution |

### Guides

| Document | Description |
|----------|-------------|
| [Hello Widget](./Guides/HelloWidget.md) | Your first dashboard widget |
| [Hello Plugin](./Guides/HelloPlugin.md) | Your first Runtime plugin |
| [Hello Runtime Service](./Guides/HelloService.md) | Custom runtime service |
| [Using EventBus](./Guides/UsingEventBus.md) | Event-driven development |
| [Building Dashboard Widget](./Guides/BuildingWidget.md) | Advanced widget patterns |
| [Publishing Package](./Guides/Publishing.md) | Distribution and versioning |

### Reference

| Document | Description |
|----------|-------------|
| [API Reference](./Reference/API.md) | Complete API surface |
| [Contracts](./Reference/Contracts.md) | Runtime contract tests |
| [Capabilities Reference](./Reference/Capabilities.md) | All capability types |
| [Event Topics Reference](./Reference/Events.md) | All standard event topics |

---

## 🧭 How to Use This Portal

1. **New developers** → Start with [Architecture](./Overview/Architecture.md) and [Hello Widget](./Guides/HelloWidget.md)
2. **Plugin authors** → [Plugin SDK](./SDK/PluginSDK.md) → [Manifest](./Plugins/Manifest.md) → [Lifecycle](./Plugins/Lifecycle.md)
3. **Service integrators** → [Runtime API](./SDK/RuntimeAPI.md) → individual [Service](./Services/) docs
4. **Platform architects** → [Layer Model](./Overview/LayerModel.md) → [Contracts](./Reference/Contracts.md)
5. **Everyone** → [EventBus](./SDK/EventBus.md) and [Topic Convention](./Events/Topics.md)
