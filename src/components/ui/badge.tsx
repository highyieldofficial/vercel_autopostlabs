import { clsx } from 'clsx'

const variants = {
  default: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  brand: 'bg-brand-100 text-brand-700',
}

export type BadgeVariant = keyof typeof variants

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
