#!/usr/bin/env python
"""API Audit — обход публичных модулей для RC Validation.

Проверяет:
  - Какие символы экспортируются через __all__
  - Нет ли внутренних классов/функций в __all__
  - Нет ли дублирования (один символ в нескольких __all__ разных модулей)
  - Собирает статистику по модулям

Usage:
    python scripts/api_audit.py
"""
import ast
import os
import sys
from collections import defaultdict
from pathlib import Path


def find_all_files(root: str) -> list[Path]:
    """Find all __init__.py files recursively."""
    return list(Path(root).rglob("__init__.py"))


def extract_all(path: Path) -> list[str]:
    """Parse __all__ from an __init__.py file."""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8", errors="replace"))
    except SyntaxError:
        return []
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__all__":
                    if isinstance(node.value, ast.List):
                        return [
                            elt.value
                            for elt in node.value.elts
                            if isinstance(elt, ast.Constant)
                        ]
    return []


def is_internal(name: str) -> bool:
    """Heuristic: underscore-prefixed names are internal."""
    if name.startswith("_"):
        return True
    # patterns like _FooBar, __all__
    return False


def classify(name: str):
    if name.islower():
        return "function/var"
    if name[0].isupper():
        return "class"
    return "other"


def main():
    root = Path(__file__).resolve().parents[1]
    domains = ["core", "marketplace", "screener_sdk"]

    print("=" * 60)
    print("  API Audit — Public API Review")
    print("=" * 60)

    all_exports: dict[str, list[tuple[str, str]]] = defaultdict(list)
    by_domain: dict[str, list[dict]] = defaultdict(list)
    red_flags = []

    for domain in domains:
        domain_path = root / domain
        if not domain_path.exists():
            print(f"  ⚠ Domain '{domain}' not found, skipping")
            continue

        init_files = find_all_files(str(domain_path))
        print(f"\n  ── {domain}/ ({len(init_files)} packages) ──")

        for init_file in sorted(init_files):
            rel = init_file.relative_to(root)
            symbols = extract_all(init_file)
            if not symbols:
                continue

            pkg_name = str(rel.parent).replace(os.sep, ".")

            for sym in symbols:
                all_exports[sym].append((pkg_name, str(rel)))
                entry = {"pkg": pkg_name, "sym": sym, "type": classify(sym)}
                by_domain[domain].append(entry)

                if is_internal(sym):
                    red_flags.append(f"    ⚠ {pkg_name}: '{sym}' — похоже на внутренний символ")

            if len(symbols) <= 2:
                continue
            print(f"    {pkg_name}: {len(symbols)} symbols")

    # ── Summary by domain ──
    print(f"\n{'=' * 60}")
    print("  Domain Summary")
    print(f"{'=' * 60}")
    for domain, entries in sorted(by_domain.items()):
        classes = sum(1 for e in entries if e["type"] == "class")
        funcs = sum(1 for e in entries if e["type"] == "function/var")
        pkgs = len(set(e["pkg"] for e in entries))
        print(f"  {domain:20s}  {len(entries):4d} symbols  "
              f"({classes:3d} classes, {funcs:3d} funcs/var)  "
              f"in {pkgs} packages")

    # ── Duplicates ──
    print(f"\n{'=' * 60}")
    print("  Duplicate Exports (same symbol in multiple packages)")
    print(f"{'=' * 60}")
    dupes = [(sym, places) for sym, places in all_exports.items() if len(places) > 1]
    if dupes:
        for sym, places in sorted(dupes):
            pkgs = ", ".join(p for p, _ in places)
            print(f"  • {sym:30s} → {pkgs}")
    else:
        print("  ✅ No duplicate exports found")

    # ── Internal symbols in __all__ ──
    print(f"\n{'=' * 60}")
    print("  Red Flags — Internal-looking symbols in __all__")
    print(f"{'=' * 60}")
    if red_flags:
        for flag in sorted(set(red_flags)):
            print(flag)
    else:
        print("  ✅ No internal symbols in public API")

    # ── Report ──
    total_symbols = len(all_exports)
    total_packages = len({
        pkg for places in all_exports.values() for pkg, _ in places
    })
    print(f"\n{'=' * 60}")
    print(f"  Total: {total_symbols} unique symbols across {total_packages} packages")
    print(f"  Domains: {', '.join(domains)}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
