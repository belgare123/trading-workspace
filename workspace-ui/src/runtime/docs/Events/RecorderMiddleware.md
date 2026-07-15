# Event Recorder

> **Source:** `runtime/EventRecorder.ts`

## Overview

EventRecorder records all events into a ring buffer. It is part of Runtime, not DevTools. Profiler Studio and DevTools subscribe to its live stream.

```typescript
import { EventRecorder } from '../runtime/EventRecorder'

// Start capturing all events
EventRecorder.start()

// Pause / Resume
EventRecorder.pause()
EventRecorder.resume()

// Stop and get buffer
const events = EventRecorder.stop()
console.log(`Captured ${events.length} events`)

// Save to localStorage
const key = EventRecorder.save('session-1')

// Load and inspect
const saved = EventRecorder.load(key!)

// List saved recordings
const recordings = EventRecorder.listSaved()

// Live stream for Profiler
EventRecorder.onEvent((event) => {
  profiler.update(event)
})
```

# Middleware Pipeline

> **Source:** `runtime/EventBus.ts`

## Overview

Middleware intercepts every event before it reaches subscribers. Express-style pipeline.

```typescript
runtimeEventBus.use((event, next) => {
  console.log(`[${event.topic}] ${event.source}`)
  next()
})
```

## Built-in Middleware

| Middleware | Description |
|-----------|-------------|
| `loggingMiddleware` | Console.log every event |
| `metricsMiddleware` | Count events by topic |

## Custom Middleware

```typescript
runtimeEventBus.use((event, next) => {
  // Pre-processing
  const start = performance.now()

  next()

  // Post-processing
  const duration = performance.now() - start
  if (duration > 100) {
    console.warn(`Slow event handler: ${event.topic} (${duration}ms)`)
  }
})
```
