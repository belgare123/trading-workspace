# Runtime Kernel

> **Source:** `runtime/EventBus.ts`, `runtime/RuntimeEvent.ts`, `runtime/PluginLoader.ts`

## What is Runtime Kernel?

Runtime Kernel is the **platform** between trading domain logic and user interfaces. It is not an application — it is the shared foundation that all applications use.

## Core Concepts

### Event-Driven Architecture

Everything in the Runtime is an event. Services emit events. Widgets consume events. The EventBus mediates all communication with typed subscriptions and middleware.

### Service Registry

Services (Market, Strategy, Portfolio, etc.) are registered in a **Container** and accessed through typed contracts. The UI never creates services directly — it asks the Container for them.

### Plugin Model

Functionality is packaged as **Plugins**. Each plugin has a manifest, declared capabilities, and a lifecycle (install → validate → load → activate → ready). Plugins are sandboxed from each other.

### DevTools

The Runtime includes a full suite of developer tools — Event Inspector, Service Inspector, Profiler Studio — that work with any Runtime implementation.

## Key Design Principles

1. **No direct dependencies** — UI depends on contracts, not implementations
2. **Everything is observable** — Services emit events for every state change
3. **Pluggable by design** — Plugins can extend every part of the Runtime
4. **Self-documenting** — Event Registry, Contract Tests, and TSDoc define the contract

## What Runtime Kernel is NOT

- ❌ Not a trading engine (trading logic is in Trading Core)
- ❌ Not a UI framework (UI is the client's responsibility)
- ❌ Not a data store (EventStore is one service, not the platform)
- ❌ Not a replacement for backend microservices
