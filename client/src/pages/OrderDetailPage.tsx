import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AUDIT_ACTION_LABELS, type AuditAction } from '@shared/constants/enums';
import { isManager } from '@shared/lib/permissions';
import type { OrderNote, StageDto, TeamMember, UserRef } from '@shared/types/index';
import { AssigneeChip, PriorityBadge, SlaBadge } from '../components/indicators';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '../components/ui';
import { TransitionModal } from '../features/kanban/TransitionModal';
import { OrderEditModal } from '../features/orders/OrderFormModal';
import { ApiError } from '../lib/api';
import { fmtDate, fmtDateTime, fmtDuration } from '../lib/format';
import {
  toAssignableUsers,
  useOrder,
  useOrderAudit,
  useOrderHistory,
  useOrderMutations,
  useOrderNotes,
  useSession,
  useStages,
  useUsers,
} from '../services/queries';

type TabId = 'history' | 'notes' | 'audit';

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: session } = useSession();
  const orderQuery = useOrder(orderId);
  const stagesQuery = useStages();
  const usersQuery = useUsers();
  const [tab, setTab] = useState<TabId>('history');
  const [moveOpen, setMoveOpen] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  if (!session) return null;

  if (orderQuery.isPending) return <Spinner label="Cargando orden" />;
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <ErrorState
        message={
          orderQuery.error instanceof ApiError
            ? orderQuery.error.message
            : 'No se pudo cargar la orden.'
        }
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  const order = orderQuery.data;
  const manager = isManager(session.role);
  const stages: StageDto[] = stagesQuery.data ?? [];
  // Solo usuarios activos: el backend rechaza asignar a alguien desactivado.
  const users: UserRef[] = toAssignableUsers(
    usersQuery.data as Array<UserRef | TeamMember> | undefined,
  );

  const nextStage = stages.find((stage) => stage.position === order.stage.position + 1);
  const targetStage = moveOpen ? (stages.find((stage) => stage.id === moveOpen) ?? null) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={`${order.orderCode} · ${order.customerName}`}
        description={order.projectName}
        actions={
          <>
            <Link to="/orders">
              <Button variant="secondary">Volver al tablero</Button>
            </Link>
            <Button onClick={() => setMoveOpen(nextStage?.id ?? order.stage.id)}>Mover de etapa</Button>
            {manager ? (
              <>
                <Button variant="secondary" onClick={() => setReassignOpen(true)}>
                  Reasignar
                </Button>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  Editar
                </Button>
                <ArchiveButton order={order} />
              </>
            ) : null}
          </>
        }
      />

      <Card title="Resumen">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          <Detail label="Codigo interno" value={order.orderCode} />
          <Detail label="Orden de compra" value={order.purchaseOrderNumber} />
          <Detail label="Cliente" value={order.customerName} />
          <Detail label="Proyecto" value={order.projectName} />
          <Detail label="Cantidad" value={`${order.quantity} unidades`} />
          <Detail label="Prioridad" value={<PriorityBadge priority={order.priority} />} />
          <Detail label="Etapa actual" value={order.stage.name} />
          <Detail label="Responsable" value={<AssigneeChip user={order.assignee} />} />
          <Detail label="Fecha de OC" value={fmtDate(order.purchaseOrderDate)} />
          <Detail
            label="Entrega esperada"
            value={order.expectedDeliveryDate ? fmtDate(order.expectedDeliveryDate) : 'Sin definir'}
          />
          <Detail label="En la etapa desde" value={fmtDateTime(order.stageEnteredAt)} />
          <Detail label="Estado SLA" value={<SlaBadge sla={order.sla} />} />
          {order.description ? (
            <div className="col-span-2 sm:col-span-3 xl:col-span-4">
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Descripcion</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap text-ink">{order.description}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="flex w-fit flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-tile)]" role="tablist" aria-label="Secciones de la orden">
        <TabButton id="history" current={tab} onSelect={setTab} label="Historial" />
        <TabButton id="notes" current={tab} onSelect={setTab} label="Notas" />
        {manager ? <TabButton id="audit" current={tab} onSelect={setTab} label="Auditoria" /> : null}
      </div>

      {tab === 'history' ? <HistorySection orderId={order.id} /> : null}
      {tab === 'notes' ? <NotesSection orderId={order.id} canHide={manager} currentUserId={session.id} /> : null}
      {tab === 'audit' && manager ? <AuditSection orderId={order.id} /> : null}

      <TransitionModal
        order={moveOpen ? order : null}
        targetStage={targetStage}
        stages={stages}
        users={users}
        role={session.role}
        onClose={() => setMoveOpen(null)}
        onStageChange={(stageId) => setMoveOpen(stageId)}
      />

      {editOpen ? <OrderEditModal order={order} onClose={() => setEditOpen(false)} /> : null}

      <ReassignModal
        open={reassignOpen}
        orderId={order.id}
        version={order.version}
        users={users}
        currentAssigneeId={order.assignee?.id ?? ''}
        onClose={() => setReassignOpen(false)}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{value}</dd>
    </div>
  );
}

