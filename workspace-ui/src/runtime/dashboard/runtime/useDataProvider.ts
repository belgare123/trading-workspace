import { useEffect, useState } from 'react'
import { DataProviderRegistry } from '../data/DataProviderRegistry'
import { useRuntime } from '../../RuntimeContext'

/**
 * Subscribe to a WidgetDataProvider by ID.
 * Handles lifecycle: subscribe on mount, unsubscribe on unmount.
 */
export function useDataProvider<T = unknown>(providerId: string): T | undefined {
  const runtime = useRuntime()
  const [data, setData] = useState<T | undefined>()

  useEffect(() => {
    const provider = DataProviderRegistry.get<T>(providerId)
    if (!provider) {
      console.warn(`[useDataProvider] No provider registered for '${providerId}'`)
      return
    }

    const unsubscribe = provider.subscribe(runtime, (next: T) => {
      setData(next)
    })

    return () => {
      unsubscribe()
    }
  }, [providerId, runtime])

  return data
}
