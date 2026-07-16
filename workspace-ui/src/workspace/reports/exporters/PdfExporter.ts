// ── PdfExporter — PDF export placeholder ──
//
// HTML-to-PDF via browser print or server-side puppeteer.
// For now delegates to HtmlExporter and marks as PDF-ready.
//
// @since 3.5.5

import type { ReportView } from '../types'
import { HtmlExporter } from './HtmlExporter'

export class PdfExporter {
  private _html = new HtmlExporter()

  export(report: ReportView): string {
    // Returns HTML styled for print (PDF via browser print / puppeteer)
    const html = this._html.export(report)
    return html.replace(
      '</head>',
      '<style>@media print{body{padding:0;background:#fff}.section{page-break-inside:avoid}}</style></head>',
    )
  }
}
