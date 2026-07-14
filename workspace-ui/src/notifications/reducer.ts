import type { NotificationState, NotificationAction } from './types'

const MAX_HISTORY = 100

export function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  switch (action.type) {
    case 'ADD':
      return {
        ...state,
        active: [...state.active, action.notification],
        history: [action.notification, ...state.history].slice(0, MAX_HISTORY),
        unseenCount: state.unseenCount + 1,
      }

    case 'DISMISS':
      return {
        ...state,
        active: state.active.map((n) =>
          n.id === action.id ? { ...n, dismissing: true } : n,
        ),
      }

    case 'REMOVE':
      return {
        ...state,
        active: state.active.filter((n) => n.id !== action.id),
      }

    case 'CLEAR':
      return {
        ...state,
        active: [],
        unseenCount: 0,
      }

    case 'MARK_SEEN':
      return {
        ...state,
        unseenCount: 0,
      }

    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: [],
        unseenCount: 0,
      }

    default:
      return state
  }
}
