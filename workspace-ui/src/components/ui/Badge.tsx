type BadgeVariant = 'default' | 'primary' | 'green' | 'red' | 'yellow' | 'cyan'

interface BadgeProps {
  children: string | number
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'color: var(--text-muted); background: rgba(92,99,114,0.08)',
  primary: 'color: var(--primary); background: rgba(59,130,246,0.08)',
  green: 'color: var(--success); background: rgba(46,189,122,0.08)',
  red: 'color: var(--danger); background: rgba(228,86,106,0.08)',
  yellow: 'color: var(--warning); background: rgba(212,168,71,0.08)',
  cyan: 'color: #5bc0de; background: rgba(91,192,222,0.08)',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ ...parseStyle(variantStyles[variant]), border: '1px solid rgba(255,255,255,0.04)' }}
    >
      {children}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  const variant: BadgeVariant = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'default'
  return <Badge variant={variant}>{score}</Badge>
}

function parseStyle(style: string): React.CSSProperties {
  const obj: Record<string, string> = {}
  style.split(';').forEach((s) => {
    const [k, v] = s.split(':').map((x) => x.trim())
    if (k && v) {
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      obj[camel] = v
    }
  })
  return obj
}
