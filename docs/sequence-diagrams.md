# Trading Workspace — Signal Lifecycle Sequence Diagrams

## 1. End-to-End Signal Flow

```
Exchange                    FeatureEngine               Strategy                    DecisionEngine              LifecycleEngine             Dashboard
    │                            │                          │                              │                          │                            │
    │  WS Stream (ticks)         │                          │                              │                          │                            │
    │───────────────────────────▶│                          │                              │                          │                            │
    │                            │  Compute indicators      │                              │                          │                            │
    │                            │  (RSI, EMA, ATR, ...)    │                              │                          │                            │
    │                            │──────────┐               │                              │                          │                            │
    │                            │          │               │                              │                          │                            │
    │                            │◀─────────┘               │                              │                          │                            │
    │                            │  New Candle              │                              │                          │                            │
    │                            │─────────────────────────▶│                              │                          │                            │
    │                            │                          │  analyze()                   │                          │                            │
    │                            │                          │──────────┐                   │                          │                            │
    │                            │                          │          │                   │                          │                            │
    │                            │                          │◀─────────┘                   │                          │                            │
    │                            │                          │  SignalBundle                │                          │                            │
    │                            │                          │─────────────────────────────▶│                          │                            │
    │                            │                          │                              │  process()               │                            │
    │                            │                          │                              │  (consensus +            │                            │
    │                            │                          │                              │   confidence +           │                            │
    │                            │                          │                              │   policy +               │                            │
    │                            │                          │                              │   opportunity)           │                            │
    │                            │                          │                              │──────────┐               │                            │
    │                            │                          │                              │          │               │                            │
    │                            │                          │                              │◀─────────┘               │                            │
    │                            │                          │                              │  Opportunity(s)          │                            │
    │                            │                          │                              │─────────────────────────▶│                            │
    │                            │                          │                              │                          │  create_opportunity()     │
    │                            │                          │                              │                          │──────────┐                │
    │                            │                          │                              │                          │          │                │
    │                            │                          │                              │                          │◀─────────┘                │
    │                            │                          │                              │                          │  OpportunityEvent         │
    │                            │                          │                              │                          │─────────────────────────▶│
    │                            │                          │                              │                          │                          │ WebSocket push
    │                            │                          │                              │                          │                          │──────────┐
    │                            │                          │                              │                          │                          │          │
    │                            │                          │                              │                          │                          │◀─────────┘
    │                            │                          │                              │                          │                          │ Display
```

## 2. Decision Engine Internal Flow

```
StrategyEngine              Normalizer              ConsensusEngine         ConfidenceEngine         Policy             OpportunityBuilder
      │                         │                        │                       │                    │                      │
      │  SignalBundle           │                        │                       │                    │                      │
      │────────────────────────▶│                        │                       │                    │                      │
      │                         │  NormalizedSignal      │                       │                    │                      │
      │                         │───────────────────────▶│                       │                    │                      │
      │                         │                        │  ConsensusResult      │                    │                      │
      │                         │                        │──────────────────────▶│                    │                      │
      │                         │                        │                       │  ConfidentSignal    │                      │
      │                         │                        │                       │───────────────────▶│                      │
      │                         │                        │                       │                    │  FilteredSignals     │
      │                         │                        │                       │                    │────────────────────▶│
      │                         │                        │                       │                    │                      │  Opportunity(s)
      │                         │                        │                       │                    │                      │──────────┐
      │                         │                        │                       │                    │                      │          │
      │                         │                        │                       │                    │                      │◀─────────┘
```

## 3. Opportunity Lifecycle States

```
     created
        │
        ▼
    approved ◀──────────────────── rejected
        │
        ▼
    monitored
        │
        ▼
   pending_entry ──── canceled
        │
        ▼
      active ──────── stopped
        │
        ▼
   exit_pending
        │
        ▼
      closed
        │
        ▼
    archived
```

### Transitions

| From | To | Trigger |
|------|----|---------|
| `created` | `approved` | DecisionEngine approves (passes policy + quality gates) |
| `created` | `rejected` | Policy filter or quality check fails |
| `approved` | `monitored` | Opportunity enters wait state |
| `monitored` | `pending_entry` | Entry conditions met |
| `pending_entry` | `canceled` | Entry timeout or conditions invalidated |
| `pending_entry` | `active` | Order filled |
| `active` | `exit_pending` | Exit signal received |
| `active` | `stopped` | Stop-loss hit |
| `exit_pending` | `closed` | Exit order filled |
| `closed` | `archived` | Lifecycle complete |

