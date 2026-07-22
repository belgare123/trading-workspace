import * as fs from 'fs';
import * as path from 'path';
const envFile = '.env.mainnet';
const envPath = path.join(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  console.log('Found:', envPath);
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const t=line.trim();
    if(!t||t.startsWith('#')) continue;
    const i=t.indexOf('=');
    if(i===-1) continue;
    const k=t.slice(0,i).trim();
    const v=t.slice(i+1).trim();
    console.log('Setting:', k, '=', v ? v.slice(0,8)+'...' : '(empty)');
    if(!process.env[k]) process.env[k]=v;
  }
}
console.log('BYBIT_API_KEY loaded:', !!process.env.BYBIT_API_KEY);
console.log('BYBIT_API_SECRET loaded:', !!process.env.BYBIT_API_SECRET);
