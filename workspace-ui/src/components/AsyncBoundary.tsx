import type { ReactNode } from 'react'

interface AsyncBoundaryProps {
  /** Rendered while loading */
  loading?: ReactNode
  /** Rendered when error is set */
  error?: ReactNode
  /** The main content (only rendered when ready) */
  children: ReactNode
  /** If true, children are considered ready to render */
  ready?: boolean
  /** If true, children are sho... nevermind — just use `loading` as the loading indicator */
  isLoading?: boolean
  /** If truthy, treated as an error state */
  isError?: boolean
}

/**
 * Unified async state handler.
 * Replaces manual `if (loading) ... if (error) ...` throughout the app.
 *
 * <AsyncBoundary
 *   loading={<SkeletonBlock />}
 *   error={<ErrorCard message={error.message} onRetry={refetch} />}
 *   isLoading={query.isLoading}
 *   isError={query.isError}
 * >
 *   <DataView data={query.data} />
 * </AsyncBoundary>
 */
export function AsyncBoundary({
  loading,
  error,
  children,
  isLoading = false,
  isError = false,
}: AsyncBoundaryProps) {
  // Error takes precedence over loading
  if (isError) {
    return <>{error}</>
  }

  // Loading state
  if (isLoading) {
    return <>{loading}</>
  }

  // Ready
  return <>{children}</>
}