## 4. Replay Flow

```
Backtest CLI            ReplayEngine            SnapshotEngine          StrategyEngine          DecisionEngine
     │                       │                       │                       │                       │
     │  start_replay()       │                       │                       │                       │
     │──────────────────────▶│                       │                       │                       │
     │                       │  load_snapshot()      │                       │                       │
     │                       │──────────────────────▶│                       │                       │
     │                       │  Snapshot             │                       │                       │
     │                       │◀──────────────────────│                       │                       │
     │                       │                       │                       │                       │
     │                       │  tick() → replay      │                       │                       │
     │                       │  iterate time         │                       │                       │
     │                       │─────────────────────────────────────────────▶│                       │
     │                       │                       │                       │  analyze()             │
     │                       │                       │                       │──────────┐             │
     │                       │                       │                       │          │             │
     │                       │                       │                       │◀─────────┘             │
     │                       │                       │                       │  SignalBundle          │
     │                       │                       │                       │───────────────────────▶│
     │                       │                       │                       │                       │  process()
     │                       │                       │                       │                       │──────────┐
     │                       │                       │                       │                       │          │
     │                       │                       │                       │                       │◀─────────┘
     │                       │                       │                       │                       │  Opportunity
     │  results              │                       │                       │                       │
     │◀──────────────────────│                       │                       │                       │
     │                       │                       │                       │                       │
```

## 5. Quality Engine Assessment

```
DecisionEngine           QualityEngine           ConfidenceEngine           Ranker               Events
     │                       │                       │                       │                    │
     │  Signal               │                       │                       │                    │
     │──────────────────────▶│                       │                       │                    │
     │                       │  12 metrics           │                       │                    │
     │                       │  ────────────         │                       │                    │
     │                       │  consistency ✓        │                       │                    │
     │                       │  timeliness ✓         │                       │                    │
     │                       │  confidence ✓         │                       │                    │
     │                       │  precision ✓          │                       │                    │
     │                       │  completeness ✓       │                       │                    │
     │                       │  relevance ✓          │                       │                    │
     │                       │  originality ✓        │                       │                    │
     │                       │  robustness ✓         │                       │                    │
     │                       │  adaptiveness ✓       │                       │                    │
     │                       │  interpretability ✓   │                       │                    │
     │                       │  efficiency ✓         │                       │                    │
     │                       │  satisfaction ✓       │                       │                    │
     │                       │────────────           │                       │                    │
     │                       │  Score Update          │                       │                    │
     │                       │──────────────────────▶│                       │                    │
     │                       │                       │  Weight Update        │                    │
     │                       │                       │──────────────────────▶│                    │
     │                       │                       │                       │  Ranking Event      │
     │                       │                       │                       │───────────────────▶│
     │                       │                       │                       │                    │  EventBus
     │                       │                       │                       │                    │
```

## 6. Learning Engine Flow

```
FeatureEngine            DatasetBuilder           Classifier             Trainer              WeightUpdater
     │                       │                       │                       │                       │
     │  Features             │                       │                       │                       │
     │──────────────────────▶│                       │                       │                       │
     │                       │  Training Set         │                       │                       │
     │                       │──────────────────────▶│                       │                       │
     │                       │                       │  Predictions          │                       │
     │                       │                       │───────┐               │                       │
     │                       │                       │       │               │                       │
     │                       │                       │◀──────┘               │                       │
     │                       │                       │  Train()              │                       │
     │                       │                       │──────────────────────▶│                       │
     │                       │                       │                       │  Model Update         │
     │                       │                       │                       │──────────────────────▶│
     │                       │                       │                       │                       │  Weight Adjustment
     │                       │                       │                       │                       │───────┐
     │                       │                       │                       │                       │       │
     │                       │                       │                       │                       │◀──────┘
     │                       │                       │                       │                       │
     │                       │                       │                       │                       │  Strategy Weight
     │                       │                       │                       │                       │
```
