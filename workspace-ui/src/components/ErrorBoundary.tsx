import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary — catches render errors and shows fallback.
 * Usage:
 *   <ErrorBoundary fallback={<ErrorCard error={error} retry={reset} />}>
 *     <MyPage />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        // Clone fallback with retry prop if it's a function
        if (typeof this.props.fallback === 'function') {
          return (this.props.fallback as any)({
            error: this.state.error,
            retry: this.handleRetry,
          })
        }
        return this.props.fallback
      }
      return (
        <DefaultErrorFallback
          error={this.state.error}
          retry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

// ── Default fallback ───────────────────────────────────────────────

function DefaultErrorFallback({
  error,
  retry,
}: {
  error: Error | null
  retry: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 12,
        color: '#e4e8ee',
      }}
    >
      <span style={{ fontSize: 32 }}>⚠️</span>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Something went wrong</div>
      <div style={{ fontSize: 11, color: '#5b6a7a', maxWidth: 400, textAlign: 'center' }}>
        {error?.message ?? 'An unexpected error occurred'}
      </div>
      <button
        onClick={retry}
        style={{
          padding: '6px 16px',
          fontSize: 12,
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        Retry
      </button>
    </div>
  )
}
