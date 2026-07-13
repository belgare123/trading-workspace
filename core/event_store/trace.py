"""
Trace API — распределённая трассировка событий.

Позволяет восстановить полную цепочку событий по correlation_id
или от конкретного event_id, включая parent/children связи.

Архитектура:
    TraceNode — узел графа (событие + parent + children)
    TraceGraph — полный граф цепочки
    TraceBuilder — строит граф из EventStore

Пример::

    trace = await reader.trace(correlation_id)
    trace.root()          # корневое событие
    trace.children(event) # прямые потомки
    trace.timeline()      # хронология
    trace.graph()         # полный граф
    trace.export_json()   # экспорт
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from core.event_store.models import StoredEvent

logger = logging.getLogger(__name__)


# ── TraceNode ──


@dataclass
class TraceNode:
    """Узел трассировочного графа.

    Каждый узел — одно событие в цепочке.
    Связи:
        parent — событие, вызвавшее это (по causation_id)
        children — события, вызванные этим (по causation_id → event_id)
    """

    event: StoredEvent
    parent: TraceNode | None = None
    children: list[TraceNode] = field(default_factory=list)
    depth: int = 0

    @property
    def event_id(self) -> str:
        return self.event.event_id

    @property
    def topic(self) -> str:
        return self.event.topic

    @property
    def aggregate(self) -> str:
        return self.event.aggregate

    @property
    def aggregate_id(self) -> str:
        return self.event.aggregate_id

    @property
    def correlation_id(self) -> str:
        return self.event.correlation_id or ""

    @property
    def causation_id(self) -> str:
        return self.event.causation_id or ""

    @property
    def timestamp(self) -> float:
        return self.event.timestamp

    def to_dict(self, include_children: bool = True) -> dict[str, Any]:
        """Сериализовать узел в dict.

        Args:
            include_children: Включать ли рекурсивно детей.
        """
        result: dict[str, Any] = {
            "event_id": self.event_id,
            "topic": self.topic,
            "aggregate": self.aggregate,
            "aggregate_id": self.aggregate_id,
            "aggregate_version": self.event.aggregate_version,
            "timestamp": self.timestamp,
            "correlation_id": self.correlation_id,
            "causation_id": self.causation_id,
            "depth": self.depth,
        }
        if self.parent:
            result["parent_id"] = self.parent.event_id
        if include_children and self.children:
            result["children"] = [c.to_dict(include_children=True) for c in self.children]
        return result

    def __repr__(self) -> str:
        return (
            f"TraceNode(event_id={self.event_id[:12]}…, "
            f"topic={self.topic}, depth={self.depth}, "
            f"children={len(self.children)})"
        )


# ── TraceGraph ──


@dataclass
class TraceGraph:
    """Полный граф трассировочной цепочки.

    Содержит все узлы цепочки, корень, и методы для навигации.

    Usage::

        trace = await reader.trace(correlation_id)
        trace.root()          # корневое событие
        trace.children(event) # прямые потомки
        trace.timeline()      # хронология
        trace.graph()         # полный граф
        trace.export_json()   # экспорт
    """

    correlation_id: str
    root: TraceNode | None = None
    nodes: dict[str, TraceNode] = field(default_factory=dict)

    # ── Навигация ────────────────────────────────────────────────

    def root_node(self) -> TraceNode | None:
        """Корневое событие цепочки (самое раннее)."""
        return self.root

    def children(self, event_id: str) -> list[TraceNode]:
        """Прямые потомки события."""
        node = self.nodes.get(event_id)
        if node is None:
            return []
        return list(node.children)

    def parent(self, event_id: str) -> TraceNode | None:
        """Родитель события."""
        node = self.nodes.get(event_id)
        if node is None:
            return None
        return node.parent

    def timeline(self) -> list[TraceNode]:
        """Хронология — все узлы, отсортированные по времени."""
        return sorted(self.nodes.values(), key=lambda n: n.timestamp)

    def graph(self) -> dict[str, list[str]]:
        """Граф как словарь смежности.

        Returns:
            {event_id: [child_event_id, ...]}
        """
        adj: dict[str, list[str]] = {}
        for node in self.nodes.values():
            adj[node.event_id] = [c.event_id for c in node.children]
        return adj

    def export_json(self, indent: int = 2) -> str:
        """Экспорт графа в JSON.

        Returns:
            JSON-строка с полным графом.
        """
        import json as _json

        data = {
            "correlation_id": self.correlation_id,
            "root": self.root.to_dict() if self.root else None,
            "nodes": {eid: n.to_dict(include_children=False) for eid, n in self.nodes.items()},
            "graph": self.graph(),
            "timeline": [
                {
                    "event_id": n.event_id,
                    "topic": n.topic,
                    "timestamp": n.timestamp,
                    "depth": n.depth,
                }
                for n in self.timeline()
            ],
        }
        return _json.dumps(data, indent=indent, default=str)

    def __repr__(self) -> str:
        return (
            f"TraceGraph(correlation_id={self.correlation_id!r}, "
            f"nodes={len(self.nodes)}, root={self.root is not None})"
        )


# ── TraceBuilder ──


class TraceBuilder:
    """Строит TraceGraph из EventStore.

    Использует correlation_id и causation_id для построения
    полного графа цепочки событий.
    """

    def __init__(self, reader: EventStoreReader) -> None:
        self._reader = reader

    async def build(
        self,
        correlation_id: str,
        max_depth: int = 20,
    ) -> TraceGraph:
        """Построить полный граф по correlation_id.

        Args:
            correlation_id: ID трассировочной цепочки.
            max_depth:      Максимальная глубина.

        Returns:
            ``TraceGraph`` со всеми узлами цепочки.
        """
        # 1. Все события цепочки
        events = await self._reader.by_correlation(correlation_id, limit=5000)

        if not events:
            return TraceGraph(correlation_id=correlation_id)

        # 2. Построить узлы
        nodes: dict[str, TraceNode] = {}
        for ev in events:
            nodes[ev.event_id] = TraceNode(event=ev)

        # 3. Связать parent → children по causation_id
        for node in nodes.values():
            cid = node.causation_id
            if cid and cid in nodes:
                node.parent = nodes[cid]
                nodes[cid].children.append(node)

        # 4. Найти корень (самое раннее событие без parent в цепочке)
        root = None
        for node in nodes.values():
            if node.parent is None:
                if root is None or node.timestamp < root.timestamp:
                    root = node

        # 5. Вычислить глубину
        if root:
            _assign_depth(root, 0)

        return TraceGraph(
            correlation_id=correlation_id,
            root=root,
            nodes=nodes,
        )

    async def build_from_event(
        self,
        event_id: str,
        max_depth: int = 10,
    ) -> TraceGraph:
        """Построить граф от конкретного события.

        Args:
            event_id:  ID стартового события.
            max_depth: Максимальная глубина.

        Returns:
            ``TraceGraph`` с цепочкой от event_id.
        """
        # 1. Найти событие
        try:
            event = await self._reader._store.read_one(event_id)
        except Exception:
            return TraceGraph(correlation_id="", root=None, nodes={})

        cid = event.correlation_id or ""
        if cid:
            # Есть correlation_id — строим полный граф
            return await self.build(cid, max_depth=max_depth)

        # Нет correlation_id — строим только от event_id
        return await self._build_from_event(event_id, max_depth)

    async def _build_from_event(
        self,
        event_id: str,
        max_depth: int = 10,
    ) -> TraceGraph:
        """Построить граф от события без correlation_id."""
        nodes: dict[str, TraceNode] = {}
        visited: set[str] = set()
        frontier: list[str] = [event_id]

        for _depth in range(max_depth):
            if not frontier:
                break
            next_frontier: list[str] = []

            for ev_id in frontier:
                if ev_id in visited:
                    continue
                visited.add(ev_id)
                try:
                    event = await self._reader._store.read_one(ev_id)
                except Exception:
                    continue

                node = TraceNode(event=event, depth=_depth)
                nodes[ev_id] = node

                # Дети по causation_id
                children = await self._reader.by_causation(ev_id)
                for child in children:
                    child_node = nodes.get(child.event_id)
                    if child_node is None:
                        child_node = TraceNode(event=child, depth=_depth + 1)
                        nodes[child.event_id] = child_node
                    child_node.parent = node
                    node.children.append(child_node)
                    next_frontier.append(child.event_id)

            frontier = next_frontier

        # Найти корень (самое раннее событие)
        root = None
        for node in nodes.values():
            if node.parent is None:
                if root is None or node.timestamp < root.timestamp:
                    root = node

        return TraceGraph(
            correlation_id="",
            root=root,
            nodes=nodes,
        )


# ── Интеграция с EventStoreReader ──


async def trace_by_correlation(
    reader: EventStoreReader,
    correlation_id: str,
    max_depth: int = 20,
) -> TraceGraph:
    """Построить полный граф по correlation_id.

    Args:
        reader:         EventStoreReader.
        correlation_id: ID трассировочной цепочки.
        max_depth:      Максимальная глубина.

    Returns:
        ``TraceGraph``.
    """
    builder = TraceBuilder(reader)
    return await builder.build(correlation_id, max_depth=max_depth)


async def trace_event(
    reader: EventStoreReader,
    event_id: str,
    max_depth: int = 10,
) -> TraceGraph:
    """Построить граф от конкретного события.

    Args:
        reader:    EventStoreReader.
        event_id:  ID стартового события.
        max_depth: Максимальная глубина.

    Returns:
        ``TraceGraph`` с цепочкой от event_id.
    """
    builder = TraceBuilder(reader)
    return await builder.build_from_event(event_id, max_depth=max_depth)


# ── Internal ──


def _assign_depth(node: TraceNode, depth: int) -> None:
    """Рекурсивно присвоить глубину узлу и детям."""
    node.depth = depth
    for child in node.children:
        _assign_depth(child, depth + 1)
