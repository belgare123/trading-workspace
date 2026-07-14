# 🎉 Trading Platform v1.0.0 — Initial Stable Release

After 16 pre-release cycles, the platform reaches its first stable milestone.

## 🏗️ Platform (core)

- **Event Store**: SQLite-backed persisted event journal, replay, trace graph
- **Aggregate Streams**: versioned event streams with snapshot/restore
- **PluginRegistry**: unified plugin system, capability DAG, strategy lifecycle
- **Replay Engine**: deterministic timeline, recorder, breakpoint debugging
- **Decision Engine**: consensus-based opportunity lifecycle
- **Learning Engine**: regime classification, ML inference pipeline
- **Marketplace**: package registry, dependency resolution, CLI
- **API Freeze**: all 4 public domains frozen

## 🖥️ Workspace UI (React 19 + Vite + Tailwind v4)

Scanner · Inspector · Replay Studio · Strategy Monitor · Plugin Store · Learning Hub · System Monitor · Command Palette · Timeline · Notifications · Federated Search · Layout System

### Workspace SDK

`registerCommand` · `registerSearchAdapter` · `registerPanel` · `pushTimelineEvent`

## 📦 Engineering

- **953+ tests** across all modules
- **Performance Baseline**: 5 metrics (event append, batch, replay, aggregate, trace)
- **Long-running stress**: 12h concurrency, 1M+ events
- **Documentation**: 7 guides + API reference + sequence diagrams + 7 examples
- **License**: MIT

---

### What's next

**Generation 2 — Runtime API**: Workspace becomes a client of the Runtime platform.
