# Sprint 3.2 Plan

> Стадия: Phase 3.2 — Dockable Workspace
> Принцип: Platform Expansion — никаких изменений frozen контрактов

## 3.2.1 Layout Engine Foundation ✅
Core: types, factory, registry, engine, serializer, validator, presets.
*Статус: завершён, запушен.*

## 3.2.2 Panel Runtime 🚧 (текущий)
PanelDefinition контракт, PanelContext фасад, PanelRuntime, PanelRegistry, PanelHost/Container/Toolbar/Tabs React-компоненты.
*Задача: слой между Layout Engine и Widget Runtime.*

## 3.2.3 Dock Manager
Drag & drop, split preview, float/maximize/pin UI, docking zones.
*UI-задача: мышь → drag → Dock Preview → LayoutEngine.update() → rerender.*

## 3.2.4 Workspace Commands
Create, duplicate, save, rename, delete, reset, open, export, import.
*UI + команды.*

## 3.2.5 Workspace Persistence UI
Switch workspace, preset selector, sidebar с workspace list.
*UI.*

## 3.2.6 Workspace API
registerPresentation → addPanel — чтобы модули могли объявлять свои панели без знания Layout Engine.
