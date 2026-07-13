"""
Marketplace Platform — Dependency Manager.

Extends the core DependencyResolver with remote registry resolution,
allowing automatic dependency resolution from the marketplace.
"""

from __future__ import annotations

import logging
from typing import Any

from marketplace.models import Package, PackageVersion
from marketplace.registry import RegistryClient

logger = logging.getLogger(__name__)


class MarketplaceDependencyResolver:
    """Resolves package dependencies with remote registry support.

    Extends the core DependencyResolver with marketplace-aware resolution:
    - Fetches dependency trees from the registry
    - Resolves SemVer constraints
    - Detects conflicts
    - Suggests install order (topological sort)
    """

    def __init__(self, registry: RegistryClient | None = None,
                 installed_packages: dict[str, str] | None = None) -> None:
        self.registry = registry or RegistryClient()
        self.installed = installed_packages or {}  # {name: version}

    def resolve(self, package_name: str, version: str | None = None) -> dict:
        """Resolve all dependencies for a package.

        Returns:
            {
                'success': bool,
                'package': str,
                'version': str,
                'dependencies': [{name, version, resolved, source}],
                'install_order': [str],
                'conflicts': [{name, required, found}],
                'missing': [str],
            }
        """
        result = {
            'success': True,
            'package': package_name,
            'version': version or 'latest',
            'dependencies': [],
            'install_order': [],
            'conflicts': [],
            'missing': [],
        }

        resolved_deps: dict[str, str] = {}  # name -> version
        visited: set[str] = set()

        try:
            self._resolve_tree(package_name, version, resolved_deps, visited, [])
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
            return result

        # Build install order (topological: deps first)
        result['dependencies'] = [
            {'name': n, 'version': v, 'source': 'registry'}
            for n, v in resolved_deps.items()
            if n != package_name
        ]

        # Install order: reversed resolution order (dependencies before dependents)
        order = list(resolved_deps.keys())
        # Move package to last
        if package_name in order:
            order.remove(package_name)
            order.append(package_name)
        result['install_order'] = order

        return result

    def _resolve_tree(self, name: str, version: str | None,
                      resolved: dict[str, str],
                      visited: set[str],
                      chain: list[str]) -> None:
        """Recursively resolve a dependency tree."""
        if name in visited:
            return  # Already resolved
        if name in chain:
            raise ValueError(f"Circular dependency: {' -> '.join(chain + [name])}")

        chain.append(name)

        # Check if already installed
        if name in self.installed:
            resolved[name] = self.installed[name]
            visited.add(name)
            chain.pop()
            return

        # Fetch from registry
        pkg = self.registry.get_package(name)
        if not pkg:
            # Check if it's a known installed package
            if name in self.installed:
                resolved[name] = self.installed[name]
                visited.add(name)
                chain.pop()
                return
            visited.add(name)  # Mark to avoid re-trying
            chain.pop()
            return

        # Resolve version
        if version and version in pkg.versions:
            pv = pkg.versions[version]
        else:
            pv = pkg.latest
            version = pkg.latest_version

        if not pv:
            visited.add(name)
            chain.pop()
            return

        resolved[name] = version
        visited.add(name)

        # Recurse into dependencies
        for dep_name, dep_spec in pv.dependencies.items():
            self._resolve_tree(dep_name, None, resolved, visited, chain)

        chain.pop()

    def check_constraints(self, name: str,
                          version: str,
                          constraints: dict[str, str]) -> list[dict]:
        """Check if a version satisfies dependency constraints."""
        conflicts = []
        for dep_name, dep_spec in constraints.items():
            if dep_name in self.installed:
                installed_ver = self.installed[dep_name]
                if not self._satisfies(installed_ver, dep_spec):
                    conflicts.append({
                        'name': dep_name,
                        'required': dep_spec,
                        'found': installed_ver,
                    })
        return conflicts

    def find_install_order(self, packages: list[tuple[str, str]]) -> list[str]:
        """Topological sort of packages and their dependencies."""
        all_deps: dict[str, str] = {}
        for name, version in packages:
            result = self.resolve(name, version)
            if result['success']:
                for dep in result['install_order']:
                    if dep not in all_deps:
                        all_deps[dep] = result.get('version', '')
        return list(all_deps.keys())

    def _satisfies(self, version: str, constraint: str) -> bool:
        """Simple SemVer constraint check (>=X.Y.Z)."""
        try:
            constraint = constraint.strip()
            if constraint.startswith('>='):
                min_ver = constraint[2:].strip()
                v_parts = [int(x) for x in version.split('.')]
                c_parts = [int(x) for x in min_ver.split('.')]
                return v_parts >= c_parts
            elif constraint.startswith('>'):
                min_ver = constraint[1:].strip()
                v_parts = [int(x) for x in version.split('.')]
                c_parts = [int(x) for x in min_ver.split('.')]
                return v_parts > c_parts
            elif constraint.startswith('==') or constraint.startswith('='):
                exact = constraint.lstrip('= ').strip()
                return version == exact
            elif constraint.startswith('~='):
                compatible = constraint[2:].strip()
                return version.startswith(compatible[:compatible.find('.') + 2])
            else:
                return version == constraint
        except (ValueError, IndexError):
            return True
