import type {
  ModelSummary,
  ModelDetail,
  TrainingRun,
  Experiment,
  EvaluateResult,
} from '../types'

const BASE = '/api/v1/ml'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`ML API ${res.status}: ${res.statusText}`)
  return res.json()
}

// ── Models ──

export function listModels(): Promise<ModelSummary[]> {
  return fetchJson<ModelSummary[]>(`${BASE}/models`)
}

export function getModel(id: string): Promise<ModelDetail> {
  return fetchJson<ModelDetail>(`${BASE}/models/${encodeURIComponent(id)}`)
}

// ── Training ──

export function startTraining(modelId: string): Promise<{ success: boolean; model_id: string; message: string }> {
  return fetchJson(`${BASE}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId }),
  })
}

export function getTrainingRun(modelId: string): Promise<TrainingRun> {
  return fetchJson<TrainingRun>(`${BASE}/train/${encodeURIComponent(modelId)}`)
}

// ── Evaluation ──

export function evaluateModel(modelId: string): Promise<EvaluateResult> {
  return fetchJson<EvaluateResult>(`${BASE}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId }),
  })
}

// ── Promotion ──

export function promoteModel(modelId: string, targetStatus?: string): Promise<{ success: boolean; model_id: string; status: string }> {
  return fetchJson(`${BASE}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId, target_status: targetStatus }),
  })
}

// ── Experiments ──

export function listExperiments(): Promise<Experiment[]> {
  return fetchJson<Experiment[]>(`${BASE}/experiments`)
}

export function getExperiment(id: string): Promise<Experiment> {
  return fetchJson<Experiment>(`${BASE}/experiments/${encodeURIComponent(id)}`)
}

// ── Metrics ──

export function getMetrics(modelId: string): Promise<TrainingRun> {
  return fetchJson<TrainingRun>(`${BASE}/metrics/${encodeURIComponent(modelId)}`)
}
