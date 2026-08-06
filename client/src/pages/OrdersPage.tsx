import { useMemo, useState } from 'react';
import { isManager } from '@shared/lib/permissions';
import type { OrderCard, StageDto, TeamMember, UserRef } from '@shared/types/index';
import { Button, ErrorState, PageHeader, Spinner } from '../components/ui';
import { FiltersBar } from '../features/kanban/FiltersBar';
import { KanbanBoard } from '../features/kanban/KanbanBoard';
import { TransitionModal } from '../features/kanban/TransitionModal';
import { useOrderFilters } from '../features/kanban/useOrderFilters';
import { OrderCreateModal } from '../features/orders/OrderFormModal';
import { useOrders, useSession, useStages, useUsers } from '../services/queries';

export function OrdersPage() {
  const { data: session } = useSession();
  const { filters, setFilter, reset, activeCount } = useOrderFilters();
  const stagesQuery = useStages();
  const usersQuery = useUsers();
  const ordersQuery = useOrders(filters);

  const [pending, setPending] = useState<{ order: OrderCard; stageId: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const users = useMemo<UserRef[]>(
    () => ((usersQuery.data ?? []) as Array<UserRef | TeamMember>).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })),
    [usersQuery.data],
  );

  if (!session) return null;

  const manager = isManager(session.role);
  const stages: StageDto[] = stagesQuery.data ?? [];
  const targetStage = pending ? (stages.find((stage) => stage.id === pending.stageId) ?? null) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Ordenes"
        description={
          manager
            ? 'Tablero de produccion con todas las ordenes activas.'
            : 'Ordenes asignadas a ti y a tus etapas de enfoque.'
        }
        actions={
          <>
            <Button
              variant={filters.assignee === 'me' ? 'primary' : 'secondary'}
              onClick={() => setFilter({ assignee: filters.assignee === 'me' ? undefined : 'me' })}
            >
              Solo mis ordenes
            </Button>
            {manager ? <Button onClick={() => setCreateOpen(true)}>Nueva orden</Button> : null}
          </>
        }
      />

      <FiltersBar
        filters={filters}
        stages={stages}
        users={users}
        activeCount={activeCount}
        onChange={setFilter}
        onReset={reset}
      />

      {ordersQuery.isError ? (
        <ErrorState
          message="No se pudieron cargar las ordenes."
          onRetry={() => void ordersQuery.refetch()}
        />
      ) : null}

      {ordersQuery.isPending || stagesQuery.isPending ? (
        <Spinner label="Cargando tablero" />
      ) : (
        <KanbanBoard
          stages={stages}
          orders={ordersQuery.data ?? []}
          canDrag
          onRequestMove={(order, stageId) => setPending({ order, stageId })}
        />
      )}

      <TransitionModal
        order={pending?.order ?? null}
        targetStage={targetStage}
        stages={stages}
        users={users}
        role={session.role}
        onClose={() => setPending(null)}
        onStageChange={(stageId) => setPending((current) => (current ? { ...current, stageId } : current))}
      />

      <OrderCreateModal open={createOpen} users={users} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
