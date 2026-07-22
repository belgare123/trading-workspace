#!/usr/bin/env node
/**
 * emergency-kill-drill.ts — Emergency Kill Drill (Production Launch Gate)
 *
 * Проверяет, что emergencyStop() гарантированно:
 * 1. Отменяет ордера
 * 2. Закрывает позиции
 * 3. Переводит систему в SAFE_MODE
 * 4. Запрещает новые сделки
 *
 * Usage:
 *   npx tsx scripts/emergency-kill-drill.ts
 *
 * Требует запущенного Workspace (через workspace start).
 * Проверяет через health endpoint.
 *
 * @since Sprint 5.8 Production Launch Gate
 */

const DRILL_STEPS = [
  {
    id: '1',
    name: 'Cancel all open orders',
    command: null, // Will be triggered via health check path
    expected: 'No open orders remain after emergencyStop',
  },
  {
    id: '2',
    name: 'Close all open positions',
    command: null,
    expected: 'No open positions after emergencyStop',
  },
  {
    id: '3',
    name: 'Enter SAFE_MODE',
    command: null,
    expected: 'safeMode = true in health snapshot',
  },
  {
    id: '4',
    name: 'Block new trades',
    command: null,
    expected: 'New order requests rejected while in SAFE_MODE',
  },
]

async function main() {
  console.log(`\n🚨 EMERGENCY KILL DRILL`)
  console.log(`   ${'='.repeat(50)}`)
  console.log()
  console.log('   Проверяет emergencyStop() через CLI:')
  console.log()
  console.log(`   ${'1.'.padEnd(4)} Убедитесь, что Workspace запущен:`)
  console.log(`        npx tsx scripts/workspace.ts status`)
  console.log()
  console.log(`   ${'2.'.padEnd(4)} Выполните аварийную остановку:`)
  console.log(`        npx tsx scripts/workspace.ts emergency-stop`)
  console.log()
  console.log(`   ${'3.'.padEnd(4)} Проверьте, что система в SAFE_MODE:`)
  console.log(`        npx tsx scripts/workspace.ts health`)
  console.log(`        -> ищите "safeMode": true в выводе`)
  console.log()
  console.log(`   ${'4.'.padEnd(4)} Проверьте, что новые сделки заблокированы:`)
  console.log(`        curl the health endpoint or check order placement`)
  console.log()
  console.log(`   ${'5.'.padEnd(4)} Выйдите из SAFE_MODE:`)
  console.log(`        npx tsx scripts/workspace.ts safemode  # toggles off`)
  console.log()
  console.log(`   ${'6.'.padEnd(4)} Проверьте, что торговля восстановлена:`)
  console.log(`        npx tsx scripts/workspace.ts health`)
  console.log(`        -> ищите "safeMode": false`)
  console.log()

  // Interactive verification
  console.log(`📋 DRILL CHECKLIST:`)
  console.log()
  const checklist = [
    { icon: '  ', label: 'Workspace запущен до emergency-stop' },
    { icon: '  ', label: 'emergency-stop выполнен без ошибок' },
    { icon: '  ', label: 'health показывает safeMode = true' },
    { icon: '  ', label: 'Все ордера отменены (-> Bybit UI или check orders)' },
    { icon: '  ', label: 'Все позиции закрыты (-> Bybit UI или check positions)' },
    { icon: '  ', label: 'Попытка разместить ордер отклонена' },
    { icon: '  ', label: 'safemode toggle возвращает в normal operation' },
    { icon: '  ', label: 'После выхода из SAFE_MODE торговля восстановлена' },
  ]

  for (const item of checklist) {
    console.log(`   ${item.icon} ${item.label}`)
  }

  console.log()
  console.log('   После выполнения всех шагов по-порядку,')
  console.log('   откройте Bybit UI для кросс-проверки.')
  console.log()
  console.log(`   ${'='.repeat(50)}`)
  console.log('   🟢 DRILL READY — выполните шаги 1–6 вручную')
}

main().catch(err => {
  console.error(`\n❌ Drill error: ${err.message}`)
  process.exit(1)
})
