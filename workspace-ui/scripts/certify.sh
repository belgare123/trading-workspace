#!/usr/bin/env bash
# certify.sh — Cron wrapper for Certification Suite (Paper Trading)
#
# Launches the Certification Suite against Bybit public WS + PaperProvider.
# No API keys required.
#
# Usage:
#   ./scripts/certify.sh              # default BTCUSDT,ETHUSDT,SOLUSDT
#   SYMBOLS=BTCUSDT ./scripts/certify.sh  # single symbol
#
# Output: full certification report to stdout (captured by cron)

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"

# Defaults
SYMBOLS="${SYMBOLS:-BTCUSDT,ETHUSDT,SOLUSDT}"
PAPER_BALANCE="${PAPER_BALANCE:-10000}"

echo "[certify.sh] Starting Certification Suite..."
echo "  Symbols:  $SYMBOLS"
echo "  Balance:  $PAPER_BALANCE USDT"
echo "  Date:     $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "  Workdir:  $(pwd)"
echo "---"

npx tsx scripts/certify.ts --symbols "$SYMBOLS" --balance "$PAPER_BALANCE"

exit_code=$?
echo "---"
echo "[certify.sh] Exit code: $exit_code"
exit $exit_code
