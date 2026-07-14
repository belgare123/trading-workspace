import { create } from 'zustand'
import type { TimelineState } from './types'

const MAX_EVENTS = 500

/** Global timeline store — single source of truth for all platform events. */
export const useTimelineStore = create<TimelineState>((set) => ({
  events: [],
  selectedEvent: null,

  addEvent: (event) =>
    set((state) => {
      // Deduplicate by id
      if (state.events.some((e) => e.id === event.id)) return state
      return {
        events: [event, ...state.events].slice(0, MAX_EVENTS),
      }
    }),

  selectEvent: (event) => set({ selectedEvent: event }),

  clear: () => set({ events: [], selectedEvent: null }),
}))
