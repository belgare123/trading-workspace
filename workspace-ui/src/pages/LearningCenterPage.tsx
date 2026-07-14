import { useState } from 'react'
import type { ReactNode } from 'react'

/* ── Data types ── */

interface Section {
  id: string
  label: string
  icon: string
  content: () => ReactNode
}

/* ── Content ── */

const sections: Section[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '🏗️',
    content: () => (
      <div className="space-y-6">
        <SectionBlock
          title="Platform Architecture"
          body={
            <>
              <p className="text-surface-700 leading-relaxed">
                Trading Workspace is a modular event-driven trading platform built around
                a <strong className="text-surface-500">persisted event store</strong>.
                Every market tick, signal, and system event is recorded as an immutable
                event in the journal, enabling full replay, traceability, and post-hoc
                analysis.
              </p>
            </>
          }
        />
        <SectionBlock
          title="Core Concepts"
          body={
            <div className="space-y-3">
              <ConceptRow
                term="Event Store"
                def="Append-only journal of all system events. Each event carries a correlation_id linking related events."
              />
              <ConceptRow
                term="Trace"
                def="A directed acyclic graph (DAG) of events derived from a correlation_id or event_id. Visualised as a flow chart in the Inspector."
              />
              <ConceptRow
                term="Strategy"
                def="A parameterised algorithm that consumes market data, applies logic, and produces signals. Strategies are pluggable and hot-reloadable."
              />
              <ConceptRow
                term="Plugin"
                def="Self-contained packages (strategies, indicators, features) distributed via the Plugin Store with versioned releases and dependency management."
              />
              <ConceptRow
                term="Scanner"
                def="Real-time market screener that analyses multiple symbols simultaneously and surfaces high-probability setups based on configurable criteria."
              />
            </div>
          }
        />
        <SectionBlock
          title="System Flow"
          body={
            <div className="bg-surface-100 border border-border rounded p-4 font-mono text-sm text-surface-600 leading-relaxed">
              Market Data ─▶ Event Store ─▶ Strategy Engine ─▶ Signal Bus ─▶ Executor<br />
               &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│<br />
               &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──▶ Inspector (Trace Graph)<br />
               &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──▶ Replay Studio
            </div>
          }
        />
      </div>
    ),
  },
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: '🚀',
    content: () => (
      <div className="space-y-6">
        <SectionBlock
          title="Quick Start"
          body={
            <div className="space-y-4">
              <Step number={1} text="Open the <strong>Scanner</strong> (🔍) to see live market signals across 15+ pairs." />
              <Step number={2} text="Click a symbol row to open the <strong>Inspector</strong> (🔬) — view event flow and trace graph." />
              <Step number={3} text="Review past signals with the <strong>Replay Studio</strong> (▶️) — backtest and step through event timelines." />
              <Step number={4} text="Visit the <strong>Plugin Store</strong> (🧩) to install strategies, indicators, and features." />
              <Step number={5} text="Create and edit strategies in the <strong>Strategies</strong> (🧠) panel." />
            </div>
          }
        />
        <SectionBlock
          title="Navigation Guide"
          body={
            <div className="grid grid-cols-2 gap-3">
              <NavCard icon="🔍" label="Scanner" desc="Live market screener" />
              <NavCard icon="🎯" label="Opportunities" desc="Curated trading ops" />
              <NavCard icon="🧠" label="Strategies" desc="Create & backtest" />
              <NavCard icon="▶️" label="Replay Studio" desc="Event timeline replay" />
              <NavCard icon="🔬" label="Inspector" desc="Event trace viewer" />
              <NavCard icon="🧩" label="Plugin Store" desc="Package manager" />
              <NavCard icon="🤖" label="Learning" desc="This guide" />
              <NavCard icon="📊" label="System" desc="System monitor" />
            </div>
          }
        />
      </div>
    ),
  },
  {
    id: 'strategies',
    label: 'Strategies',
    icon: '🧠',
    content: () => (
      <div className="space-y-6">
        <SectionBlock
          title="Strategy System"
          body={
            <p className="text-surface-700 leading-relaxed">
              Strategies are the core logic units of the platform. Each strategy consumes
              market data events, applies a configurable algorithm, and emits signal events
              that can trigger trades. Strategies are implemented as Python classes and
              can be hot-reloaded without restarting the engine.
            </p>
          }
        />
        <SectionBlock
          title="Creating a Strategy"
          body={
            <div className="space-y-4">
              <p className="text-surface-700">A minimal strategy skeleton:</p>
              <CodeBlock
                code={`from core.strategy import BaseStrategy\nfrom core.events import SignalEvent\n\nclass MyStrategy(BaseStrategy):\n    async def on_tick(self, tick):\n        if tick.price > self.params.threshold:\n            await self.emit(SignalEvent(\n                symbol=tick.symbol,\n                direction="long",\n                confidence=0.85,\n            ))`}
              />
              <p className="text-surface-700">
                Strategies can be parameterised via the UI and tested in the
                Replay Studio before going live.
              </p>
            </div>
          }
        />
        <SectionBlock
          title="Strategy Lifecycle"
          body={
            <div className="space-y-2">
              <LifecycleStep stage="Draft" desc="Created in the Strategy panel, not yet running" />
              <LifecycleStep stage="Backtest" desc="Run against historical data in Replay Studio" />
              <LifecycleStep stage="Paper" desc="Simulated execution with live market data" />
              <LifecycleStep stage="Live" desc="Real execution with capital at risk" />
              <LifecycleStep stage="Archived" desc="Deactivated and stored for reference" />
            </div>
          }
        />
      </div>
    ),
  },
  {
    id: 'inspector',
    label: 'Inspector & Events',
    icon: '🔬',
    content: () => (
      <div className="space-y-6">
        <SectionBlock
          title="Event System"
          body={
            <p className="text-surface-700 leading-relaxed">
              Every action in the platform — from receiving a market tick to emitting a
              signal — is captured as an event in the <strong className="text-surface-500">Event Store</strong>.
              Events are immutable, ordered, and linked via <code className="text-primary-400 bg-surface-100 px-1 rounded">correlation_id</code>.
            </p>
          }
        />
        <SectionBlock
          title="Trace Viewer"
          body={
            <div className="space-y-3">
              <p className="text-surface-700">
                The Inspector displays a <strong className="text-surface-500">Trace Graph</strong> —
                a visual DAG of related events. Traces are built by following
                <code className="text-primary-400 bg-surface-100 px-1 rounded">correlation_id</code> chains.
              </p>
              <p className="text-surface-600 text-sm">Key interaction patterns:</p>
              <ul className="list-disc list-inside space-y-1 text-surface-700 text-sm">
                <li>Click an event node to see its payload</li>
                <li>Drag to pan, scroll to zoom</li>
                <li>Hover edges to see the event type transition</li>
                <li>Right-click to copy correlation_id</li>
              </ul>
            </div>
          }
        />
      </div>
    ),
  },
  {
    id: 'replay',
    label: 'Replay Studio',
    icon: '▶️',
    content: () => (
      <div className="space-y-6">
        <SectionBlock
          title="Replay Studio"
          body={
            <p className="text-surface-700 leading-relaxed">
              The Replay Studio lets you step through historical event data as if it were
              happening live. Use it to backtest strategies, debug signal logic, and
              understand market behaviour.
            </p>
          }
        />
        <SectionBlock
          title="Controls"
          body={
            <div className="grid grid-cols-2 gap-3">
              <FeatureCard icon="⏪" label="Skip Back" desc="Jump to start" />
              <FeatureCard icon="⏮" label="Step Back" desc="Previous event" />
              <FeatureCard icon="▶️" label="Play / Pause" desc="Replay at configurable speed" />
              <FeatureCard icon="⏭" label="Step Forward" desc="Next event" />
              <FeatureCard icon="⏩" label="Skip Forward" desc="Jump to end" />
              <FeatureCard icon="🎯" label="Bookmarks" desc="Mark points of interest" />
            </div>
          }
        />
        <SectionBlock
          title="Use Cases"
          body={
            <ul className="list-disc list-inside space-y-1 text-surface-700 text-sm">
              <li>Verify a strategy's signal logic against historical data</li>
              <li>Debug unexpected behaviour by stepping through events</li>
              <li>Compare strategy variants side-by-side</li>
              <li>Generate trace graphs for post-hoc analysis</li>
              <li>Export replay timelines for sharing</li>
            </ul>
          }
        />
      </div>
    ),
  },
  {
    id: 'plugins',
    label: 'Plugin Store',
    icon: '🧩',
    content: () => (
      <div className="space-y-6">
        <SectionBlock
          title="Package Manager"
          body={
            <p className="text-surface-700 leading-relaxed">
              The Plugin Store is a full package manager — not a catalogue. Every package
              has versioned releases, dependency declarations, compatibility reports, and
              trust-level verification.
            </p>
          }
        />
        <SectionBlock title="Trust Levels" body={<TrustLevelsTable />} />
        <SectionBlock
          title="Installation"
          body={
            <div className="space-y-3">
              <p className="text-surface-700">To install a package:</p>
              <ol className="list-decimal list-inside space-y-1 text-surface-700 text-sm">
                <li>Browse or search for a package in the Plugin Store</li>
                <li>Click the package to view its detail panel</li>
                <li>Review compatibility, dependencies, and benchmarks</li>
                <li>Click <strong>Install</strong> — the engine hot-loads it instantly</li>
              </ol>
              <p className="text-surface-600 text-sm mt-2">
                Updates are shown in the <strong>Updates</strong> tab. Installed packages
                can be updated individually or with <strong>Update All</strong>.
              </p>
            </div>
          }
        />
      </div>
    ),
  },
  {
    id: 'glossary',
    label: 'Glossary',
    icon: '📖',
    content: () => (
      <div className="space-y-6">
        <SectionBlock
          title="Trading Terms"
          body={
            <div className="divide-y divide-border">
              <GlossaryEntry term="Correlation ID" def="A UUID that links related events across the system. All events triggered by the same market tick share a correlation_id." />
              <GlossaryEntry term="Order Block" def="A price zone where institutional orders have been placed, often acting as support or resistance." />
              <GlossaryEntry term="FVG (Fair Value Gap)" def="A three-candle pattern where the wicks of consecutive candles leave a gap not fully filled, indicating imbalance." />
              <GlossaryEntry term="Liquidity Sweep" def="A price move that takes out a cluster of stop-losses or pending orders before reversing." />
              <GlossaryEntry term="Order Flow" def="Analysis based on actual trade data (volume, delta, cumulative delta) rather than price alone." />
              <GlossaryEntry term="Smart Money" def="Institutions and professional traders whose large orders drive market structure." />
              <GlossaryEntry term="Backtesting" def="Evaluating a strategy against historical data to assess its performance before going live." />
              <GlossaryEntry term="WebSocket" def="A persistent connection used by the Scanner to stream real-time signals from the backend." />
            </div>
          }
        />
      </div>
    ),
  },
]

