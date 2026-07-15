/**
 * Doc Validator — проверяет, что все публичные API задокументированы
 *
 * Запуск: npx tsx src/runtime/docs/validate-docs.ts
 *
 * Сверяет:
 *   1. Все экспорты из runtime/api/*.ts
 *   2. Все экспорты из runtime/*.ts (EventBus, PluginLoader, ...)
 *   3. Против ссылок в docs/ файлах
 *
 * Выводит отчёт о покрытии.
 *
 * @since 2.0.0
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname, basename, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const API_DIR = join(__dirname, '..', 'api')
const DOCS_DIR = join(__dirname, '..', 'docs')
const SRC_DIR = join(__dirname, '..')

interface ApiItem {
  file: string
  name: string
  kind: 'interface' | 'type' | 'function' | 'const' | 'export'
  documented: boolean
  docSource: string | null
}

function extractExports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const exports: string[] = []

  // Match: export interface Foo
  // Match: export type Foo
  // Match: export function foo
  // Match: export const foo
  // Match: export { foo }
  const patterns = [
    /export\s+(interface|type|function|const|class)\s+(\w+)/g,
    /export\s*\{\s*([\w,\s]+)\s*\}/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      if (pattern === patterns[0]) {
        exports.push(match[2])
      } else {
        exports.push(...match[1].split(',').map((s: string) => s.trim()))
      }
    }
  }

  return [...new Set(exports)].filter(Boolean)
}

function findDocReferences(name: string, docsDir: string): string | null {
  const files = readdirSync(docsDir, { recursive: true }).filter(
    (f: string) => typeof f === 'string' && f.endsWith('.md'),
  ) as string[]

  for (const file of files) {
    const content = readFileSync(join(docsDir, file), 'utf-8')
    if (content.includes(name)) {
      return file
    }
  }
  return null
}

function run(): void {
  console.log('═══════════════════════════════════════')
  console.log('  Documentation Validation Report')
  console.log('═══════════════════════════════════════')

  // Collect all API exports
  const allItems: ApiItem[] = []
  const apiFiles = readdirSync(API_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  console.log(`\n📁 Scanning API files (${apiFiles.length} files)...\n`)

  for (const file of apiFiles) {
    const filePath = join(API_DIR, file)
    const exports = extractExports(filePath)

    for (const name of exports) {
      const docRef = findDocReferences(name, DOCS_DIR)
      allItems.push({
        file: relative(__dirname, filePath),
        name,
        kind: name[0] === name[0]?.toUpperCase() ? 'interface/type' : 'function/const',
        documented: docRef !== null,
        docSource: docRef,
      })
    }
  }

  // Scan runtime root files
  const rootFiles = ['EventBus.ts', 'RuntimeEvent.ts', 'EventRegistry.ts', 'EventRecorder.ts',
    'PluginLoader.ts', 'RuntimeEvents.ts', 'types.ts', 'WidgetRegistry.ts']
  for (const file of rootFiles) {
    const filePath = join(SRC_DIR, file)
    if (!existsSync(filePath)) continue
    const exports = extractExports(filePath)
    for (const name of exports) {
      if (['RT', 'PluginLoader', 'WidgetRegistry', 'capabilityRegistry',
        'EventRecorder', 'EventRegistry', 'runtimeEventBus'].includes(name)) {
        continue // known top-level exports
      }
      const docRef = findDocReferences(name, DOCS_DIR)
      // Skip internal types
      if (name.startsWith('_')) continue
      if (['ComponentType'].includes(name)) continue
      allItems.push({
        file: relative(__dirname, filePath),
        name,
        kind: 'export',
        documented: docRef !== null,
        docSource: docRef,
      })
    }
  }

  // Report
  const documented = allItems.filter((i) => i.documented)
  const undocumented = allItems.filter((i) => !i.documented)

  console.log(`Total exports: ${allItems.length}`)
  console.log(`✅ Documented:  ${documented.length}`)
  console.log(`⚠️  Undocumented: ${undocumented.length}`)
  console.log(`Coverage: ${(documented.length / allItems.length * 100).toFixed(1)}%\n`)

  if (undocumented.length > 0) {
    console.log('Undocumented items:')
    for (const item of undocumented) {
      console.log(`  ⚠️  ${item.name} (${item.file})`)
    }
    console.log()
  }

  // Summary
  if (undocumented.length === 0) {
    console.log('✅ All public APIs are referenced in documentation.')
  } else {
    console.log(`ℹ️  ${undocumented.length} APIs found without doc references. Add them to docs/.`)
  }

  // Doc files with no API references
  const docFiles = readdirSync(DOCS_DIR, { recursive: true }).filter(
    (f: string) => typeof f === 'string' && f.endsWith('.md'),
  ) as string[]

  console.log(`\n📚 Documentation files: ${docFiles.length}`)
  const bigFiles = docFiles.filter((f: string) => {
    const content = readFileSync(join(DOCS_DIR, f), 'utf-8')
    return content.length > 5000
  })
  if (bigFiles.length > 0) {
    console.log(`Large docs (>5KB): ${bigFiles.map((f: string) => basename(f)).join(', ')}`)
  }
}

run()
