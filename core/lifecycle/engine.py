"""
Lifecycle Engine (Phase 8) — оркестратор жизненного цикла Opportunity.

Координирует работу всех 10 модулей:
  8.1 State Machine
  8.2 Entry Monitor
  8.3 Opportunity Tracker
  8.4 Stop/Target Monitor
  8.5 Lifecycle Events
  8.6 Expiration Engine
  8.7 Opportunity Journal
  8.8 Lifecycle Metrics
  8.9 Position Model
  8.10 Opportunity Bus
  + Opportunity Versioning

Pipeline:
  Decision Engine → LifecycleEngine.process_opportunity()
    ↓
  8.1 → validate_transition()
  8.6 → check_expiration()
  8.2 → check_entry()
  8.4 → check_stop_target()
  8.3 → update_tracker()
  8.7 → journal.record()
  8.5 + 8.10 → bus.publish()
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from core.lifecycle.models import (
    JournalEntry,
    LifecycleMetrics,
    OpportunityState,
    Position,
    Trade,
)
from core.lifecycle.state_machine import StateMachine, TransitionError
from core.lifecycle.entry_monitor import EntryMonitor, EntryStatus
from core.lifecycle.tracker import OpportunityTracker
from core.lifecycle.stop_target import StopTargetConfig, StopTargetMonitor, StopTargetEvent
from core.lifecycle.events import LifecycleEvent, LifecycleEventType
from core.lifecycle.expiration import ExpirationEngine
from core.lifecycle.journal import OpportunityJournal
from core.lifecycle.metrics import FinalMetrics, MetricsCalculator
from core.event_store import EventStore
from core.event_store.sqlite_repo import SQLiteEventRepository
from core.lifecycle.bus import OpportunityBus
from core.lifecycle.versioning import VersionTracker

logger = logging.getLogger(__name__)


@dataclass
class LifecycleContext:
    """Контекст выполнения Lifecycle Engine для одной Opportunity.

    Хранит всё состояние, необходимое для управления жизненным циклом.
    """
    opportunity_id: str
    symbol: str
    direction: str
    entry_price: float
    stop_loss: float | None = None
    targets: list[float] = field(default_factory=list)
    confidence: float = 0.0
    current_state: OpportunityState = OpportunityState.CREATED
    created_at: float = 0.0
    validated_at: float = 0.0
    waiting_entry_at: float = 0.0
    activated_at: float = 0.0
    closed_at: float = 0.0
    position: Position | None = None
    trade: Trade | None = None
    metrics: LifecycleMetrics | None = None
    final_metrics: FinalMetrics | None = None
    current_price: float = 0.0
    state_entered_at: float = 0.0  # когда вошли в текущее состояние
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def is_alive(self) -> bool:
        return self.current_state in OpportunityState.active_set()

    @property
    def is_closed(self) -> bool:
        return self.current_state in OpportunityState.terminal_set()

    def to_dict(self) -> dict[str, Any]:
        return {
            "opportunity_id": self.opportunity_id,
            "symbol": self.symbol,
            "direction": self.direction,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "targets": self.targets,
            "confidence": self.confidence,
            "current_state": self.current_state.value,
            "is_alive": self.is_alive,
            "is_closed": self.is_closed,
            "created_at": self.created_at,
            "position": self.position.to_dict() if self.position else None,
            "metrics": self.metrics.to_dict() if self.metrics else None,
        }


@dataclass
class LifecycleResult:
    """Результат выполнения LifecycleEngine.update()."""
    context: LifecycleContext
    state_changed: bool = False
    entry_reached: bool = False
    target_hit: bool = False
    stop_hit: bool = False
    expired: bool = False
    events: list[LifecycleEvent] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "state_changed": self.state_changed,
            "entry_reached": self.entry_reached,
            "target_hit": self.target_hit,
            "stop_hit": self.stop_hit,
            "expired": self.expired,
            "context": self.context.to_dict(),
            "events": [e.to_dict() for e in self.events],
        }


class LifecycleEngine:
    """Оркестратор жизненного цикла торговой идеи.

    Usage:
        engine = LifecycleEngine()
        ctx = engine.create_opportunity(
            opportunity_id="opp_123",
            symbol="BTCUSDT",
            direction="long",
            entry_price=64500.0,
            stop_loss=64000.0,
            targets=[65000.0],
            confidence=0.75,
        )
        # На каждом тике:
        result = engine.update(ctx, current_price=64700.0)
    """

    def __init__(
        self,
        state_machine: StateMachine | None = None,
        entry_monitor: EntryMonitor | None = None,
        tracker: OpportunityTracker | None = None,
        stop_target: StopTargetConfig | None = None,
        expiration: ExpirationEngine | None = None,
        journal: OpportunityJournal | None = None,
        metrics: MetricsCalculator | None = None,
        bus: OpportunityBus | None = None,
        versioning: VersionTracker | None = None,
    ) -> None:
        self.state_machine = state_machine or StateMachine()
        self.entry_monitor = entry_monitor or EntryMonitor()
        self.tracker = OpportunityTracker()
        self.stop_config = stop_target or StopTargetConfig()
        self.stop_monitor = StopTargetMonitor(self.stop_config)
        self.expiration = expiration or ExpirationEngine()
        self.journal = journal or OpportunityJournal()
        self.metrics = metrics or MetricsCalculator()
        self.bus = bus or OpportunityBus(
            event_store=EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        )
        self.versioning = versioning or VersionTracker()

    # ── Lifecycle: Create ──

    def create_opportunity(
        self,
        opportunity_id: str,
        symbol: str,
        direction: str,
        entry_price: float,
        stop_loss: float | None = None,
        targets: list[float] | None = None,
        confidence: float = 0.0,
    ) -> LifecycleContext:
        """Создать новый контекст жизненного цикла.

        Args:
            opportunity_id: Уникальный ID.
            symbol:         Тикер.
            direction:      "long" или "short".
            entry_price:    Цена входа.
            stop_loss:      Стоп-лосс.
            targets:        Целевые уровни.
            confidence:     Уверенность.

        Returns:
            LifecycleContext.
        """
        now = time.time()
        ctx = LifecycleContext(
            opportunity_id=opportunity_id,
            symbol=symbol,
            direction=direction,
            entry_price=entry_price,
            stop_loss=stop_loss,
            targets=targets or [],
            confidence=confidence,
            current_state=OpportunityState.CREATED,
            created_at=now,
            state_entered_at=now,
        )

        # Journal
        self.journal.record("created", opportunity_id, {
            "symbol": symbol,
            "direction": direction,
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "confidence": confidence,
        })

        # Versioning
        self.versioning.snapshot(
            opportunity_id=opportunity_id,
            state=OpportunityState.CREATED,
            direction=direction,
            entry_price=entry_price,
            stop_loss=stop_loss,
            targets=ctx.targets,
            confidence=confidence,
            reason="Opportunity created",
        )

        # Bus
        self.bus.publish(LifecycleEvent(
            type=LifecycleEventType.OPPORTUNITY_CREATED,
            opportunity_id=opportunity_id,
            state=OpportunityState.CREATED,
            data=ctx.to_dict(),
        ))

        return ctx

    # ── Lifecycle: Transition ──

    def transition_to(
        self,
        ctx: LifecycleContext,
        new_state: OpportunityState,
        reason: str = "",
    ) -> None:
        """Перевести Opportunity в новое состояние.

        Args:
            ctx:       LifecycleContext.
            new_state: Целевое состояние.
            reason:    Причина перехода.

        Raises:
            TransitionError: Если переход не разрешён.
        """
        old_state = ctx.current_state
        self.state_machine.validate(old_state, new_state)

        now = time.time()
        ctx.current_state = new_state
        ctx.state_entered_at = now

        # Обновляем тайминги
        state_timestamps = {
            OpportunityState.VALIDATED: "validated_at",
            OpportunityState.WAITING_ENTRY: "waiting_entry_at",
            OpportunityState.ACTIVE: "activated_at",
        }
        attr = state_timestamps.get(new_state)
        if attr:
            setattr(ctx, attr, now)

        if new_state in OpportunityState.terminal_set():
            ctx.closed_at = now

        # Journal
        self.journal.record(
            f"state:{old_state.value}→{new_state.value}",
            ctx.opportunity_id,
            {"reason": reason, "old_state": old_state.value},
        )

        # Versioning
        changes = {"state": (old_state.value, new_state.value)}
        self.versioning.snapshot(
            opportunity_id=ctx.opportunity_id,
            state=new_state,
            direction=ctx.direction,
            entry_price=ctx.entry_price,
            stop_loss=ctx.stop_loss,
            targets=ctx.targets,
            confidence=ctx.confidence,
            reason=reason,
            changes=changes,
        )

        logger.info(
            "Opportunity %s: %s → %s (%s)",
            ctx.opportunity_id[:8],
            old_state.value,
            new_state.value,
            reason,
        )

    # ── Lifecycle: Update (main tick) ──

    def update(
        self,
        ctx: LifecycleContext,
        current_price: float,
    ) -> LifecycleResult:
        """Обновить состояние жизненного цикла на текущем тике.

        Выполняет полный цикл проверок:
          1. Expiration (8.6)
          2. Entry Monitor (8.2)
          3. Stop/Target (8.4)
          4. Tracker (8.3)
          5. Metrics (8.8)
          6. Events (8.5 + 8.10)

        Args:
            ctx:           LifecycleContext.
            current_price: Текущая цена.

        Returns:
            LifecycleResult.
        """
        result = LifecycleResult(context=ctx)
        now = time.time()
        ctx.current_price = current_price

        # ── 1. Expiration check ──
        expired = self.expiration.check(
            state=ctx.current_state,
            entered_at=ctx.state_entered_at,
            now=now,
        )
        if expired and ctx.current_state not in OpportunityState.terminal_set():
            self.transition_to(ctx, OpportunityState.EXPIRED, "TTL expired")
            result.expired = True
            result.state_changed = True
            event = LifecycleEvent(
                type=LifecycleEventType.OPPORTUNITY_EXPIRED,
                opportunity_id=ctx.opportunity_id,
                state=OpportunityState.EXPIRED,
                data=ctx.to_dict(),
            )
            result.events.append(event)
            self.bus.publish(event)
            return result

        # Если терминальное — больше ничего не делаем
        if ctx.is_closed:
            return result

        # ── 2. Entry Monitor ──
        if ctx.current_state in (OpportunityState.VALIDATED, OpportunityState.WAITING_ENTRY):
            entry_result = self.entry_monitor.check(
                current_price=current_price,
                entry_price=ctx.entry_price,
                direction=ctx.direction,
            )

            if entry_result.status == EntryStatus.ENTERED:
                # Создаём позицию
                pos = Position(
                    opportunity_id=ctx.opportunity_id,
                    symbol=ctx.symbol,
                    direction=ctx.direction,
                    entry_price=current_price,
                    stop_loss=ctx.stop_loss,
                    targets=list(ctx.targets),
                    opened_at=now,
                )
                ctx.position = pos

                self.transition_to(
                    ctx, OpportunityState.ACTIVE,
                    f"Entry reached at {current_price}",
                )
                result.entry_reached = True
                result.state_changed = True

                event = LifecycleEvent(
                    type=LifecycleEventType.OPPORTUNITY_ACTIVATED,
                    opportunity_id=ctx.opportunity_id,
                    state=OpportunityState.ACTIVE,
                    position=pos,
                    data={"entry_price": current_price},
                )
                result.events.append(event)
                self.bus.publish(event)

                # Position opened event
                pos_event = LifecycleEvent(
                    type=LifecycleEventType.POSITION_OPENED,
                    opportunity_id=ctx.opportunity_id,
                    state=OpportunityState.ACTIVE,
                    position=pos,
                )
                result.events.append(pos_event)
                self.bus.publish(pos_event)

            elif entry_result.status == EntryStatus.MISSED:
                if ctx.current_state == OpportunityState.VALIDATED:
                    self.transition_to(ctx, OpportunityState.WAITING_ENTRY, "Price not at entry")
                    result.state_changed = True

            return result

        # ── 3. Stop/Target Monitor ──
        if ctx.current_state == OpportunityState.ACTIVE and ctx.position:
            st_result = self.stop_monitor.check(
                position=ctx.position,
                current_price=current_price,
            )

            if st_result.is_closed:
                # Позиция закрыта
                if st_result.event == StopTargetEvent.STOP_HIT:
                    self.transition_to(ctx, OpportunityState.STOPPED, st_result.message)
                    result.stop_hit = True
                elif st_result.event == StopTargetEvent.FULL_TARGET:
                    self.transition_to(ctx, OpportunityState.FULL_TARGET, st_result.message)
                    result.target_hit = True

                result.state_changed = True

                # Trade
                trade = self._create_trade(ctx, current_price, st_result)
                ctx.trade = trade

                # Bus events
                for event in self._create_close_events(ctx, current_price, st_result):
                    result.events.append(event)
                    self.bus.publish(event)

                # Final metrics
                ctx.final_metrics = self.metrics.calculate(
                    position=ctx.position,
                    trade=trade,
                    created_at=ctx.created_at,
                    activated_at=ctx.activated_at,
                    current_metrics=ctx.metrics,
                )

            elif st_result.event in (StopTargetEvent.TARGET_1_HIT, StopTargetEvent.TARGET_2_HIT, StopTargetEvent.TARGET_3_HIT):
                # Partial target
                old_state = ctx.current_state
                ctx.current_state = OpportunityState.PARTIAL_TARGET
                self.journal.record(
                    f"target:{st_result.event.value}",
                    ctx.opportunity_id,
                    {"current_price": current_price, "hit": st_result.targets_hit},
                )

                event = LifecycleEvent(
                    type=LifecycleEventType.OPPORTUNITY_TARGET,
                    opportunity_id=ctx.opportunity_id,
                    state=OpportunityState.PARTIAL_TARGET,
                    position=ctx.position,
                    data={"targets_hit": st_result.targets_hit},
                )
                result.events.append(event)
                self.bus.publish(event)

            elif st_result.event in (StopTargetEvent.BREAK_EVEN_ACTIVATED, StopTargetEvent.TRAILING_ACTIVATED):
                # Stop updated
                self.journal.record(
                    f"stop_updated:{st_result.event.value}",
                    ctx.opportunity_id,
                    {"old_stop": ctx.position.stop_loss, "new_stop": st_result.updated_stop},
                )

        # ── 4. Position tracker ──
        if ctx.position and ctx.position.is_open:
            ctx.metrics = self.tracker.update(
                position=ctx.position,
                current_price=current_price,
            )
            metrics_event = LifecycleEvent(
                type=LifecycleEventType.METRICS_UPDATED,
                opportunity_id=ctx.opportunity_id,
                state=ctx.current_state,
                position=ctx.position,
                metrics=ctx.metrics,
            )
            result.events.append(metrics_event)

        return result

    def _create_trade(
        self,
        ctx: LifecycleContext,
        current_price: float,
        st_result: Any,
    ) -> Trade:
        """Создать Trade из контекста и результата Stop/Target."""
        pos = ctx.position
        if not pos:
            raise ValueError("Cannot create trade without position")

        direction = ctx.direction
        entry = pos.entry_price

        # Exit price
        if st_result.is_closed:
            exit_price = st_result.triggered_level or current_price
        else:
            exit_price = current_price

        # PnL
        if direction == "long":
            pnl_pct = (exit_price - entry) / entry * 100
        else:
            pnl_pct = (entry - exit_price) / entry * 100

        pnl_abs = pnl_pct * pos.size / 100 if pos.size > 0 else pnl_pct

        # RR
        risk = abs(entry - (pos.stop_loss or entry)) / entry if pos.stop_loss else 1.0
        rr = abs(exit_price - entry) / (entry * risk) if risk > 0 else 0.0

        reason = "stop_loss" if st_result.event == StopTargetEvent.STOP_HIT else "full_target"

        return Trade(
            position_id=pos.id,
            opportunity_id=ctx.opportunity_id,
            symbol=ctx.symbol,
            direction=direction,
            entry_price=entry,
            exit_price=exit_price,
            size=pos.size,
            pnl=pnl_abs,
            pnl_pct=pnl_pct,
            rr=rr,
            reason=reason,
            holding_time=pos.holding_time,
            mfe=ctx.metrics.mfe if ctx.metrics else 0.0,
            mae=ctx.metrics.mae if ctx.metrics else 0.0,
            opened_at=pos.opened_at,
            closed_at=time.time(),
            meta={"targets_hit": st_result.targets_hit},
        )

    def _create_close_events(
        self,
        ctx: LifecycleContext,
        current_price: float,
        st_result: Any,
    ) -> list[LifecycleEvent]:
        events = []

        if st_result.event == StopTargetEvent.STOP_HIT:
            events.append(LifecycleEvent(
                type=LifecycleEventType.OPPORTUNITY_STOPPED,
                opportunity_id=ctx.opportunity_id,
                state=OpportunityState.STOPPED,
                position=ctx.position,
                data={"triggered_level": st_result.triggered_level},
            ))
        elif st_result.event == StopTargetEvent.FULL_TARGET:
            events.append(LifecycleEvent(
                type=LifecycleEventType.OPPORTUNITY_ARCHIVED,
                opportunity_id=ctx.opportunity_id,
                state=OpportunityState.ARCHIVED,
                position=ctx.position,
                data={"triggered_level": st_result.triggered_level},
            ))

        # Trade closed event
        trade = ctx.trade
        if trade:
            events.append(LifecycleEvent(
                type=LifecycleEventType.TRADE_CLOSED,
                opportunity_id=ctx.opportunity_id,
                state=ctx.current_state,
                trade=trade,
            ))

        return events
