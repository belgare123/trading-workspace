import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-600',
  secondary: 'bg-surface-300 text-surface-50 hover:bg-surface-400 border border-border',
  ghost: 'text-surface-600 hover:text-surface-700 hover:bg-surface-300',
  danger: 'bg-accent-red/10 text-accent-red hover:bg-accent-red/20 border border-accent-red/20',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs rounded-md',
  md: 'px-3 py-1.5 text-sm rounded-lg',
  lg: 'px-4 py-2 text-sm rounded-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
