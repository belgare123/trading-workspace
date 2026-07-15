export const mlSnippet = `// Emit ML prediction result
console.log('🧠 Running ML prediction...')

const prediction = {
  modelId: 'price-predictor',
  prediction: 45000 + Math.random() * 2000,
  confidence: 0.75 + Math.random() * 0.2,
  timestamp: Date.now(),
  features: {
    rsi: 62,
    macd: 145,
    volume: 1.2e6,
  },
}

runtimeEventBus.emit('ml.predict', prediction, {
  source: 'MLPredictor',
  severity: 'info',
  tags: ['ml', 'prediction'],
})

console.log('✅ ML prediction:', JSON.stringify(prediction, null, 2))`
