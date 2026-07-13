"""
Decision Engine — центральное ядро скринера (Phase 7).

Предоставляет:
  - 7.1 Signal Normalization (NormalizedSignal)
  - 7.2 Evidence Model (Evidence)
  - 7.3 Consensus Engine
  - 7.4 Conflict Resolver
  - 7.5 Confidence Engine
  - 7.6 Opportunity Builder
  - 7.7 Decision Policy (strict/moderate/aggressive)
  - 7.8 Decision Events (EventBus + DecisionEvent)
  - Strategy Weight Engine (взвешенный консенсус)
"""

from core.decision.confidence import ConfidenceEngine, MarketRegime
from core.decision.consensus import ConsensusEngine
from core.decision.engine import DecisionEngine, DecisionResult
from core.decision.events import (
    DecisionEvent,
    DecisionEventType,
    EventBus,
    EventHandler,
    conflict_detected_event,
    consensus_changed_event,
    decision_taken_event,
    opportunity_created_event,
    opportunity_rejected_event,
)
from core.decision.models import (
    ConflictType,
    ConsensusResult,
    Evidence,
    NormalizedSignal,
    Opportunity,
    OpportunityStatus,
    SignalDirection,
    StrategyWeight,
)
from core.decision.normalizer import NormalizationError, SignalNormalizer
from core.decision.opportunity import OpportunityBuildError, OpportunityBuilder
from core.decision.policy import DecisionPolicy, PolicyConfig, PolicyName, PolicyResult
from core.decision.weighting import StrategyWeightEngine

__all__ = [
    # Models
    "NormalizedSignal",
    "Evidence",
    "SignalDirection",
    "ConflictType",
    "ConsensusResult",
    "Opportunity",
    "OpportunityStatus",
    "StrategyWeight",
    # 7.1 Normalizer
    "SignalNormalizer",
    "NormalizationError",
    # 7.3 + 7.4 Consensus
    "ConsensusEngine",
    # 7.5 Confidence
    "ConfidenceEngine",
    "MarketRegime",
    # 7.6 Builder
    "OpportunityBuilder",
    "OpportunityBuildError",
    # 7.7 Policy
    "DecisionPolicy",
    "PolicyResult",
    "PolicyConfig",
    "PolicyName",
    # 7.8 Events
    "EventBus",
    "DecisionEvent",
    "DecisionEventType",
    "EventHandler",
    "opportunity_created_event",
    "opportunity_rejected_event",
    "conflict_detected_event",
    "consensus_changed_event",
    "decision_taken_event",
    # Weighting
    "StrategyWeightEngine",
    # Engine
    "DecisionEngine",
    "DecisionResult",
]
