import * as fs from 'fs'
import * as path from 'path'

// Simulate main() auto-load
const mode = (process.env.MODE ?? 'paper') as 'mainnet' | 'testnet' | 'paper'
console.log('MODE:', mode)
if (mode !== 'paper') {
  const envFile = mode === 'mainnet' ? '.env.mainnet' : '.env.testnet'
  const envPath = path.join(process.cwd(), envFile)
  console.log('Loading env from:', envPath)
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const k = trimmed.slice(0, eqIdx).trim()
      const v = trimmed.slice(eqIdx + 1).trim()
      console.log(`  ${k}=${v ? v.slice(0, 6) + '...' : '(empty)'}`)
      if (!process.env[k]) process.env[k] = v
    }
  }
}
console.log('BYBIT_API_KEY in env:', process.env.BYBIT_API_KEY ? 'YES (' + process.env.BYBIT_API_KEY.slice(0, 6) + '...)' : 'NO')
console.log('BYBIT_API_SECRET in env:', process.env.BYBIT_API_SECRET ? 'YES (' + process.env.BYBIT_API_SECRET.slice(0, 6) + '...)' : 'NO')
