import { Badge } from './badge'
import type { BadgeVariant } from './badge'

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  pending:     { label: 'Pending',     variant: 'default' },
  in_progress: { label: 'Scanning…',  variant: 'blue' },
  completed:   { label: 'Ready',       variant: 'green' },
  failed:      { label: 'Failed',      variant: 'red' },
}

export function IngestionStatus({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
