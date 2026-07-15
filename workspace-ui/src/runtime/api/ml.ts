/**
 * ML Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Управление ML-моделями: предсказания, обучение, списки моделей.
 * Изменение сигнатур методов запрещено.
 */

export const ML_TOPICS = {
  MODEL_STATUS: 'ml.model.status' as const,
  TRAINING_DONE:'ml.training.done' as const,
  PREDICTION:   'ml.prediction'   as const,
} as const

export interface MLModel {
  id: string
  name: string
  type: 'classification' | 'regression' | 'clustering'
  status: 'ready' | 'training' | 'error'
  accuracy?: number
}

export interface MLApi {
  readonly id: 'ml'

  /** Список доступных моделей */
  models(): Promise<MLModel[]>

  /** Получить предсказание */
  predict(modelId: string, input: unknown): Promise<unknown>

  /** Запустить обучение модели */
  train(modelId: string, config?: unknown): Promise<void>

  /** Подписаться на статус модели */
  onModelStatus(cb: (model: MLModel) => void): () => void
}

export const ML_API_VERSION = '1.0.0'
