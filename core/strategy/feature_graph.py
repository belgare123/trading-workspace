"""
Feature Graph (6.5) — граф фич с resolution конфликтов и auto-discovery.

Каждый плагин декларирует:

  provides: [candles, rsi, ema]    # что даёт миру (capabilities)
  requires: [orderbook, funding]    # что потребляет

Feature Graph отслеживает:
  - Реестр всех известных фич (CapabilityInfo)
  - Маппинг plugin → фичи и фича → plugin
  - Конфликты: >1 плагин на одну фичу
  - Сироты: фичи required но not provided
  - Auto-discovery: найти плагины по набору фич

Интеграция с CapabilityRegistry (Phase 5.5):
  - FeatureGraph использует CapabilityRegistry как source of truth
    для мета-информации о фичах (dependencies, cost, ttl, group)
  - CapabilityRegistry.resolve() — топологическая сортировка фич
  - FeatureGraph добавляет plugin-level resolution поверх этого
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from core.strategy.capability_db import CapabilityInfo, CapabilityRegistry

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Exceptions
# ═══════════════════════════════════════════════════════════════════


class FeatureGraphError(Exception):
    """Базовое исключение Feature Graph."""
    pass


class FeatureConflictError(FeatureGraphError):
    """Два и более плагина предоставляют одну фичу."""
    def __init__(self, feature: str, plugins: list[str]) -> None:
        self.feature = feature
        self.plugins = plugins
        super().__init__(
            f"Feature '{feature}' provided by multiple plugins: {', '.join(plugins)}"
        )


class FeatureMissingError(FeatureGraphError):
    """Фича required но not provided ни одним плагином."""
    def __init__(self, feature: str, required_by: list[str]) -> None:
        self.feature = feature
        self.required_by = required_by
        super().__init__(
            f"Feature '{feature}' required by {required_by} "
            f"but not provided by any plugin"
        )


# ═══════════════════════════════════════════════════════════════════
#  Data models
# ═══════════════════════════════════════════════════════════════════


@dataclass
class FeatureDeclaration:
    """Регистрация фичи для плагина.

    Attributes:
        plugin:       Имя плагина, который декларирует фичу.
        provides:     Фичи, которые плагин предоставляет.
        requires:     Фичи, которые плагин потребляет.
    """
    plugin: str
    provides: set[str] = field(default_factory=set)
    requires: set[str] = field(default_factory=set)


@dataclass
class FeatureConflict:
    """Конфликт фичи.

    Attributes:
        feature:    Имя фичи.
        plugins:    Плагины, которые её предоставляют.
        resolved:   True — конфликт разрешён выбором плагина.
        chosen:     Выбранный плагин (если resolved).
    """
    feature: str
    plugins: list[str]
    resolved: bool = False
    chosen: str | None = None


@dataclass
class FeatureResolution:
    """Результат разрешения фич для набора плагинов.

    Attributes:
        success:        True — все фичи разрешены без конфликтов.
        provider_map:   feature → plugin (кто предоставляет).
        conflicts:      Список конфликтов.
        missing:        Фичи, которые required но not provided.
        unresolved:     Фичи, не разрешённые из-за конфликтов.
    """
    success: bool = True
    provider_map: dict[str, str] = field(default_factory=dict)
    conflicts: list[FeatureConflict] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    unresolved: list[str] = field(default_factory=list)

    @property
    def issues(self) -> list[str]:
        """Список проблем для логирования/отображения."""
        result: list[str] = []
        for c in self.conflicts:
            if c.resolved:
                result.append(
                    f"Conflict on '{c.feature}' → resolved to {c.chosen}"
                )
            else:
                result.append(
                    f"Conflict on '{c.feature}': {', '.join(c.plugins)}"
                )
        for m in self.missing:
            result.append(f"Missing feature: {m}")
        for u in self.unresolved:
            result.append(f"Unresolved feature: {u}")
        return result


# ═══════════════════════════════════════════════════════════════════
#  FeatureGraph
# ═══════════════════════════════════════════════════════════════════


class FeatureGraph:
    """Граф фич — отслеживает кто что предоставляет и потребляет.

    Архитектура:
      ┌──────────────────────────────────────────────────┐
      │  FeatureGraph                                    │
      │  ┌────────────────────┐  ┌────────────────────┐  │
      │  │  Plugin → Features  │  │  Feature → Plugins  │  │
      │  │  (who provides      │  │  (who requires/     │  │
      │  │   what, who needs   │  │   provides)         │  │
      │  │   what)             │  │                     │  │
      │  └────────────────────┘  └────────────────────┘  │
      │                                                  │
      │  CapabilityRegistry (source of truth)            │
      │  - knows all features, deps, costs               │
      │  - topological sort for compute order             │
      └──────────────────────────────────────────────────┘

    Два уровня resolution:
      L1: CapabilityRegistry.resolve() — topological order для compute
      L2: FeatureGraph.resolve() — кто какой плагин за какую фичу отвечает
    """

    def __init__(
        self,
        capability_registry: CapabilityRegistry | None = None,
    ) -> None:
        self._cap_reg = capability_registry or CapabilityRegistry()
        self._cap_reg.register_builtins()

        # plugin → FeatureDeclaration
        self._declarations: dict[str, FeatureDeclaration] = {}

        # feature → [plugin names that provide it]
        self._providers: dict[str, list[str]] = {}

        # feature → [plugin names that require it]
        self._consumers: dict[str, list[str]] = {}

        # All registered feature names (from provides)
        self._all_features: set[str] = set()

    # ── Feature Registration ──

    def register_feature(
        self,
        name: str,
        description: str = "",
        category: str = "uncategorized",
        dependencies: list[str] | None = None,
    ) -> None:
        """Зарегистрировать известную фичу.

        Если фича уже есть в CapabilityRegistry — обновить метаданные.
        Если нет — зарегистрировать как базовую.

        Args:
            name:         Имя фичи.
            description:  Описание.
            category:     Категория (technical, volume, market, ai).
            dependencies: От каких фич зависит.
        """
        if name in self._cap_reg:
            return  # уже зарегистрирована

        info = CapabilityInfo(
            name=name,
            description=description,
            provider="plugin",
            dependencies=list(dependencies or []),
            group=category,
        )
        try:
            self._cap_reg.register(info)
        except (ValueError, Exception):
            logger.debug("Feature '%s' already registered in CapabilityRegistry", name)

    def has_feature(self, name: str) -> bool:
        """Проверить, известна ли фича."""
        return name in self._cap_reg

    def get_feature_info(self, name: str) -> CapabilityInfo | None:
        """Получить мета-информацию о фиче."""
        return self._cap_reg.get(name)

    def all_features(self) -> list[CapabilityInfo]:
        """Список всех известных фич."""
        return self._cap_reg.all()

    # ── Plugin Declaration ──

    def declare_plugin(
        self,
        plugin: str,
        provides: set[str] | None = None,
        requires: set[str] | None = None,
    ) -> None:
        """Задекларировать фичи для плагина.

        Args:
            plugin:   Имя плагина.
            provides: Фичи, которые плагин предоставляет.
            requires: Фичи, которые плагин потребляет.

        Note:
            Несколько плагинов могут предоставлять одну фичу.
            Конфликты детектятся при resolve().
        """
        provides = provides or set()
        requires = requires or set()

        # Если уже зарегистрирован — обновляем
        old = self._declarations.get(plugin)
        if old:
            # Remove old provides from providers map
            for feature in old.provides:
                if plugin in self._providers.get(feature, []):
                    self._providers[feature].remove(plugin)
                # Clean up empty provider lists
                if not self._providers.get(feature):
                    del self._providers[feature]
                if feature in self._all_features and not self._providers.get(feature):
                    self._all_features.discard(feature)

            # Remove old requires from consumers map
            for feature in old.requires:
                if plugin in self._consumers.get(feature, []):
                    self._consumers[feature].remove(plugin)
                # Clean up empty consumer lists
                if not self._consumers.get(feature):
                    del self._consumers[feature]

        decl = FeatureDeclaration(
            plugin=plugin,
            provides=provides,
            requires=requires,
        )
        self._declarations[plugin] = decl

        # Add to providers map (allow multiple providers per feature)
        for feature in provides:
            self._providers.setdefault(feature, []).append(plugin)
            self._all_features.add(feature)
            # Auto-register feature if not known
            if feature not in self._cap_reg:
                self.register_feature(feature)

            # Log warning if this creates a conflict
            if len(self._providers[feature]) > 1:
                logger.info(
                    "Feature '%s' now provided by %d plugins: %s",
                    feature,
                    len(self._providers[feature]),
                    ", ".join(self._providers[feature]),
                )

        # Add to consumers map
        for feature in requires:
            self._consumers.setdefault(feature, []).append(plugin)
            # Auto-register feature if not known
            if feature not in self._cap_reg:
                self.register_feature(feature)

    def remove_plugin(self, plugin: str) -> None:
        """Удалить плагин из графа.

        Args:
            plugin: Имя плагина.
        """
        decl = self._declarations.pop(plugin, None)
        if not decl:
            return

        for feature in decl.provides:
            if plugin in self._providers.get(feature, []):
                self._providers[feature].remove(plugin)
            # Clean up empty provider lists
            if not self._providers.get(feature):
                del self._providers[feature]
            if feature in self._all_features and not self._providers.get(feature):
                self._all_features.discard(feature)

        for feature in decl.requires:
            if plugin in self._consumers.get(feature, []):
                self._consumers[feature].remove(plugin)
            # Clean up empty consumer lists
            if not self._consumers.get(feature):
                del self._consumers[feature]

    def clear(self) -> None:
        """Сбросить граф (не трогает CapabilityRegistry)."""
        self._declarations.clear()
        self._providers.clear()
        self._consumers.clear()
        self._all_features.clear()

    # ── Query ──

    def get_declaration(self, plugin: str) -> FeatureDeclaration | None:
        """Получить декларацию плагина."""
        return self._declarations.get(plugin)

    def find_providers(self, feature: str) -> list[str]:
        """Найти плагины, предоставляющие фичу.

        Args:
            feature: Имя фичи.

        Returns:
            Список имён плагинов.
        """
        return list(self._providers.get(feature, []))

    def find_consumers(self, feature: str) -> list[str]:
        """Найти плагины, потребляющие фичу.

        Args:
            feature: Имя фичи.

        Returns:
            Список имён плагинов.
        """
        return list(self._consumers.get(feature, []))

    def plugin_provides(self, plugin: str) -> set[str]:
        """Фичи, предоставляемые плагином."""
        decl = self._declarations.get(plugin)
        return set(decl.provides) if decl else set()

    def plugin_requires(self, plugin: str) -> set[str]:
        """Фичи, требуемые плагином."""
        decl = self._declarations.get(plugin)
        return set(decl.requires) if decl else set()

    def plugins_by_provider(self, provider: str) -> list[str]:
        """Плагины, которые предоставляют хотя бы одну фичу данного провайдера.

        Args:
            provider: Имя провайдера (из CapabilityInfo.provider).

        Returns:
            Список имён плагинов.
        """
        cap_names = {c.name for c in self._cap_reg.by_provider(provider)}
        result: list[str] = []
        for plugin, decl in self._declarations.items():
            if decl.provides & cap_names:
                result.append(plugin)
        return result

    # ── Conflict Detection ──

    def find_conflicts(self) -> list[FeatureConflict]:
        """Найти все конфликты: фичи, предоставляемые >1 плагином.

        Returns:
            Список FeatureConflict.
        """
        conflicts: list[FeatureConflict] = []
        for feature, plugins in self._providers.items():
            if len(plugins) > 1:
                conflicts.append(FeatureConflict(
                    feature=feature,
                    plugins=list(plugins),
                ))
        return conflicts

    def find_orphans(self) -> list[str]:
        """Фичи, которые required но not provided ни одним плагином.

        Returns:
            Список имён фич.
        """
        orphans: list[str] = []
        for feature in self._consumers:
            if feature not in self._providers:
                orphans.append(feature)
        return orphans

    # ── Resolution ──

    def resolve(
        self,
        strict: bool = False,
        prefer: dict[str, str] | None = None,
    ) -> FeatureResolution:
        """Разрешить все фичи для всех зарегистрированных плагинов.

        Args:
            strict: Если True — любой конфликт или missing = failure.
                    Если False — missing орфаны = warning, не failure.
            prefer: Словарь feature → preferred_plugin.
                    При конфликте выбирать preferred, если available.

        Returns:
            FeatureResolution.
        """
        resolution = FeatureResolution()
        prefer = prefer or {}

        # 1. Детект конфликтов
        conflicts = self.find_conflicts()
        resolution.conflicts = conflicts

        # 2. Детект missing
        orphans = self.find_orphans()
        resolution.missing = [
            f for f in orphans
            if self._feature_is_required(f)
        ]

        # 3. Resolution
        provider_map: dict[str, str] = {}
        unresolved: list[str] = []

        for feature, plugins in self._providers.items():
            if len(plugins) == 1:
                provider_map[feature] = plugins[0]
            else:
                # Conflict — try preference
                preferred = prefer.get(feature)
                if preferred and preferred in plugins:
                    provider_map[feature] = preferred
                    # Mark conflict as resolved
                    for c in conflicts:
                        if c.feature == feature:
                            c.resolved = True
                            c.chosen = preferred
                elif strict:
                    unresolved.append(feature)

        # Resolve orphans (missing has no provider — can't resolve)
        resolution.provider_map = provider_map
        resolution.unresolved = unresolved
        resolution.success = (
            len(resolution.missing) == 0
            and len(resolution.unresolved) == 0
        )

        return resolution

    def resolve_plugin(
        self,
        plugin: str,
        strict: bool = False,
    ) -> FeatureResolution:
        """Разрешить фичи для одного плагина.

        Args:
            plugin: Имя плагина.
            strict: Строгий режим.

        Returns:
            FeatureResolution.
        """
        decl = self._declarations.get(plugin)
        if not decl:
            resolution = FeatureResolution(success=False)
            resolution.missing = [f"{plugin} not registered"]
            return resolution

        resolution = FeatureResolution()
        conflicts: list[FeatureConflict] = []
        missing: list[str] = []
        provider_map: dict[str, str] = {}

        for feature in decl.provides:
            providers = self._providers.get(feature, [])
            if len(providers) > 1:
                conflicts.append(FeatureConflict(
                    feature=feature,
                    plugins=list(providers),
                ))

        for feature in decl.requires:
            providers = self._providers.get(feature, [])
            if not providers:
                missing.append(feature)
            elif len(providers) == 1:
                provider_map[feature] = providers[0]
            else:
                # Multiple providers but we need one — first wins
                provider_map[feature] = providers[0]

        resolution.conflicts = conflicts
        resolution.missing = missing
        resolution.provider_map = provider_map
        resolution.success = len(missing) == 0 or not strict

        return resolution

    # ── Auto-discovery ──

    def auto_discover(
        self,
        required_features: set[str],
        optional_features: set[str] | None = None,
    ) -> list[str]:
        """Найти плагины, предоставляющие нужный набор фич.

        Args:
            required_features: Фичи, которые ОБЯЗАТЕЛЬНО нужны.
            optional_features: Фичи, которые желательны (опционально).

        Returns:
            Список имён плагинов, отсортированный по релевантности
            (сначала тот, кто покрывает больше required фич,
            потом optional).
        """
        optional_features = optional_features or set()
        all_needed = required_features | optional_features

        scored: list[tuple[int, int, str]] = []  # (required_match, optional_match, plugin)

        for plugin, decl in self._declarations.items():
            req_match = len(decl.provides & required_features)
            opt_match = len(decl.provides & optional_features)
            if req_match > 0 or opt_match > 0:
                scored.append((req_match, opt_match, plugin))

        # Sort by required_match DESC, then optional_match DESC
        scored.sort(key=lambda x: (-x[0], -x[1]))

        return [plugin for _, _, plugin in scored]

    def auto_discover_plugins(
        self,
        plugin_names: list[str],
    ) -> dict[str, set[str]]:
        """Для списка плагинов — какие фичи они предоставляют.

        Args:
            plugin_names: Список имён плагинов.

        Returns:
            dict[plugin → set of features provided].
        """
        result: dict[str, set[str]] = {}
        for name in plugin_names:
            decl = self._declarations.get(name)
            if decl:
                result[name] = set(decl.provides)
        return result

    # ── Compute Order (Topological) ──

    def compute_order(self, features: list[str] | None = None) -> list[CapabilityInfo]:
        """Топологический порядок вычисления фич (зависимости первыми).

        Args:
            features: Список фич (или None = все известные).

        Returns:
            Топологически отсортированный список CapabilityInfo.

        Raises:
            FeatureGraphError: Если есть цикл или неизвестная фича.
        """
        names = features or [c.name for c in self._cap_reg.all()]
        try:
            return self._cap_reg.resolve(names)
        except Exception as e:
            raise FeatureGraphError(str(e)) from e

    # ── Integration ──

    def build_plugin_dependencies(
        self,
        report: FeatureResolution,
    ) -> dict[str, list[str]]:
        """Построить карту plugin → зависимые плагины на основе фич.

        Args:
            report: Результат FeatureResolution.

        Returns:
            dict[plugin → [dependent plugins]].
            Если plugin A requires фичу, которую provides plugin B,
            то A → B (A зависит от B).
        """
        deps: dict[str, list[str]] = {}
        for plugin, decl in self._declarations.items():
            deps.setdefault(plugin, [])
            for feature in decl.requires:
                provider = report.provider_map.get(feature)
                if provider and provider != plugin:
                    if provider not in deps[plugin]:
                        deps[plugin].append(provider)
        return deps

    # ── Utilities ──

    def _feature_is_required(self, feature: str) -> bool:
        """Проверить, что хотя бы один плагин требует эту фичу."""
        consumers = self._consumers.get(feature, [])
        # Если фича required хотя бы одним плагином — она "нужна"
        return len(consumers) > 0

    def summary(self) -> str:
        """Краткий отчёт о состоянии графа."""
        lines = [
            f"FeatureGraph: {len(self._declarations)} plugins, "
            f"{len(self._providers)} features",
        ]
        conflicts = self.find_conflicts()
        orphans = self.find_orphans()
        if conflicts:
            lines.append(f"  ⚠ Conflicts: {len(conflicts)}")
            for c in conflicts:
                lines.append(f"    - {c.feature}: {', '.join(c.plugins)}")
        if orphans:
            lines.append(f"  ⚠ Orphans (required but not provided): {len(orphans)}")
            for o in orphans:
                required_by = self._consumers.get(o, [])
                lines.append(f"    - {o} required by: {', '.join(required_by)}")
        if not conflicts and not orphans:
            lines.append("  ✓ No conflicts, no orphans")
        return "\n".join(lines)
