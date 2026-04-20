import { Button } from './button'

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">{description}</p>
      {action && (
        action.href ? (
          <a href={action.href}>
            <Button>{action.label}</Button>
          </a>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  )
}
