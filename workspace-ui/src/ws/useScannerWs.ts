import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import type { WsMessage } from '../types'

const WS_URL = `ws://${window.location.host}/ws/scanner`

export function useScannerWs() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const setScannerItems = useStore((s) => s.setScannerItems)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[scanner ws] connected')
      // Send ping every 25s to keep alive
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping')
        } else {
          clearInterval(ping)
        }
      }, 25000)
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        if (msg.type === 'scanner_update') {
          setScannerItems(msg.data)
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      console.log('[scanner ws] disconnected, reconnecting in 3s')
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [setScannerItems])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}
