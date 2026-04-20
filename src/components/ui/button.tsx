import { clsx } from 'clsx'

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
}

const sizes = {
  sm: 'text-xs px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-2 rounded-lg',
  lg: 'text-sm px-6 py-3 rounded-xl',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
