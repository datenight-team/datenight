import type { SeerrStatus } from '@/types'

const config: Record<SeerrStatus, { label: string; className: string; dotClassName: string }> = {
  available:     { label: 'Ready',       className: 'bg-success-bg text-success border-transparent', dotClassName: 'bg-success' },
  processing:    { label: 'Downloading', className: 'bg-downloading-bg text-downloading border-transparent', dotClassName: 'bg-downloading' },
  pending:       { label: 'Queued',      className: 'bg-queued-bg text-queued border-transparent', dotClassName: 'bg-queued' },
  not_requested: { label: 'Not Requested', className: 'bg-muted text-muted-foreground border-transparent', dotClassName: 'bg-muted-foreground' },
  deleted:       { label: 'Deleted',     className: 'bg-muted text-muted-foreground border-transparent', dotClassName: 'bg-muted-foreground' },
}

export function StatusBadge({ status }: { status: SeerrStatus }) {
  const { label, className, dotClassName } = config[status] ?? config.not_requested
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  )
}
