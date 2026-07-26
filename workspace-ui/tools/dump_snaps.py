#!/usr/bin/env python3
import os, json

tmp = os.environ.get('TMP', os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'Temp'))
fpath = os.path.join(tmp, 'paper-campaign', 'metrics', 'snapshots.jsonl')
print('Reading:', fpath)

with open(fpath) as f:
    lines = [l.strip() for l in f if l.strip()]
print('Total lines:', len(lines))

from collections import defaultdict
groups = defaultdict(list)
for l in lines:
    d = json.loads(l)
    groups[d['campaign']['id']].append(d)

for cid, snaps in groups.items():
    first = snaps[0]
    last = snaps[-1]
    dur = (last['timestamp'] - first['timestamp']) / 3600000
    has_m2 = 'winningTrades' in last['trading']
    print(f'\n  {cid}: {len(snaps)} snaps, {dur:.2f}h')
    print(f'    PID={last["runtime"]["pid"]}, uptime={last["runtime"]["uptimeSec"]/3600:.1f}h')
    print(f'    Equity: {last["trading"]["equity"]}, trades: {last["trading"]["tradesRecorded"]}')
    print(f'    RealisedPnL: {last["trading"]["realisedPnl"]}, fees: {last["trading"]["totalFees"]}')
    if has_m2:
        print(f'    W/L: {last["trading"]["winningTrades"]}W/{last["trading"]["losingTrades"]}L, WinRate: {last["trading"]["winRate"]*100:.1f}%')
