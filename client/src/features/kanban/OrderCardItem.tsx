import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';
import type { OrderCard } from '@shared/types/index';
import { AssigneeChip, PriorityBadge, SlaBadge } from '../../components/indicators';
import { Button } from '../../components/ui';
import { cn, fmtDate, fmtDuration } from '../../lib/format';

export interface OrderCardItemProps {
  order: OrderCard;
  draggable: boolean;
  onMove: (order: OrderCard) => void;
}

export function OrderCardItem({ order, draggable, onMove }: OrderCardItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    data: { order },
    disabled: !draggable,
  });

  return (
    <article
      ref={setNodeRef}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border border-line/80 bg-surface p-3.5 shadow-[0_8px_26px_-24px_rgba(65,45,31,0.7)] hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-tile)]',
        isDragging && 'opacity-40',
        order.isArchived && 'border-dashed opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/orders/${order.id}`}
            className="block truncate font-display text-sm font-semibold text-brand-900 hover:text-brand-700"
          >
            {order.orderCode}
          </Link>
          <p className="truncate text-xs text-muted">OC {order.purchaseOrderNumber}</p>
        </div>
        <PriorityBadge priority={order.priority} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{order.customerName}</p>
        <p className="truncate text-xs text-muted">{order.projectName}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AssigneeChip user={order.assignee} />
        <span className="text-xs text-muted tabular-nums">{order.quantity} u.</span>
      </div>

      <SlaBadge sla={order.sla} />

      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted">
        <dt className="sr-only">Tiempo en la etapa</dt>
        <dd>En etapa: {fmtDuration(order.sla.minutesInStage)}</dd>
        <dt className="sr-only">Entrada a la etapa</dt>
        <dd>Desde: {fmtDate(order.stageEnteredAt)}</dd>
        <dt className="sr-only">Fecha limite</dt>
        <dd className="col-span-2">
          Limite: {order.sla.dueAt ? fmtDate(order.sla.dueAt) : 'sin SLA'}
        </dd>
      </dl>

      <div className="flex items-center justify-between gap-2">
        {draggable ? (
          <button
            type="button"
            className="cursor-grab rounded-lg border border-line bg-background/70 px-2 py-1 text-[11px] font-medium text-muted hover:border-brand-300 hover:text-ink"
            aria-label={`Arrastrar la orden ${order.orderCode}`}
            {...attributes}
            {...listeners}
          >
            ⠿ Arrastrar
          </button>
        ) : (
          <span className="text-[11px] text-muted">Solo lectura</span>
        )}

        {draggable ? (
          <Button size="sm" variant="secondary" onClick={() => onMove(order)}>
            Mover
          </Button>
        ) : null}
      </div>
    </article>
  );
}
