# 📊 Campaign Report

**Generated:** 2026-07-26T19:41:24.831Z
**Campaign:** paper-20260725
**Exchange:** bybit
**Strategy:** SmaCross
**Started:** 2026-07-25T17:07:30.113Z
**Mode:** campaign
**Duration:** 0.9 hours
**Snapshots used:** 55

## Executive Summary

**Verdict:** ✅ **PASS — All criteria met**

| Criteria | Status |
|---|---|
| Uptime | ✅ 26.6h |
| Reconnects | ✅ 0 reconnects |
| Exceptions | ✅ 0 exceptions |
| Memory stable | ✅ 35.0–48.6 MB |
| Snapshot continuity | ✅ 55/55 valid |

## Trading Performance

| Metric | Value |
|---|---|
| Total Trades | 5385 |
| Gross PnL (price spread) | $+10.28K |
| Total Fees | $-26.92K |
| **Net PnL (after fees)** | **$-16.64K** |
| ✅ Invariant: Gross − Fees == Net | $+10.28K − $+26.92K == $-16.64K |
| Largest Winner | $+5.00K |
| Largest Loser | $-3.02 |

## Risk Metrics

| Metric | Value |
|---|---|
| Max Drawdown | 5.73% ($+414.63) |
| Recovery Factor | -40.13 |
| Peak Equity | $+7.24K |
| Trough Equity | $+6.82K |
| Start Equity | $+7.24K |
| End Equity | $+6.82K |
| Largest Win | $+5.00K |
| Largest Loss | $-3.02 |

## Equity Curve

```
  Equity ($)

    7.2K │▄                                                
    7.2K │██████▄                                          
    7.2K │█████████████▄                                   
    7.1K │█████████████████▄                               
    7.1K │█████████████████████▄                           
    7.0K │█████████████████████████▄                       
    7.0K │██████████████████████████████▄                  
    7.0K │█████████████████████████████████▄               
    6.9K │███████████████████████████████████▄             
    6.9K │█████████████████████████████████████████▄       
    6.9K │█████████████████████████████████████████████████
    6.8K │█████████████████████████████████████████████████
         └─────────────────────────────────────────────────
         21:46                                   22:35
```

## Drawdown Curve

```
  Drawdown (%)

     0.0 │▄                                                
    -0.8 │██████████▄                                      
    -1.6 │██████████████████▄                              
    -2.5 │████████████████████████▄                        
    -3.3 │███████████████████████████████▄                 
    -4.1 │███████████████████████████████████▄             
    -4.9 │██████████████████████████████████████████████▄  
    -5.7 │█████████████████████████████████████████████████
         └─────────────────────────────────────────────────
         21:46                                   22:35
```

## System Health

| Metric | Min | Avg | Max |
|---|---|---|---|
| RSS (MB) | 35.0 | 41.6 | 48.6 |
| CPU (%) | 1.6 | 1.6 | 1.6 |

| Metric | Value |
|---|---|
| Total Reconnects | 0 |
| Total Exceptions | 0 |
| Valid Snapshots | 55 / 55 |
| GC Count | 46122 |
| GC Pause Max | 10.0 ms |
| Event Loop Avg | 0.0000 |
| Uptime | 26h 33m |

## Readiness Gate

**Gate status:** ✅ OPEN (7/7)

| Check | Status | Detail |
|---|---|---|
| Minimum uptime (24h) | ✅ | 26.6h |
| Zero reconnects | ✅ | 0 |
| Zero exceptions | ✅ | 0 |
| Stable memory | ✅ | 35.0–48.6 MB |
| Trades executed | ✅ | 5385 |
| Fee accounting active | ✅ | $-26.92K |
| Ledger invariants | ✅ | ✅ all ok (last snapshot) |

## Conclusions

✅ The system passed all readiness checks for this campaign.

**Strengths:**
- Zero reconnects and exceptions throughout the run
- Stable memory profile with no leaks
- Continuous snapshot recording without gaps
- All ledger invariants consistent

**Next steps:**
- 2. Increase replay count to 10,000+ trades
- 3. Run 7-day paper campaign for extended validation
- 4. Deploy Shadow Live (real quotes, no orders)
- 5. Transition to minimal real capital
