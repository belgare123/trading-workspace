/**
 * ServiceRegistry.ts — 2.0.x Service Registry.
 *
 * Central registry for all workspace-level services:
 * Notification, Settings, Dialogs, Theme, Clipboard, AI, Replay, etc.
 *
 * Services are registered during workspace initialization and
 * receive lifecycle callbacks (init / destroy).
 */

import type { ServiceDefinition, Service, ServiceRegistryApi } from './types'

type ServiceMap = Map<string, ServiceDefinition>

const services: ServiceMap = new Map()

export const ServiceRegistry: ServiceRegistryApi = {
  register(def: ServiceDefinition) {
    services.set(def.id, def)
  },

  unregister(serviceId: string) {
    services.delete(serviceId)
  },

  get<T extends Service>(serviceId: string): T | undefined {
    return services.get(serviceId)?.instance as T | undefined
  },

  list(): ServiceDefinition[] {
    return Array.from(services.values())
  },

  async initAll() {
    for (const [, def] of services) {
      if (def.instance.init) {
        await def.instance.init()
      }
    }
  },

  async destroyAll() {
    const entries = Array.from(services.entries()).reverse()
    for (const [, def] of entries) {
      if (def.instance.destroy) {
        await def.instance.destroy()
      }
    }
  },
}
