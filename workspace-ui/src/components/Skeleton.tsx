interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  style?: React.CSSProperties
}

/** Single animated skeleton block */
export function Skeleton({
  width = '100%',
  height = 14,
  borderRadius = 6,
  style,
}: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #1a1b1e 25%, #25262b 50%, #1a1b1e 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/** Skeleton line (like a text line) */
export function SkeletonLine({ width = '100%' }: { width?: number | string }) {
  return <Skeleton width={width} height={14} style={{ marginBottom: 8 }} />
}

/** Skeleton card */
export function SkeletonCard() {
  return (
    <div
      style={{
        padding: 16,
        background: '#141517',
        border: '1px solid #2c2e33',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Skeleton width="60%" height={16} />
      <Skeleton width="90%" height={12} />
      <Skeleton width="40%" height={12} />
    </div>
  )
}

/** Skeleton table (rows) */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 12,
          padding: '8px 12px',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} height={11} borderRadius={4} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
            padding: '10px 12px',
            borderTop: '1px solid #2c2e33',
          }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`r${r}-c${c}`} height={12} borderRadius={4} width={c === 0 ? '70%' : '100%'} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Skeleton block (large area) */
export function SkeletonBlock({ height = 200 }: { height?: number }) {
  return (
    <div
      style={{
        padding: 20,
        background: '#141517',
        border: '1px solid #2c2e33',
        borderRadius: 8,
      }}
    >
      <Skeleton width="50%" height={18} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={height - 80} borderRadius={6} />
      <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <Skeleton width="30%" height={12} />
        <Skeleton width="25%" height={12} />
      </div>
    </div>
  )
}
