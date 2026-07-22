#!/usr/bin/env node
/* bybit-mainnet-campaign.ts — Bybit MainNet bootstrap (≈30 строк) */
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'
import { BybitBrokerAdapter } from '../src/workspace/live/brokers/BybitBrokerAdapter'
import { BybitExecutionGateway } from '../src/workspace/live/gateway/BybitExecutionGateway'
import { BUILTIN_RISK_RULES } from '../src/workspace/risk/builtins'
import { WorkspaceFactory } from '../src/workspace/trading'
import { PaperCampaign } from '../src/workspace/campaign/PaperCampaign'
import { CampaignMode } from '../src/workspace/campaign/types'
import { CampaignReporter } from '../src/workspace/campaign/CampaignReporter'
import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { SingletonGuard } from './demo/singleton-guard'
import * as path from 'path'

const apiKey = process.env.BYBIT_API_KEY!, apiSecret = process.env.BYBIT_API_SECRET!
if (!apiKey || !apiSecret) { console.error('❌ BYBIT_API_KEY & BYBIT_API_SECRET required'); process.exit(1) }
const symbols = (process.env.BYBIT_SYMBOLS ?? 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(s => s.trim())
const mode = (process.env.BYBIT_MODE ?? 'mini') as 'burn-in' | 'mini' | 'full'

const guard = new SingletonGuard({ name: 'bybit-mainnet-campaign' })
if (!guard.acquire()) { console.error('❌ Already running'); process.exit(0) }
process.on('exit', () => guard.release())

const feed = new LiveFeedRuntime()
feed.useAdapter(new BybitFeedAdapter())
for (const s of symbols) await feed.subscribe(s)

const ws = await WorkspaceFactory.create({
  name:'bybit-mainnet', mode:'live' as any, symbols,
  gateway: new BybitExecutionGateway(new BybitBrokerAdapter(), false),
  riskRules: BUILTIN_RISK_RULES,
})
const sd = path.resolve(process.env.BYBIT_STATE_DIR ?? '.bybit-mainnet-state')
const c = new PaperCampaign({mode:mode==='mini'?CampaignMode.MiniCampaign:CampaignMode.BurnIn,symbols,
  stateDir: path.join(sd,'paper-campaign'),
  onStageChange:s=>console.log('\n[Campaign] Stage →',s),
  onDailyReport:r=>CampaignReporter.printDailyReport(r),
  onBurnInComplete:r=>CampaignReporter.printBurnInResult(r),
  onFinalReport:r=>CampaignReporter.printFinalReport(r)})
c.setComponents({gateway:ws.gateway,feedRuntime:feed,broker:ws.broker!,certRuntime:{}as any})
for(const sig of['SIGINT','SIGTERM','SIGHUP'])process.on(sig,()=>c.requestStop())
await c.start()
