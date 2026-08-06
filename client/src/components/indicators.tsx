import { PRIORITY_LABELS, ROLE_LABELS, type Priority, type Role } from '@shared/constants/enums';
import type { OrderSlaInfo, UserRef } from '@shared/types/index';
import { cn, fmtDuration, initials } from '../lib/format';

/**
 * Indicador de SLA. Nunca depende solo del color: siempre incluye icono y
 * texto, como exigen los criterios de accesibilidad.
 */
export function SlaBadge({ sla, compact = false }: { sla: OrderSlaInfo; compact?: boolean }) {
  const config = {
    NORMAL: { icon: '✓', label: 'En tiempo', className: 'border-success/40 bg-success-soft text-success' },
    WARNING: { icon: '▲', label: 'Proximo a vencer', className: 'border-warning/50 bg-warning-soft text-warning' },
    OVERDUE: { icon: '■', label: 'Atrasado', className: 'border-danger/40 bg-danger-soft text-danger' },
    NO_SLA: { icon: '—', label: 'Sin SLA', className: 'border-line bg-surface-muted text-muted' },
  }[sla.state];

  const detail =
    sla.state === 'OVERDUE'
      ? `Atrasado por ${fmtDuration(sla.minutesOverdue ?? 0)}`
      : sla.state === 'WARNING'
        ? `Vence en ${fmtDuration(Math.max(0, sla.minutesRemaining ?? 0))}`
        : sla.state === 'NORMAL'
          ? `Restan ${fmtDuration(Math.max(0, sla.minutesRemaining ?? 0))}`
          : 'Etapa sin tiempo configurado';

  return (
    <span
      title={detail}
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium',
        config.className,
      )}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{compact ? config.label : detail}</span>
      <span className="sr-only">{`Estado de SLA: ${config.label}. ${detail}.`}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const className = {
    LOW: 'border-line bg-surface-muted text-muted',
    NORMAL: 'border-line bg-surface-muted text-ink',
    HIGH: 'border-warning/50 bg-warning-soft text-warning',
    URGENT: 'border-danger/40 bg-danger-soft text-danger',
  }[priority];

  return (
    <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium', className)}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center rounded border border-line bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-ink">
      {ROLE_LABELS[role]}
    </span>
  );
}

export function Avatar({ user, size = 'md' }: { user: Pick<UserRef, 'name'> | null; size?: 'sm' | 'md' }) {
  const label = user?.name ?? 'Sin asignar';
  return (
    <span
      title={label}
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        user ? 'bg-brand-700' : 'bg-[var(--muted)]',
        size === 'sm' ? 'size-6 text-[10px]' : 'size-7 text-xs',
      )}
    >
      {user ? initials(user.name) : '—'}
    </span>
  );
}

export function AssigneeChip({ user }: { user: UserRef | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar user={user} size="sm" />
      <span className="truncate text-xs text-ink">{user?.name ?? 'Sin asignar'}</span>
    </span>
  );
}
