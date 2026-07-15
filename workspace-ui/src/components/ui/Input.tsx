import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</label>}
      <input className={`input ${className}`} {...props} />
    </div>
  )
}
