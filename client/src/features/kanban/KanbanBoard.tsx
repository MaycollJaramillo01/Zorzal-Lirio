import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { OrderCard, StageDto } from '@shared/types/index';
import { cn } from '../../lib/format';
import { EmptyState, Select } from '../../components/ui';
import { OrderCardItem } from './OrderCardItem';

export interface KanbanBoardProps {
  stages: StageDto[];
  orders: OrderCard[];
  canDrag: boolean;
  onRequestMove: (order: OrderCard, targetStageId: string) => void;
}

function Column({
  stage,
  orders,
  canDrag,
  onMove,
}: {
  stage: StageDto;
  orders: OrderCard[];
  canDrag: boolean;
  onMove: (order: OrderCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stage } });
  const overdue = orders.filter((order) => order.sla.state === 'OVERDUE').length;

  return (
    <section
      ref={setNodeRef}
      aria-label={`Etapa ${stage.name}`}
      className={cn(
        'flex w-76 shrink-0 flex-col overflow-hidden rounded-[1.5rem] border bg-surface-muted/80 shadow-[var(--shadow-tile)]',
        isOver ? 'border-brand-500 bg-brand-soft shadow-[var(--shadow-float)]' : 'border-line',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{stage.name}</h3>
          <p className="text-[11px] text-muted">
            {orders.length} {orders.length === 1 ? 'orden' : 'ordenes'}
            {overdue > 0 ? ` · ${overdue} atrasadas` : ''}
          </p>
        </div>
        <span className="flex size-8 items-center justify-center rounded-xl bg-surface text-xs font-bold text-ink shadow-sm tabular-nums">
          {orders.length}
        </span>
      </header>

      <div className="zl-scroll flex max-h-[calc(100vh-19rem)] flex-col gap-2.5 overflow-y-auto p-2.5">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-300 bg-surface/55 px-3 py-8 text-center text-xs text-muted">
            Sin ordenes en esta etapa
          </p>
        ) : (
          orders.map((order) => (
            <OrderCardItem key={order.id} order={order} draggable={canDrag} onMove={onMove} />
          ))
        )}
      </div>
    </section>
  );
}

export function KanbanBoard({ stages, orders, canDrag, onRequestMove }: KanbanBoardProps) {
  const [activeOrder, setActiveOrder] = useState<OrderCard | null>(null);
  const [mobileStageId, setMobileStageId] = useState<string>(stages[0]?.id ?? '');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = (stageId: string) => orders.filter((order) => order.stage.id === stageId);

  /** El boton "Mover" propone la etapa siguiente; el modal permite cambiarla. */
  const openMoveDialog = (order: OrderCard) => {
    const next = stages.find((stage) => stage.position === order.stage.position + 1);
    onRequestMove(order, next?.id ?? order.stage.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveOrder((event.active.data.current as { order?: OrderCard } | undefined)?.order ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const order = (event.active.data.current as { order?: OrderCard } | undefined)?.order;
    setActiveOrder(null);
    if (!order || !event.over) return;

    const targetStageId = String(event.over.id);
    // La tarjeta no se mueve todavia: se abre el modal de confirmacion.
    if (targetStageId !== order.stage.id) onRequestMove(order, targetStageId);
  };

  if (stages.length === 0) {
    return <EmptyState title="No hay etapas configuradas" description="Ejecuta el seed para crear el flujo de produccion." />;
  }

  const mobileStage = stages.find((stage) => stage.id === mobileStageId) ?? stages[0]!;
  const mobileOrders = byStage(mobileStage.id);

  return (
    <>
      {/* Escritorio y tablet: columnas con desplazamiento horizontal contenido. */}
      <div className="hidden md:block">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="zl-scroll flex w-full gap-4 overflow-x-auto pb-3">
            {stages.map((stage) => (
              <Column
                key={stage.id}
                stage={stage}
                orders={byStage(stage.id)}
                canDrag={canDrag}
                onMove={openMoveDialog}
              />
            ))}
          </div>
          <DragOverlay>
            {activeOrder ? (
              <div className="w-76 rotate-1">
                <OrderCardItem order={activeOrder} draggable={false} onMove={() => undefined} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Movil: selector de etapa y lista vertical. */}
      <div className="flex flex-col gap-3 md:hidden">
        <label htmlFor="etapa-movil" className="text-xs font-semibold text-ink">
          Etapa
        </label>
        <Select
          id="etapa-movil"
          value={mobileStage.id}
          onChange={(event) => setMobileStageId(event.target.value)}
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.position}. {stage.name} ({byStage(stage.id).length})
            </option>
          ))}
        </Select>

        {mobileOrders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-300 bg-surface/55 px-3 py-8 text-center text-xs text-muted">
            Sin ordenes en esta etapa
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mobileOrders.map((order) => (
              <OrderCardItem key={order.id} order={order} draggable={canDrag} onMove={openMoveDialog} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
