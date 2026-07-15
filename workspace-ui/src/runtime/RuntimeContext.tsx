'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { runtimeEventBus, type EventBus } from './EventBus';
import { Container } from './Container';
import { MarketService } from './services/MarketService';
import { ReplayService } from './services/ReplayService';
import { PluginService } from './services/PluginService';
import { PortfolioService } from './services/PortfolioService';
import { StrategyService } from './services/StrategyService';
import { MLService } from './services/MLService';
import { NotificationService } from './services/NotificationService';
import { SearchService } from './services/SearchService';
import { EventStoreService } from './services/EventStoreService';
import type { RuntimeApi, MarketApi, ReplayApi, PluginApi, RuntimeServicesProxy } from './types';

// ── Container setup ──
function createDefaultContainer(): Container {
  const c = new Container();
  c.register('market', new MarketService());
  c.register('replay', new ReplayService());
  c.register('plugin', new PluginService());
  c.register('portfolio', new PortfolioService());
  c.register('strategy', new StrategyService());
  c.register('ml', new MLService());
  c.register('notification', new NotificationService());
  c.register('search', new SearchService());
  c.register('eventStore', new EventStoreService());
  return c;
}

const defaultContainer = createDefaultContainer();

// ── RuntimeServicesProxy ──
function createServicesProxy(container: Container): RuntimeServicesProxy {
  const svc = container.getRuntimeServices();
  return {
    market: svc.market as unknown as MarketApi,
    replay: svc.replay as unknown as ReplayApi,
    plugins: svc.plugin as unknown as PluginApi,
    signals: { list: async () => [], subscribe: () => () => {} },
    system: {
      health: async () => ({ services: 100, plugins: 92, store: 100, replay: 100 }),
      services: async () => ['runtime', 'event-store', 'websocket', 'market-data', 'risk-engine'],
    },
    portfolio: svc.portfolio,
    strategy: svc.strategy,
    ml: svc.ml,
    notification: svc.notification,
    search: svc.search,
    eventStore: svc.eventStore,
  };
}

// ── RuntimeApi implementation ──
function createRuntimeApi(container: Container, events: EventBus): RuntimeApi {
  const svc = container.getRuntimeServices();
  const services = createServicesProxy(container);
  return {
    events,
    services,
    market: () => svc.market as unknown as MarketApi,
    replay: () => svc.replay as unknown as ReplayApi,
    system: () => services.system,
    plugins: () => svc.plugin as unknown as PluginApi,
    signals: () => services.signals,
  };
}

const defaultRuntimeApi = createRuntimeApi(defaultContainer, runtimeEventBus);

// ── Context ──
interface RuntimeContextValue {
  api: RuntimeApi;
  container: Container;
  events: EventBus;
}

const RuntimeContext = createContext<RuntimeContextValue>({
  api: defaultRuntimeApi,
  container: defaultContainer,
  events: runtimeEventBus,
});

interface RuntimeProviderProps {
  children: ReactNode;
  container?: Container;
  events?: EventBus;
  services?: Partial<RuntimeServicesProxy>;
}

export function RuntimeProvider({ children, container, events, services }: RuntimeProviderProps) {
  const actualContainer = container ?? defaultContainer;
  const actualEvents = events ?? runtimeEventBus;

  if (services) {
    for (const [key, svc] of Object.entries(services)) {
      if (svc) actualContainer.register(key, svc);
    }
  }

  const api = createRuntimeApi(actualContainer, actualEvents);

  return (
    <RuntimeContext.Provider value={{ api, container: actualContainer, events: actualEvents }}>
      {children}
    </RuntimeContext.Provider>
  );
}

// ── Hooks ──
export function useRuntime(): RuntimeApi {
  return useContext(RuntimeContext).api;
}

export function useContainer(): Container {
  return useContext(RuntimeContext).container;
}

export function useEventBus(): EventBus {
  return useContext(RuntimeContext).events;
}

export function useService<T>(name: string): T {
  return useContext(RuntimeContext).container.get<T>(name);
}
