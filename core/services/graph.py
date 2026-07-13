"""
DependencyGraph — DAG зависимостей сервисов.

Строит граф из пар (сервис → зависимости),
проверяет на циклы и выдаёт порядок запуска/остановки.

Алгоритм: Kahn's topological sort (BFS вариант).
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Iterator


class DependencyError(Exception):
    """Ошибка в графе зависимостей: цикл или отсутствующая зависимость."""

    def __init__(self, message: str, errors: list[str] | None = None):
        super().__init__(message)
        self.errors = errors or []


class DependencyGraph:
    """Ориентированный ациклический граф зависимостей сервисов.

    Каждый узел (сервис) может зависеть от других узлов.
    Граф гарантированно ациклический после сборки.
    """

    def __init__(self):
        # node -> set of nodes that depend on it (outgoing: "depended-by")
        self._dependents: dict[str, set[str]] = defaultdict(set)
        # node -> set of nodes it depends on (incoming: "depends-on")
        self._dependencies: dict[str, set[str]] = defaultdict(set)
        self._all_nodes: set[str] = set()

    # ── Сборка ──

    def add_node(self, name: str, dependencies: list[str] | None = None) -> None:
        """Добавить узел в граф.

        Args:
            name: Имя сервиса.
            dependencies: Имена сервисов, от которых зависит данный.
        """
        self._all_nodes.add(name)
        deps = dependencies or []

        # Удаляем старые рёбра если узел уже был
        if name in self._dependencies:
            for old_dep in self._dependencies[name]:
                self._dependents[old_dep].discard(name)
            self._dependencies[name].clear()

        for dep in deps:
            if dep == name:
                continue  # self-loop — игнорируем
            self._dependencies[name].add(dep)
            self._dependents[dep].add(name)

    def clear(self) -> None:
        """Очистить граф."""
        self._dependents.clear()
        self._dependencies.clear()
        self._all_nodes.clear()

    @property
    def nodes(self) -> set[str]:
        """Все узлы графа."""
        return self._all_nodes

    @property
    def edge_count(self) -> int:
        """Количество рёбер."""
        return sum(len(deps) for deps in self._dependencies.values())

    # ── Валидация ──

    def validate(self) -> list[str]:
        """Проверить граф на ошибки.

        Returns:
            Список ошибок. Пустой список = граф корректен.
        """
        errors: list[str] = []

        # 1. Отсутствующие зависимости — узлы, упомянутые как deps,
        #    но не добавленные как самостоятельные узлы
        all_dep_names = set()
        for deps in self._dependencies.values():
            all_dep_names.update(deps)
        missing = all_dep_names - self._all_nodes
        for dep in sorted(missing):
            # Найти какой сервис ссылается на неё
            refs = [
                n for n, deps in self._dependencies.items()
                if dep in deps
            ]
            for ref in refs:
                errors.append(
                    f"'{ref}' depends on unknown service '{dep}'"
                )

        # 2. Циклы
        if self.has_cycle():
            cycle = self._find_cycle()
            if cycle:
                errors.append(f"Cycle detected: {' → '.join(cycle)}")
            else:
                # Узлы не вошли в результат топ.сортировки
                unsorted = sorted(
                    n for n in self._all_nodes
                    if n not in self._kahn_sort(raise_on_cycle=False)
                )
                errors.append(f"Cycle detected in: {unsorted}")

        return errors

    def has_cycle(self) -> bool:
        """Проверить граф на циклы (Kahn: если не все узлы обработаны — есть цикл)."""
        result = self._kahn_sort(raise_on_cycle=False)
        return len(result) != len(self._all_nodes)

    def _find_cycle(self) -> list[str]:
        """Найти один цикл в графе (DFS)."""
        visited: set[str] = set()
        rec_stack: set[str] = set()
        parent: dict[str, str | None] = {}

        def dfs(node: str) -> list[str] | None:
            visited.add(node)
            rec_stack.add(node)

            for dep in self._dependencies.get(node, set()):
                if dep not in visited:
                    parent[dep] = node
                    result = dfs(dep)
                    if result:
                        return result
                elif dep in rec_stack:
                    # Найден цикл от dep до node
                    cycle = [dep, node]
                    curr = node
                    while curr != dep:
                        curr = parent.get(curr)
                        if curr is None:
                            break
                        cycle.append(curr)
                    cycle.reverse()
                    return cycle

            rec_stack.discard(node)
            return None

        for node in sorted(self._all_nodes):
            if node not in visited:
                result = dfs(node)
                if result:
                    return result

        return []

    # ── Топологическая сортировка ──

    def start_order(self) -> list[str]:
        """Порядок запуска сервисов (сначала зависимости, потом зависимые).

        Returns:
            Список имён сервисов в порядке запуска.

        Raises:
            DependencyError: Если граф содержит циклы или ошибки.
        """
        return self._kahn_sort(raise_on_cycle=True)

    def stop_order(self) -> list[str]:
        """Порядок остановки сервисов (обратный порядку запуска).

        Сначала останавливаются те, от кого никто не зависит,
        потом — те, от кого зависят другие.

        Returns:
            Список имён сервисов в порядке остановки.
        """
        return list(reversed(self.start_order()))

    def dependencies_of(self, name: str) -> set[str]:
        """Все зависимости сервиса (прямые + транзитивные)."""
        result: set[str] = set()
        visited: set[str] = set()

        def _walk(node: str) -> None:
            if node in visited:
                return
            visited.add(node)
            for dep in self._dependencies.get(node, set()):
                result.add(dep)
                _walk(dep)

        _walk(name)
        return result

    def dependents_of(self, name: str) -> set[str]:
        """Все сервисы, которые зависят от данного (прямые + транзитивные)."""
        result: set[str] = set()
        visited: set[str] = set()

        def _walk(node: str) -> None:
            if node in visited:
                return
            visited.add(node)
            for dep_by in self._dependents.get(node, set()):
                result.add(dep_by)
                _walk(dep_by)

        _walk(name)
        return result

    # ── Внутренние методы ──

    def _kahn_sort(self, raise_on_cycle: bool = False) -> list[str]:
        """Kahn's algorithm для топологической сортировки.

        BFS-вариант: находим узлы без входящих рёбер
        (не зависящие ни от кого), обрабатываем, уменьшаем
        входящие рёбра соседей.

        Args:
            raise_on_cycle: Если True, кидать DependencyError на цикле.
                            Если False, вернуть частичный результат.

        Returns:
            Список имён в топологическом порядке (или частичный при цикле).
        """
        # in-degree: сколько зависимостей у узла
        in_degree: dict[str, int] = {}
        for node in self._all_nodes:
            in_degree[node] = len(self._dependencies.get(node, set()))

        # Учитываем узлы, которые есть в dependents/edges но не в _all_nodes
        # (они появляются как зависимости, но не были явно добавлены)
        for dep, dependents in self._dependents.items():
            if dep not in in_degree:
                in_degree[dep] = 0
                self._all_nodes.add(dep)

        # Очередь узлов без зависимостей (in-degree = 0)
        queue: deque[str] = deque(
            sorted(node for node, deg in in_degree.items() if deg == 0)
        )

        result: list[str] = []

        while queue:
            node = queue.popleft()
            result.append(node)

            for dependent in self._dependents.get(node, set()):
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)

        if raise_on_cycle and len(result) != len(in_degree):
            # Остались узлы с ненулевым in-degree → есть цикл
            cycle_nodes = sorted(
                n for n in in_degree if n not in result
            )
            raise DependencyError(
                f"Cycle detected in graph: {cycle_nodes}"
            )

        return result

    def __repr__(self) -> str:
        return (
            f"DependencyGraph({len(self._all_nodes)} nodes, "
            f"{self.edge_count} edges)"
        )
