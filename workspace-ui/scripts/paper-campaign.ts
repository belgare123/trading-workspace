#!/usr/bin/env node
/* paper-campaign.ts — Paper Campaign bootstrap (≈27 строк) */
import { PaperBrokerAdapter } from '../src/workspace/live/brokers/PaperBrokerAdapter'
import { PaperExecutionGateway } from '../src/workspace/live/gateway/PaperExecutionGateway'
import { BUILTIN_RISK_RULES } from '../src/workspace/risk/builtins'
import { WorkspaceFactory } from '../src/workspace/trading'
import { PaperCampaign } from '../src/workspace/campaign/PaperCampaign'
import { CampaignMode } from '../src/workspace/campaign/types'
import { CampaignReporter } from '../src/workspace/campaign/CampaignReporter'
import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'

const mode = (process.env.MODE ?? 'full') as 'burn-in' | 'full'
const symbols = (process.env.SYMBOLS ?? 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(s => s.trim())
const feed = new LiveFeedRuntime()
for (const s of symbols) { feed.useAdapter(new BybitFeedAdapter()); await feed.subscribe(s) }

const ws = await WorkspaceFactory.create({
  name:'paper', mode:'paper' as any, symbols,
  gateway: new PaperExecutionGateway(new PaperBrokerAdapter(feed,{symbols,initialBalance:10000,commissionRate:.001})),
  riskRules: BUILTIN_RISK_RULES,
})
const c = new PaperCampaign({mode:mode==='burn-in'?CampaignMode.BurnIn:CampaignMode.FullCampaign,symbols,
  onStageChange:s=>console.log('\n[Campaign] Stage →',s),
  onDailyReport:r=>CampaignReporter.printDailyReport(r),
  onBurnInComplete:r=>CampaignReporter.printBurnInResult(r),
  onFinalReport:r=>CampaignReporter.printFinalReport(r)})
c.setComponents({gateway:ws.gateway,feedRuntime:feed,broker:ws.broker!,certRuntime:{}as any})
for(const sig of['SIGINT','SIGTERM'])process.on(sig,()=>c.requestStop())
await c.start()
