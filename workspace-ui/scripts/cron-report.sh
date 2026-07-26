#!/bin/bash
# cron-report.sh — Generate a campaign report snapshot for cron delivery
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

CAMPAIGN_ID="${1:-}"

if [ -z "$CAMPAIGN_ID" ]; then
  CAMPAIGN_ID=$(npx tsx scripts/campaign-report.ts --list-campaigns 2>/dev/null | tail -n +4 | head -1 | awk '{print $1}' || true)
fi

if [ -z "$CAMPAIGN_ID" ]; then
  echo "⚠️ No campaign data found"
  exit 0
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTFILE="reports/campaign-${CAMPAIGN_ID}-${TIMESTAMP}.md"

# Generate full report
npx tsx scripts/campaign-report.ts --campaign-id "$CAMPAIGN_ID" --output "$OUTFILE" 2>/dev/null

# Simple extraction — find the row in the markdown table, grab 3rd pipe-delimited field
val() {
  local line
  line=$(grep -m1 "^| $1 |" "$OUTFILE" 2>/dev/null || true)
  if [ -n "$line" ]; then
    echo "$line" | awk -F'|' '{gsub(/^[[:space:]]*|[[:space:]]*\*\**$/,"",$3); print $3}'
  fi
}

DURATION=$(sed -n 's/.*\*\*Duration:\*\* \([0-9.]*\).*/\1h/p' "$OUTFILE")
TRADES=$(val "Total Trades")
GROSS=$(val "Gross PnL (price spread)")
FEES=$(val "Total Fees")
NET=$(grep -m1 'Net PnL' "$OUTFILE" | awk -F'|' '{gsub(/[* ]/,"",$3); print $3}')
EQUITY=$(val "End Equity")
DD=$(grep -m1 'Max Drawdown' "$OUTFILE" | grep -oE '[0-9.]+%' || true)
RECON=$(val "Total Reconnects")
EXC=$(val "Total Exceptions")
SNAP=$(grep -m1 'Valid Snapshots' "$OUTFILE" | awk -F'|' '{gsub(/^[[:space:]]*|[[:space:]]*$/,"",$3); print $3}')

echo "📊 Campaign Progress — ${CAMPAIGN_ID}"
echo "🕐 ${DURATION:-?}  |  Trades: ${TRADES:-?}"
echo "💰 Gross: ${GROSS:-?}  |  Fees: ${FEES:-?}  |  Net: ${NET:-?}"
echo "📉 Equity: ${EQUITY:-?}  |  Max DD: ${DD:-?}"
echo "🟢 Reconnects: ${RECON:-?}  |  Exceptions: ${EXC:-?}"
echo "💾 Snapshots: ${SNAP:-?}"
echo "---"
echo "📄 Full report: ${OUTFILE}"