function TabButton({
  id,
  current,
  onSelect,
  label,
}: {
  id: TabId;
  current: TabId;
  onSelect: (id: TabId) => void;
  label: string;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(id)}
      className={
        active
          ? 'rounded-xl bg-brand-900 px-4 py-2 text-sm font-semibold text-white'
          : 'rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-surface-muted hover:text-ink'
      }
    >
      {label}
    </button>
  );
}

function HistorySection({ orderId }: { orderId: string }) {
  const query = useOrderHistory(orderId);

  if (query.isPending) return <Spinner label="Cargando historial" />;
  if (query.isError) return <ErrorState message="No se pudo cargar el historial." />;
  const history = query.data ?? [];
  if (history.length === 0) return <EmptyState title="Sin movimientos registrados" />;

  return (
    <Card title="Linea de tiempo">
      <ol className="flex flex-col gap-3">
        {history.map((entry) => (
          <li key={entry.id} className="border-l-2 border-line pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{entry.stage.name}</span>
              {entry.exitedAt ? null : (
                <span className="rounded border border-brand-500/40 bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand-700">
                  Etapa actual
                </span>
              )}
            </div>
            <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
              <div>Responsable: {entry.assignee?.name ?? 'Sin asignar'}</div>
              <div>Entrada: {fmtDateTime(entry.enteredAt)}</div>
              <div>Salida: {entry.exitedAt ? fmtDateTime(entry.exitedAt) : 'En curso'}</div>
              <div>
                Tiempo: {entry.elapsedMinutes === null ? 'En curso' : fmtDuration(entry.elapsedMinutes)}
              </div>
              <div className="sm:col-span-2">Movido por: {entry.movedBy?.name ?? 'Sistema'}</div>
            </dl>
            {entry.transitionNote ? (
              <p className="mt-1 rounded border border-line bg-surface-muted px-2 py-1 text-xs whitespace-pre-wrap text-ink">
                {entry.transitionNote}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function NotesSection({
  orderId,
  canHide,
  currentUserId,
}: {
  orderId: string;
  canHide: boolean;
  currentUserId: string;
}) {
  const query = useOrderNotes(orderId);
  const { addNote, hideNote } = useOrderMutations();
  const { notify } = useToast();
  const [body, setBody] = useState('');

  const submit = async () => {
    if (body.trim().length === 0) return;
    try {
      await addNote.mutateAsync({ id: orderId, body: body.trim() });
      setBody('');
      notify('Nota agregada.');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'No se pudo agregar la nota.', 'error');
    }
  };

  return (
    <Card title="Notas">
      <div className="flex flex-col gap-3">
        <Field label="Nueva nota" htmlFor="nota-nueva">
          <Textarea
            id="nota-nueva"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Escribe una actualizacion para el equipo"
          />
        </Field>
        <div>
          <Button onClick={() => void submit()} disabled={addNote.isPending || body.trim().length === 0}>
            {addNote.isPending ? 'Guardando...' : 'Agregar nota'}
          </Button>
        </div>

        {query.isPending ? <Spinner label="Cargando notas" /> : null}
        {query.data && query.data.length === 0 ? <EmptyState title="Aun no hay notas" /> : null}

        <ul className="flex flex-col gap-2">
          {(query.data ?? []).map((note: OrderNote) => (
            <li
              key={note.id}
              className={
                note.isHidden
                  ? 'rounded border border-dashed border-line bg-surface-muted p-2.5 opacity-70'
                  : 'rounded border border-line bg-surface p-2.5'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">
                  {note.author?.name ?? 'Usuario eliminado'}
                  {note.author?.id === currentUserId ? ' (tu)' : ''}
                </span>
                <span className="text-xs text-muted">{fmtDateTime(note.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{note.body}</p>
              {note.isHidden ? (
                <p className="mt-1 text-xs text-muted">
                  Nota oculta por {note.hiddenBy?.name ?? 'un administrador'}
                </p>
              ) : canHide ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1"
                  disabled={hideNote.isPending}
                  onClick={() =>
                    hideNote.mutate(
                      { orderId, noteId: note.id },
                      {
                        onSuccess: () => notify('Nota oculta.'),
                        onError: (error) =>
                          notify(
                            error instanceof ApiError ? error.message : 'No se pudo ocultar la nota.',
                            'error',
                          ),
                      },
                    )
                  }
                >
                  Ocultar nota
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function AuditSection({ orderId }: { orderId: string }) {
  const [page, setPage] = useState(1);
  const query = useOrderAudit(orderId, page, true);

  if (query.isPending) return <Spinner label="Cargando auditoria" />;
  if (query.isError) return <ErrorState message="No se pudo cargar la auditoria." />;

  const data = query.data!;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <Card
      title="Auditoria"
      actions={
        <div className="flex items-center gap-2 text-xs text-muted">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>
            Pagina {page} de {pages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      }
    >
      {data.items.length === 0 ? (
        <EmptyState title="Sin registros de auditoria" />
      ) : (
        <div className="zl-scroll overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Accion</th>
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.id} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{fmtDateTime(entry.createdAt)}</td>
                  <td className="py-2 pr-3">
                    {AUDIT_ACTION_LABELS[entry.action as AuditAction] ?? entry.action}
                  </td>
                  <td className="py-2 pr-3">{entry.actor?.name ?? 'Sistema'}</td>
                  <td className="py-2 text-xs text-muted">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify({ antes: entry.beforeData, despues: entry.afterData }, null, 1)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ArchiveButton({ order }: { order: { id: string; version: number; isArchived: boolean } }) {
  const { archiveOrder } = useOrderMutations();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);

  const run = async () => {
    try {
      await archiveOrder.mutateAsync({
        id: order.id,
        version: order.version,
        archived: !order.isArchived,
      });
      notify(order.isArchived ? 'Orden restaurada.' : 'Orden archivada.');
      setConfirming(false);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'No se pudo completar la accion.', 'error');
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        {order.isArchived ? 'Restaurar' : 'Archivar'}
      </Button>
      <Modal
        open={confirming}
        title={order.isArchived ? 'Restaurar orden' : 'Archivar orden'}
        description={
          order.isArchived
            ? 'La orden volvera a aparecer en el tablero.'
            : 'La orden se ocultara del tablero. No se elimina ningun dato.'
        }
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void run()} disabled={archiveOrder.isPending}>
              Confirmar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">Esta accion queda registrada en la auditoria.</p>
      </Modal>
    </>
  );
}

function ReassignModal({
  open,
  orderId,
  version,
  users,
  currentAssigneeId,
  onClose,
}: {
  open: boolean;
  orderId: string;
  version: number;
  users: UserRef[];
  currentAssigneeId: string;
  onClose: () => void;
}) {
  const { reassignOrder } = useOrderMutations();
  const { notify } = useToast();
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    if (!assigneeId) {
      setError('Selecciona un responsable.');
      return;
    }
    try {
      await reassignOrder.mutateAsync({ id: orderId, version, assigneeId, note: note || undefined });
      notify('Responsable actualizado.');
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo reasignar la orden.');
    }
  };

  return (
    <Modal
      open
      title="Reasignar responsable"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={reassignOrder.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Field label="Nuevo responsable" htmlFor="reasignar-usuario" required>
          <Select
            id="reasignar-usuario"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Selecciona un responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nota (opcional)" htmlFor="reasignar-nota">
          <Textarea id="reasignar-nota" value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
