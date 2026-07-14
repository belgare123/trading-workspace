import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-surface-600 font-medium">{label}</label>}
      <input
        className={`px-3 py-1.5 rounded-lg bg-surface-200 border border-border text-sm text-surface-50 placeholder-surface-600 outline-none transition-colors focus:border-primary-500 ${className}`}
        {...props}
      />
    </div>
  )
}
