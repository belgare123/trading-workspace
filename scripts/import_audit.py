#!/usr/bin/env bash
"""Import Audit — измерение времени импорта ключевых модулей.

Использует python -X importtime для профилирования.

Usage:
    bash scripts/import_audit.sh  # or: python scripts/import_audit.py
"""
import subprocess
import sys
from pathlib import Path

MODULES = [
    "core",
    "marketplace",
    "screener_sdk",
    "core.event_store",
    "core.event_store.models",
    "core.replay",
    "marketplace.models",
    "marketplace.registry",
    "workspace.main",
]


def measure_import(module: str) -> dict:
    """Measure import time using -X importtime."""
    code = f"import {module}"

    result = subprocess.run(
        [sys.executable, "-X", "importtime", "-c", code],
        capture_output=True,
        text=True,
        timeout=30,
    )
    # Parse the last line of import time output
    lines = result.stderr.strip().split("\n")
    total_ms = 0
    cumulative = ""
    for line in lines:
        if "import time:" in line:
            cumulative = line
            try:
                # typical: "import time: 362 | import time: 152 | ... | import time: 521"
                parts = line.split("|")
                total_ms = int(parts[-1].strip().split()[-1])
            except (ValueError, IndexError):
                total_ms = 0

    return {
        "module": module,
        "total_ms": total_ms,
        "lines": len(lines),
        "cumulative": cumulative[:200],
    }


def main():
    print("=" * 55)
    print("  Import Audit — Import Time Profiling")
    print("=" * 55)
    print(f"\n  Python: {sys.executable}")
    print(f"  CWD:    {Path.cwd()}")
    print()

    results = []
    for mod in MODULES:
        print(f"  → {mod:35s} ...", end=" ", flush=True)
        try:
            r = measure_import(mod)
            results.append(r)
            if r["total_ms"] > 0:
                print(f"{r['total_ms']:>5} ms  ({r['lines']} lines)")
            else:
                print(f"{r['lines']} lines (parse ?)")
        except Exception as e:
            print(f"ERROR: {e}")

    # Summary
    print(f"\n{'=' * 55}")
    print("  Results")
    print(f"{'=' * 55}")

    total = 0
    for r in sorted(results, key=lambda x: x["total_ms"], reverse=True):
        bar = "█" * min(r["total_ms"] // 10, 40)
        print(f"  {r['module']:35s} {r['total_ms']:>5} ms  {bar}")
        total += r["total_ms"]

    print(f"\n  {'TOTAL':35s} {total:>5} ms")
    print(f"{'=' * 55}")

    # Red flags
    slow = [r for r in results if r["total_ms"] > 200]
    if slow:
        print(f"\n  ⚠ Slow imports (>200ms):")
        for r in slow:
            print(f"    • {r['module']}: {r['total_ms']}ms")

    # Save report
    import json
    report = {
        "tool": "import_audit",
        "python": sys.executable,
        "timestamp": __import__("time").time(),
        "modules": results,
    }
    report_path = Path(__file__).resolve().parent.parent / "docs" / "import-audit-report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\n  Report saved to {report_path}")


if __name__ == "__main__":
    main()
