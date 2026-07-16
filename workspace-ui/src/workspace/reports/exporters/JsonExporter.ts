// ── JsonExporter — Export ReportView as JSON ──
//
// @since 3.5.5

import type { ReportView } from '../types'

export class JsonExporter {
  export(report: ReportView, pretty: boolean = true): string {
    return JSON.stringify(report, null, pretty ? 2 : undefined)
  }
}
