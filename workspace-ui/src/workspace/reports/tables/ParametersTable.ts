// ── ParametersTable — Strategy parameters table ──
//
// @since 3.5.5

export interface ParametersTableData {
  columns: { id: string; label: string; align?: 'left' | 'right' }[]
  rows: Record<string, string>[]
}

export function buildParametersTable(params: Record<string, unknown>): ParametersTableData {
  return {
    columns: [
      { id: 'param', label: 'Parameter', align: 'left' },
      { id: 'value', label: 'Value', align: 'right' },
    ],
    rows: Object.entries(params).map(([id, value]) => ({
      param: id,
      value: String(value),
    })),
  }
}
