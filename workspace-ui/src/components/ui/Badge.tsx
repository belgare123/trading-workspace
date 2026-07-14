type BadgeVariant = 'default' | 'primary' | 'green' | 'red' | 'yellow' | 'cyan'

interface BadgeProps {
  children: string | number
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-400 text-surface-700',
  primary: 'bg-primary-500/10 text-primary-400',
  green: 'bg-accent-green/10 text-accent-green',
  red: 'bg-accent-red/10 text-accent-red',
  yellow: 'bg-accent-yellow/10 text-accent-yellow',
  cyan: 'bg-accent-cyan/10 text-accent-cyan',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  const variant: BadgeVariant = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'default'
  return <Badge variant={variant}>{score}</Badge>
}