/* ── Sub-components ── */

function SectionBlock({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-surface-500 mb-2">{title}</h3>
      {body}
    </div>
  )
}

function ConceptRow({ term, def }: { term: string; def: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-primary-400 text-sm font-semibold shrink-0 min-w-[100px]">{term}</span>
      <span className="text-surface-700 text-sm leading-relaxed">{def}</span>
    </div>
  )
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold shrink-0 mt-0.5">
        {number}
      </span>
      <span className="text-surface-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  )
}

function NavCard({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 bg-surface-100 border border-border rounded-lg p-3">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xs font-medium text-surface-500">{label}</div>
        <div className="text-xs text-surface-600">{desc}</div>
      </div>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-surface-100 border border-border rounded-lg p-4 text-sm text-surface-600 font-mono leading-relaxed overflow-x-auto">
      <code>{code}</code>
    </pre>
  )
}

function LifecycleStep({ stage, desc }: { stage: string; desc: string }) {
  const colors: Record<string, string> = {
    Draft: 'bg-surface-400 text-surface-700',
    Backtest: 'bg-accent-cyan/20 text-accent-cyan',
    Paper: 'bg-accent-yellow/20 text-accent-yellow',
    Live: 'bg-accent-green/20 text-accent-green',
    Archived: 'bg-surface-400 text-surface-600',
  }
  return (
    <div className="flex items-center gap-3">
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[stage] || 'bg-surface-400 text-surface-700'}`}>
        {stage}
      </span>
      <span className="text-surface-700 text-sm">{desc}</span>
    </div>
  )
}

function FeatureCard({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 bg-surface-100 border border-border rounded-lg p-3">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xs font-medium text-surface-500">{label}</div>
        <div className="text-xs text-surface-600">{desc}</div>
      </div>
    </div>
  )
}

function TrustLevelsTable() {
  const levels = [
    { trust: '💎 Official', desc: 'First-party packages by Trading Workspace' },
    { trust: '✓ Verified', desc: 'Third-party, code-reviewed and signed' },
    { trust: '👥 Community', desc: 'Community-contributed, basic checks passed' },
    { trust: '🧪 Experimental', desc: 'Early-stage, may be unstable' },
    { trust: '⚠ Untrusted', desc: 'No verification, use at your own risk' },
    { trust: '☠ Unsafe', desc: 'Flagged for policy violations' },
  ]
  return (
    <div className="space-y-1">
      {levels.map((l) => (
        <div key={l.trust} className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-surface-500 w-28 shrink-0">{l.trust}</span>
          <span className="text-surface-700">{l.desc}</span>
        </div>
      ))}
    </div>
  )
}

function GlossaryEntry({ term, def }: { term: string; def: string }) {
  return (
    <div className="py-3">
      <dt className="text-sm font-semibold text-surface-500 mb-1">{term}</dt>
      <dd className="text-sm text-surface-700 leading-relaxed">{def}</dd>
    </div>
  )
}

/* ── Main Page ── */

export default function LearningCenterPage() {
  const [activeSection, setActiveSection] = useState('overview')

  const section = sections.find((s) => s.id === activeSection)

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <div className="w-48 shrink-0 bg-surface-100 border-r border-border overflow-y-auto">
        <nav className="p-2 space-y-1">
          {sections.map((s) => {
            const isActive = s.id === activeSection
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-surface-600 hover:bg-surface-300 hover:text-surface-500'
                }`}
              >
                <span className="text-base">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {section && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <span className="text-2xl">{section.icon}</span>
              <h2 className="text-lg font-bold text-surface-500">{section.label}</h2>
            </div>
            <section.content />
          </div>
        )}
      </div>
    </div>
  )
}
