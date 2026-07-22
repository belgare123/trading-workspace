// ── TradingComposition — Composition Root for Trading Workspace ──
// Sprint 5.4 — Workspace Composition & Lifecycle
//
// Architecture:
//   TradingComposition
//   ├── config           TradingConfig
//   ├── runtimeFactory   RuntimeFactory  → creates runtime instances
//   ├── dependencyGraph  DependencyGraph → startup/shutdown ordering
//   ├── lifecycleManager LifecycleManager → FSM
//   └── workspace        Workspace       → facade over all runtimes

import type { TradingConfig, RecoveryReport, WorkspaceHealth, RuntimeId } from './types'
import { LIFECYCLE_STATES } from './types'
import { LifecycleManager } from './LifecycleManager'
import { StartupRecoveryRuntime, type StartupRecoveryDeps } from './StartupRecoveryRuntime'
import { Workspace } from './WorkspaceBuilder'

// ════════════════════════════════════════
// RuntimeFactory — creates runtime instances
// ════════════════════════════════════════

export class RuntimeFactory {
  private readonly creators = new Map<RuntimeId, () => unknown>()

  register(id: RuntimeId, factory: () => unknown): this {
    this.creators.set(id, factory)
    return this
  }

  create<T>(id: RuntimeId): T | undefined {
    const factory = this.creators.get(id)
    if (!factory) return undefined
    return factory() as T
  }

  has(id: RuntimeId): boolean {
    return this.creators.has(id)
  }

  get registered(): RuntimeId[] {
    return [...this.creators.keys()]
  }
}

// ════════════════════════════════════════
// DependencyGraph — runtime startup/shutdown ordering
// ════════════════════════════════════════

export interface RuntimeDependencyEdge {
  from: RuntimeId
  to: RuntimeId // 'from' must start before 'to'
}

export class DependencyGraph {
  private readonly dependencies: RuntimeDependencyEdge[] = []

  add(from: RuntimeId, to: RuntimeId): this {
    this.dependencies.push({ from, to })
    return this
  }

  /** Topological sort: startup order (dependencies first) */
  startupOrder(): RuntimeId[] {
    const visited = new Set<RuntimeId>()
    const order: RuntimeId[] = []
    const visiting = new Set<RuntimeId>()

    const all = new Set<RuntimeId>()
    for (const dep of this.dependencies) {
      all.add(dep.from)
      all.add(dep.to)
    }

    const adjacency = new Map<RuntimeId, RuntimeId[]>()
    for (const dep of this.dependencies) {
      const list = adjacency.get(dep.from) ?? []
      list.push(dep.to)
      adjacency.set(dep.from, list)
    }

    function visit(id: RuntimeId): void {
      if (visited.has(id)) return
      if (visiting.has(id)) {
        console.warn(`[DependencyGraph] Cycle detected at "${id}" — using partial order`)
        return
      }
      visiting.add(id)
      const deps = adjacency.get(id) ?? []
      for (const dep of deps) {
        visit(dep)
      }
      visiting.delete(id)
      visited.add(id)
      order.push(id)
    }

    for (const id of all) {
      if (!visited.has(id)) visit(id)
    }
    return order.reverse()
  }

  /** Reverse startup order for graceful shutdown */
  shutdownOrder(): RuntimeId[] {
      return [...this.startupOrder()].reverse()
  }
}

// ════════════════════════════════════════
// TradingComposition
// ════════════════════════════════════════

export class TradingComposition {
  readonly config: TradingConfig
  readonly runtimeFactory: RuntimeFactory
  readonly dependencyGraph: DependencyGraph
  readonly lifecycleManager: LifecycleManager
  readonly workspace: Workspace

  constructor(opts: {
    config: TradingConfig
    runtimeFactory: RuntimeFactory
    dependencyGraph: DependencyGraph
    lifecycleManager: LifecycleManager
    workspace: Workspace
  }) {
    this.config = opts.config
    this.runtimeFactory = opts.runtimeFactory
    this.dependencyGraph = opts.dependencyGraph
    this.lifecycleManager = opts.lifecycleManager
    this.workspace = opts.workspace
  }

  // ── Lifecycle ──

  /** Full startup: init → recover → run */
  async start(): Promise<RecoveryReport> {
    return this.workspace.start()
  }

  /** Graceful shutdown */
  async stop(): Promise<void> {
    return this.workspace.stop()
  }

  /** Current health */
  health(): WorkspaceHealth {
    return this.workspace.health()
  }

  /** Startup order plan for diagnostics */
  get startupPlan(): RuntimeId[] {
    return this.dependencyGraph.startupOrder()
  }

  /** Shutdown order plan for diagnostics */
  get shutdownPlan(): RuntimeId[] {
    return this.dependencyGraph.shutdownOrder()
  }
}
