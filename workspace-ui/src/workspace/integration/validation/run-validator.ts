import { WorkspacePersistenceValidator } from './WorkspacePersistenceValidator'
import type { ValidationStep } from './WorkspacePersistenceValidator'

const validator = new WorkspacePersistenceValidator()
const report = validator.run()

console.log(`\n╔══════════════════════════════════════════╗`)
console.log(`║   Workspace Persistence Validation       ║`)
console.log(`╚══════════════════════════════════════════╝`)
console.log(`\nTimestamp: ${report.timestamp}`)
console.log(`\nResults: ${report.passed}/${report.total} passed, ${report.failed} failed\n`)

// Group by level
const byLevel: Record<number, ValidationStep[]> = {}
for (const step of report.steps) {
  if (!byLevel[step.level]) byLevel[step.level] = []
  byLevel[step.level].push(step)
}

for (const level of Object.keys(byLevel).map(Number).sort()) {
  const steps = byLevel[level]
  const levelPassed = steps.filter(s => s.passed).length
  const levelFailed = steps.filter(s => !s.passed).length
  const levelNames = ['Round-trip', 'Version Migration', 'Auto-save', 'Full Scenario', 'Regression']
  console.log(`\nLevel ${level} — ${levelNames[level - 1]} (${levelPassed}/${steps.length})`)
  for (const step of steps) {
    const icon = step.passed ? '✅' : '❌'
    console.log(`  ${icon} ${step.name}: ${step.detail}`)
  }
}

console.log(`\n${'─'.repeat(46)}`)
if (report.failed === 0) {
  console.log(`\n🎉 ALL ${report.total} VALIDATION TESTS PASSED\n`)
} else {
  console.log(`\n⚠️  ${report.failed}/${report.total} tests FAILED\n`)
}

export {}
