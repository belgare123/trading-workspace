"""
Dependency Resolver — граф зависимостей между плагинами.

Отвечает за:
  - Построение графа зависимостей из манифестов
  - Cycle detection (Kahn)
  - Топологическую сортировку (startup order)
  - Проверку версий (SemVer)
  - Опциональные зависимости
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  SemVer helpers
# ═══════════════════════════════════════════════════════════════════

_SEMVER_RE = re.compile(r"^(\d+)(?:\.(\d+))?(?:\.(\d+))?$")


def _parse_version(version: str) -> tuple[int, ...]:
    """Разобрать версию в кортеж для сравнения.

    "2.1.0" → (2, 1, 0)
    "2.1"   → (2, 1)
    "*"     → (0,)  (any)
    """
    version = version.strip().lstrip("vV")
    if version in ("*", "any", ""):
        return (0,)
    m = _SEMVER_RE.match(version)
    if not m:
        raise ValueError(f"Cannot parse version: {version!r}")
    return tuple(int(g) for g in m.groups() if g is not None)


def _version_str(ver: tuple[int, ...]) -> str:
    """Обратно: (2, 1, 0) → "2.1.0"."""
    return ".".join(str(v) for v in ver)


def _check_version_constraint(
    actual: str,
    constraint: str,
) -> bool:
    """Проверить, удовлетворяет ли actual ограничению constraint.

    Поддерживаемые операторы:
      >=1.0     — больше или равно
      >1.0      — строго больше
      <1.0      — строго меньше
      <=1.0     — меньше или равно
      =1.0      — равно
      ==1.0     — равно
      ^1.0      — совместимо (major =, minor >=) — SemVer caret
      ~1.0      — примерно (major.minor =, patch >=) — SemVer tilde
      1.0       — точное совпадение (как =)
      *         — любая
    """
    constraint = constraint.strip()

    # Любая версия
    if constraint in ("*", "any", ""):
        return True

    actual_tuple = _parse_version(actual)
    if actual_tuple == (0,):
        return True  # actual не распознана — пропускаем

    # Определяем оператор и версию ограничения
    if constraint.startswith(">="):
        op = ">="
        ver_str = constraint[2:]
    elif constraint.startswith(">"):
        op = ">"
        ver_str = constraint[1:]
    elif constraint.startswith("<="):
        op = "<="
        ver_str = constraint[2:]
    elif constraint.startswith("<"):
        op = "<"
        ver_str = constraint[1:]
    elif constraint.startswith("=="):
        op = "=="
        ver_str = constraint[2:]
    elif constraint.startswith("="):
        op = "="
        ver_str = constraint[1:]
    elif constraint.startswith("^"):
        op = "^"
        ver_str = constraint[1:]
    elif constraint.startswith("~"):
        op = "~"
        ver_str = constraint[1:]
    else:
        # Точное совпадение
        op = "="
        ver_str = constraint

    try:
        constraint_tuple = _parse_version(ver_str)
    except ValueError:
        logger.warning("Cannot parse constraint version: %r", ver_str)
        return True  # пропускаем нераспознанные

    padding = len(constraint_tuple)
    actual_padded = actual_tuple[:padding]
    # Дополняем нулями если actual короче
    while len(actual_padded) < padding:
        actual_padded = actual_padded + (0,)

    if op in ("=", "=="):
        return actual_padded == constraint_tuple
    elif op == ">=":
        return actual_padded >= constraint_tuple
    elif op == ">":
        return actual_padded > constraint_tuple
    elif op == "<=":
        return actual_padded <= constraint_tuple
    elif op == "<":
        return actual_padded < constraint_tuple
    elif op == "^":
        # Совместимая: major совпадает, minor >=
        if len(constraint_tuple) < 1:
            return True
        if actual_padded[0] != constraint_tuple[0]:
            return False
        if len(constraint_tuple) >= 2 and len(actual_padded) >= 2:
            return actual_padded[1] >= constraint_tuple[1]
        return True  # только major — любая в той же major
    elif op == "~":
        # Примерно: major.minor совпадают, patch >=
        if len(constraint_tuple) < 2:
            return actual_padded[0] == constraint_tuple[0]
        if len(actual_padded) < 2:
            return False
        if actual_padded[0] != constraint_tuple[0] or actual_padded[1] != constraint_tuple[1]:
            return False
        if len(constraint_tuple) >= 3 and len(actual_padded) >= 3:
            return actual_padded[2] >= constraint_tuple[2]
        return True
    else:
        return True  # неизвестный оператор


# ═══════════════════════════════════════════════════════════════════
#  DependencyError
# ═══════════════════════════════════════════════════════════════════


class DependencyError(Exception):
    """Ошибка в графе зависимостей плагинов."""

    def __init__(self, message: str, source: str | None = None):
        self.source = source
        super().__init__(message)


class CircularDependencyError(DependencyError):
    """Обнаружена циклическая зависимость."""

    def __init__(self, cycle: list[str]):
        self.cycle = cycle
        path = " → ".join(cycle)
        super().__init__(f"Circular dependency detected: {path}", source=cycle[0])


class MissingDependencyError(DependencyError):
    """Отсутствует обязательная зависимость."""

    def __init__(self, plugin: str, dependency: str, reason: str = ""):
        self.plugin = plugin
        self.dependency = dependency
        msg = f"Missing dependency '{dependency}' required by '{plugin}'"
        if reason:
            msg += f": {reason}"
        super().__init__(msg, source=plugin)


class VersionMismatchError(DependencyError):
    """Версия зависимости не удовлетворяет ограничению."""

    def __init__(self, plugin: str, dependency: str, required: str, actual: str):
        self.plugin = plugin
        self.dependency = dependency
        self.required = required
        self.actual = actual
        super().__init__(
            f"Version mismatch: '{plugin}' requires {dependency}{required}, "
            f"but {dependency} is v{actual}",
            source=plugin,
        )


# ═══════════════════════════════════════════════════════════════════
#  DependencyGraph
# ═══════════════════════════════════════════════════════════════════


@dataclass
class DependencyGraphNode:
    """Узел графа зависимостей.

    Attributes:
        name:         Имя плагина.
        version:      Версия плагина.
        dependencies: Список имён плагинов, от которых зависит.
        optional:     Множество опциональных зависимостей.
        metadata:     Произвольные метаданные (например, PluginRecord).
    """

    name: str
    version: str = "0.0.0"
    dependencies: list[str] = field(default_factory=list)
    optional: set[str] = field(default_factory=set)
    metadata: dict[str, Any] = field(default_factory=dict)

    def __repr__(self) -> str:
        return f"Node({self.name} v{self.version})"


class DependencyGraph:
    """Ориентированный граф зависимостей плагинов.

    Пример:
        graph = DependencyGraph()
        graph.add_node("A", version="1.0")
        graph.add_node("B", version="2.0")
        graph.add_dependency("B", "A")
        order = graph.topological_sort()  # ["A", "B"]
    """

    def __init__(self) -> None:
        self._nodes: dict[str, DependencyGraphNode] = {}
        self._edges: dict[str, set[str]] = {}  # plugin ← depends_on

    # ── Node management ──

    def add_node(
        self,
        name: str,
        version: str = "0.0.0",
        metadata: dict[str, Any] | None = None,
    ) -> DependencyGraphNode:
        """Добавить плагин в граф.

        Args:
            name:    Имя плагина.
            version: Версия.
            metadata: Произвольные данные (PluginRecord, etc.).

        Returns:
            Существующий или новый узел.
        """
        if name in self._nodes:
            node = self._nodes[name]
            # Обновляем версию если была неизвестна
            if node.version == "0.0.0" and version != "0.0.0":
                node.version = version
            if metadata:
                node.metadata.update(metadata)
            return node

        node = DependencyGraphNode(
            name=name,
            version=version,
            metadata=metadata or {},
        )
        self._nodes[name] = node
        self._edges.setdefault(name, set())
        logger.debug("Added node: %s v%s", name, version)
        return node

    def remove_node(self, name: str) -> None:
        """Удалить узел и все его рёбра."""
        self._nodes.pop(name, None)
        self._edges.pop(name, None)
        for deps in self._edges.values():
            deps.discard(name)

    def has_node(self, name: str) -> bool:
        return name in self._nodes

    def get_node(self, name: str) -> DependencyGraphNode | None:
        return self._nodes.get(name)

    @property
    def size(self) -> int:
        return len(self._nodes)

    @property
    def nodes(self) -> list[DependencyGraphNode]:
        return list(self._nodes.values())

    # ── Edges ──

    def add_dependency(self, plugin: str, depends_on: str) -> None:
        """Добавить зависимость plugin → depends_on.

        Args:
            plugin:     Имя плагина.
            depends_on: Имя плагина, от которого зависит.

        Raises:
            DependencyError: Если depends_on не найден в графе.
        """
        if plugin not in self._nodes:
            self.add_node(plugin)
        if depends_on not in self._nodes:
            raise DependencyError(
                f"Cannot add dependency: '{depends_on}' is not in the graph. "
                f"Add it first with add_node().",
                source=plugin,
            )

        self._edges.setdefault(plugin, set()).add(depends_on)

        # Обновляем список зависимостей в узле
        node = self._nodes[plugin]
        if depends_on not in node.dependencies:
            node.dependencies.append(depends_on)

    def add_dependencies(self, plugin: str, depends_on: list[str]) -> None:
        """Добавить несколько зависимостей сразу."""
        for dep in depends_on:
            self.add_dependency(plugin, dep)

    def dependencies_of(self, name: str) -> set[str]:
        """Прямые зависимости плагина."""
        return set(self._edges.get(name, set()))

    def dependents_of(self, name: str) -> list[str]:
        """Плагины, которые зависят от name."""
        return [
            plugin
            for plugin, deps in self._edges.items()
            if name in deps
        ]

    def transitive_dependencies(self, name: str) -> set[str]:
        """Все зависимости (прямые + транзитивные)."""
        visited: set[str] = set()

        def _walk(node: str) -> None:
            for dep in self._edges.get(node, set()):
                if dep not in visited:
                    visited.add(dep)
                    _walk(dep)

        _walk(name)
        return visited

    # ── Cycle detection ──

    def has_cycle(self) -> bool:
        """Проверить граф на циклы (Kahn)."""
        try:
            self.topological_sort()
            return False
        except CircularDependencyError:
            return True

    def find_cycle(self) -> list[str] | None:
        """Найти первый цикл в графе."""
        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = {n: WHITE for n in self._nodes}
        parent: dict[str, str | None] = {n: None for n in self._nodes}

        def _dfs(node: str) -> list[str] | None:
            color[node] = GRAY
            for dep in self._edges.get(node, set()):
                if dep not in self._nodes:
                    continue
                if color[dep] == GRAY:
                    # Найден цикл: восстановить путь
                    cycle = [dep, node]
                    curr = node
                    while curr != dep and parent[curr] is not None:
                        curr = parent[curr]
                        if curr is not None:
                            cycle.append(curr)
                    cycle.reverse()
                    return cycle
                if color[dep] == WHITE:
                    parent[dep] = node
                    result = _dfs(dep)
                    if result is not None:
                        return result
            color[node] = BLACK
            return None

        for node in self._nodes:
            if color[node] == WHITE:
                result = _dfs(node)
                if result is not None:
                    return result
        return None

    # ── Topological sort ──

    def topological_sort(self) -> list[str]:
        """Топологическая сортировка (Kahn).

        Returns:
            Порядок запуска: зависимости раньше зависящих от них.

        Raises:
            CircularDependencyError: Если есть цикл.
        """
        # Копируем граф
        in_degree: dict[str, int] = {n: 0 for n in self._nodes}
        for plugin, deps in self._edges.items():
            for dep in deps:
                if dep in in_degree:
                    in_degree[dep] += 0  # ensure exists
                in_degree[plugin] = in_degree.get(plugin, 0) + 1
                # Wait — we need: in_degree[dep] += 1 because dep is a dependency
                # That is: edge node → dep means node depends on dep
                # So dep has a reverse edge: dep is depended on

        # OK, redo: edge: plugin → dep means plugin depends on dep.
        # So if we want to order deps first, then dependents:
        #   in-degree of node = number of nodes that depend on it? No...
        #
        # Standard Kahn: in-degree(u) = number of edges (v → u)
        # Edge (plugin → dep) means plugin → dep, so:
        #   in-degree(dep) = number of nodes that depend on dep
        #   in-degree(plugin) += 1 for each dep
        #
        # Wait, I'm getting confused. Let me think again.
        # add_dependency("B", "A") means B depends on A → edge B → A
        # In topological sort, A should come before B.
        # So edges go from dependents to dependencies.
        # Kahn: vertices with in-degree 0 (no incoming edges) first.
        # If edge is B → A:
        #   A has incoming edge from B → in-degree(A)++
        #   B has no incoming edges → in-degree(B) = 0
        # So B comes before A. That's wrong!

        # OK I need to reverse the direction for Kahn.
        # In Kahn, edge u → v means u must come before v.
        # But our edge plugin → dep means plugin depends on dep,
        # so dep must come before plugin.
        # So for Kahn's algorithm, I need reverse edges:
        #   edge_v → edge_from means edge_from depends on edge_to
        # Actually: dep should come first. So edge dep → plugin
        # for the purpose of topological sort.

        # Let me rebuild with correct edge semantics for Kahn:
        # We build reverse edges: for each plugin → dep,
        # we add edge: dep → plugin (dep must come before plugin)
        reverse_edges: dict[str, set[str]] = {n: set() for n in self._nodes}
        in_degree = {n: 0 for n in self._nodes}

        for plugin, deps in self._edges.items():
            for dep in deps:
                if dep not in reverse_edges:
                    continue  # skip deps not in graph (optionals)
                # dep must come before plugin
                reverse_edges[dep].add(plugin)
                in_degree[plugin] = in_degree.get(plugin, 0) + 1

        # Standard Kahn
        from collections import deque

        queue: deque[str] = deque(
            node for node, degree in in_degree.items() if degree == 0
        )
        if not queue and self._nodes:
            raise CircularDependencyError(list(self._nodes.keys())[:3])

        result: list[str] = []
        while queue:
            node = queue.popleft()
            result.append(node)
            for dependent in reverse_edges.get(node, set()):
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)

        if len(result) != len(self._nodes):
            remaining = set(self._nodes.keys()) - set(result)
            cycle = list(remaining)[:5]
            raise CircularDependencyError(cycle)

        return result

    def reverse_sort(self) -> list[str]:
        """Обратный топологический порядок (для shutdown)."""
        return list(reversed(self.topological_sort()))

    # ── Validation ──

    def validate(self) -> list[DependencyError]:
        """Проверить граф на проблемы.

        Returns:
            Список ошибок (пустой если граф валиден).
        """
        errors: list[DependencyError] = []

        # 1. Cycle detection
        cycle = self.find_cycle()
        if cycle:
            errors.append(CircularDependencyError(cycle))

        # 2. Missing deps (если узел есть, но его зависимость удалена)
        for plugin, deps in self._edges.items():
            for dep in deps:
                if dep not in self._nodes:
                    errors.append(
                        MissingDependencyError(plugin, dep, "not in graph")
                    )

        return errors

    # ── Serialization ──

    def to_dict(self) -> dict[str, Any]:
        """Экспорт графа в dict."""
        return {
            "nodes": {
                n: {
                    "version": node.version,
                    "dependencies": list(self._edges.get(n, set())),
                    "optional": list(node.optional),
                }
                for n, node in self._nodes.items()
            },
            "size": self.size,
            "has_cycle": self.has_cycle(),
        }

    def __repr__(self) -> str:
        return f"DependencyGraph({self.size} nodes, cycle={self.has_cycle()})"


# ═══════════════════════════════════════════════════════════════════
#  DependencyResolver
# ═══════════════════════════════════════════════════════════════════


ResolveResult = dict[str, DependencyGraphNode]


@dataclass
class ResolveReport:
    """Результат разрешения зависимостей.

    Attributes:
        success:    True если все проверки пройдены.
        start_order: Порядок запуска (зависимости первыми).
        errors:     Список ошибок.
        graph:      Построенный граф.
        warnings:   Предупреждения (например, missing optional deps).
    """

    success: bool = True
    start_order: list[str] = field(default_factory=list)
    errors: list[DependencyError] = field(default_factory=list)
    graph: DependencyGraph | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return self.success and not self.errors


class DependencyResolver:
    """Разрешение зависимостей плагинов.

    Берёт манифесты из PluginRegistry или другой источник,
    строит граф, проверяет версии и циклы.

    Пример:
        resolver = DependencyResolver()
        report = await resolver.resolve([
            ("Momentum", "2.0.0", ["ICT"], {"ICT"}),
            ("ICT",     "1.0.0", [],       set()),
        ])
        if report.success:
            for name in report.start_order:
                print(f"Start: {name}")
    """

    def __init__(self) -> None:
        self._graph = DependencyGraph()
        self._constraints: dict[str, dict[str, str]] = {}  # plugin → {dep → version}
        self._known: set[str] = set()  # плагины, явно добавленные (не stubs)

    @property
    def graph(self) -> DependencyGraph:
        return self._graph

    def clear(self) -> None:
        """Сбросить resolver."""
        self._graph = DependencyGraph()
        self._constraints.clear()
        self._known.clear()

    def add_plugin(
        self,
        name: str,
        version: str,
        dependencies: list[tuple[str, str, bool]],
    ) -> None:
        """Добавить плагин с его зависимостями в resolver.

        Args:
            name:         Имя плагина.
            version:      Версия плагина.
            dependencies: Список (dep_name, dep_version_constraint, is_optional).
        """
        self._graph.add_node(name, version=version)

        # Отмечаем как явно зарегистрированный
        self._known.add(name)

        for dep_name, dep_version, is_optional in dependencies:
            # Добавляем зависимость как узел (если его ещё нет)
            if not self._graph.has_node(dep_name):
                self._graph.add_node(dep_name, version="0.0.0")

            self._graph.add_dependency(name, dep_name)

            # Если опциональная — отмечаем
            node = self._graph.get_node(name)
            if node and is_optional:
                node.optional.add(dep_name)

            # Запоминаем версионное ограничение
            self._constraints.setdefault(name, {})[dep_name] = dep_version

    def add_from_registry(
        self,
        plugins: list[tuple[str, str, list[tuple[str, str, bool]]]],
    ) -> None:
        """Добавить плагины из списка кортежей (name, version, dependencies)."""
        for name, version, deps in plugins:
            self.add_plugin(name, version, deps)

    # ── Resolution ──

    def resolve(
        self,
        check_versions: bool = True,
        strict: bool = False,
    ) -> ResolveReport:
        """Разрешить зависимости.

        Args:
            check_versions: Проверять версионные ограничения.
            strict:         Если True — missing optional devs считаются ошибкой.

        Returns:
            ResolveReport.
        """
        report = ResolveReport()
        errors: list[DependencyError] = []

        # 1. Проверка на циклы
        cycle = self._graph.find_cycle()
        if cycle:
            errors.append(CircularDependencyError(cycle))

        # 2. Проверка на missing deps
        for plugin in self._graph.nodes:
            for dep_name in plugin.dependencies:
                dep_known = dep_name in self._known
                if not dep_known:
                    if dep_name in plugin.optional:
                        report.warnings.append(
                            f"Optional dependency '{dep_name}' not found "
                            f"(required by '{plugin.name}')"
                        )
                        if strict:
                            errors.append(
                                MissingDependencyError(plugin.name, dep_name)
                            )
                    else:
                        errors.append(
                            MissingDependencyError(
                                plugin.name,
                                dep_name,
                                "not found in registry",
                            )
                        )
                    continue

                # 3. Версионные ограничения (только для известных зависимостей)
                if check_versions and dep_known:
                    dep_node = self._graph.get_node(dep_name)
                    constraint = self._constraints.get(plugin.name, {}).get(dep_name, "*")
                    if dep_node and not _check_version_constraint(dep_node.version, constraint):
                        errors.append(
                            VersionMismatchError(
                                plugin.name,
                                dep_name,
                                constraint,
                                dep_node.version,
                            )
                        )

        # 4. Startup order (только если нет циклов)
        start_order: list[str] = []
        if not cycle:
            try:
                start_order = self._graph.topological_sort()
            except CircularDependencyError as e:
                errors.append(e)

        report.success = len(errors) == 0
        report.errors = errors
        report.start_order = start_order
        report.graph = self._graph

        if report.success:
            logger.info(
                "Dependency resolution SUCCESS: %d plugins, order=%s",
                len(self._graph.nodes),
                start_order,
            )
        else:
            logger.error(
                "Dependency resolution FAILED: %d error(s)",
                len(errors),
            )
            for err in errors:
                logger.error("  - %s", err)

        return report

    def resolve_from_registry(
        self,
        registry_plugins: list[tuple[str, str, list[tuple[str, str, bool]]]],
        check_versions: bool = True,
        strict: bool = False,
    ) -> ResolveReport:
        """Удобный метод: очистить → добавить → разрешить."""
        self.clear()
        self.add_from_registry(registry_plugins)
        return self.resolve(check_versions=check_versions, strict=strict)
