import { getDb } from '../db/client.js';
import { httpErrors } from '../utils/appError.js';
import { calendarDateToUtc } from '../../shared/lib/datetime.js';
import { CLOSED_STAGE_CODE, FIRST_STAGE_CODE } from '../../shared/constants/stages.js';
import {
  evaluateTransition,
  transitionRequiresAssignee,
} from '../../shared/lib/transitions.js';
import type {
  ArchiveOrderInput,
  CreateOrderInput,
  OrderFilters,
  ReassignOrderInput,
  TransitionOrderInput,
  UpdateOrderInput,
} from '../../shared/schemas/orders.js';
import type { OrderCard, OrderDetail, OrderHistoryEntry } from '../../shared/types/index.js';
import type { StageCode } from '../../shared/constants/stages.js';
import type { AuthUser } from '../types/auth.js';
import {
  findOrderContext,
  findOrderRow,
  insertOrder,
  listOrderContexts,
  nextOrderCode,
  updateOrderWithVersion,
  type OrderContextRow,
} from '../repositories/orderRepository.js';
import {
  closeOpenHistory,
  listOrderHistory,
  openHistory,
  updateOpenHistoryAssignee,
  type HistoryRow,
} from '../repositories/historyRepository.js';
import { findStageByCode, findStageById } from '../repositories/stageRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import { insertNote } from '../repositories/noteRepository.js';
import { recordAudit } from './auditService.js';
import { toOrderCard, toOrderDetail } from './slaService.js';

function canSeeOrder(viewer: AuthUser, row: OrderContextRow): boolean {
  if (viewer.role !== 'PLANT') return true;
  if (row.assigneeId === viewer.id) return true;
  return viewer.stageFocusIds.includes(row.stageId);
}

async function requireVisibleOrder(viewer: AuthUser, orderId: string): Promise<OrderContextRow> {
  const row = await findOrderContext(orderId);
  if (!row) throw httpErrors.notFound('La orden no existe.');
  if (!canSeeOrder(viewer, row)) throw httpErrors.forbidden('No tienes acceso a esta orden.');
  return row;
}

async function requireActiveUser(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw httpErrors.validation(undefined, 'El responsable seleccionado no existe.');
  if (!user.isActive) {
    throw httpErrors.validation(undefined, 'El responsable seleccionado esta desactivado.');
  }
  return user;
}

export async function listOrders(viewer: AuthUser, filters: OrderFilters): Promise<OrderCard[]> {
  const rows = await listOrderContexts(
    {
      search: filters.search,
      stageId: filters.stageId,
      assignee: filters.assignee,
      priority: filters.priority,
      customer: filters.customer,
      from: filters.from,
      to: filters.to,
      includeClosed: filters.includeClosed ?? true,
      includeArchived: filters.includeArchived ?? false,
      onlyMine: filters.onlyMine ?? false,
    },
    { id: viewer.id, role: viewer.role, stageFocusIds: viewer.stageFocusIds },
  );

  const now = new Date();
  const cards = rows.map((row) => toOrderCard(row, now));
  return filters.sla ? cards.filter((card) => card.sla.state === filters.sla) : cards;
}

export async function getOrderDetail(viewer: AuthUser, orderId: string): Promise<OrderDetail> {
  const row = await requireVisibleOrder(viewer, orderId);
  return toOrderDetail(row, new Date());
}

export async function getOrderHistory(
  viewer: AuthUser,
  orderId: string,
): Promise<OrderHistoryEntry[]> {
  await requireVisibleOrder(viewer, orderId);
  const rows = await listOrderHistory(orderId);
  return rows.map(toHistoryEntry);
}

function toHistoryEntry(row: HistoryRow): OrderHistoryEntry {
  return {
    id: row.id,
    stage: {
      id: row.stageId,
      code: row.stageCode as StageCode,
      name: row.stageName,
      position: row.stagePosition,
    },
    assignee:
      row.assigneeId && row.assigneeName && row.assigneeEmail && row.assigneeRole
        ? {
            id: row.assigneeId,
            name: row.assigneeName,
            email: row.assigneeEmail,
            role: row.assigneeRole,
          }
        : null,
    movedBy:
      row.movedById && row.movedByName && row.movedByEmail && row.movedByRole
        ? {
            id: row.movedById,
            name: row.movedByName,
            email: row.movedByEmail,
            role: row.movedByRole,
          }
        : null,
    enteredAt: row.enteredAt.toISOString(),
    exitedAt: row.exitedAt ? row.exitedAt.toISOString() : null,
    elapsedMinutes: row.elapsedMinutes,
    transitionNote: row.transitionNote,
  };
}

function emptyToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createOrder(
  actor: AuthUser,
  input: CreateOrderInput,
  ipAddress: string | null,
): Promise<OrderDetail> {
  const firstStage = await findStageByCode(FIRST_STAGE_CODE);
  if (!firstStage) throw httpErrors.internal('La etapa inicial no esta configurada.');

  const now = new Date();
  const orderId = await getDb().transaction(async (tx) => {
    await requireActiveUser(input.initialAssigneeId);

    const orderCode = await nextOrderCode(tx, now.getUTCFullYear());
    const order = await insertOrder(tx, {
      orderCode,
      purchaseOrderNumber: input.purchaseOrderNumber,
      customerName: input.customerName,
      projectName: input.projectName,
      description: emptyToNull(input.description),
      quantity: input.quantity,
      priority: input.priority,
      purchaseOrderDate: input.purchaseOrderDate,
      expectedDeliveryDate: emptyToNull(input.expectedDeliveryDate),
      currentStageId: firstStage.id,
      currentAssigneeId: input.initialAssigneeId,
      createdByUserId: actor.id,
    });

    // El SLA de "Orden recibida" corre desde la fecha real de recepcion de la OC.
    const receivedAt = calendarDateToUtc(input.purchaseOrderDate);
    const enteredAt = receivedAt.getTime() < now.getTime() ? receivedAt : now;

    await openHistory(tx, {
      orderId: order.id,
      stageId: firstStage.id,
      assigneeId: input.initialAssigneeId,
      movedByUserId: actor.id,
      enteredAt,
    });

    const initialNote = emptyToNull(input.initialNote);
    if (initialNote) {
      await insertNote(tx, { orderId: order.id, authorUserId: actor.id, body: initialNote });
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'ORDER_CREATED',
        entityType: 'order',
        entityId: order.id,
        afterData: {
          orderCode: order.orderCode,
          customerName: order.customerName,
          projectName: order.projectName,
          quantity: order.quantity,
          priority: order.priority,
          stage: firstStage.code,
          assigneeId: input.initialAssigneeId,
        },
        ipAddress,
      },
      tx,
    );

    return order.id;
  });

  const row = await findOrderContext(orderId);
  if (!row) throw httpErrors.internal('No se pudo leer la orden recien creada.');
  return toOrderDetail(row, new Date());
}

export async function updateOrder(
  actor: AuthUser,
  orderId: string,
  input: UpdateOrderInput,
  ipAddress: string | null,
): Promise<OrderDetail> {
  const current = await findOrderRow(orderId);
  if (!current) throw httpErrors.notFound('La orden no existe.');
  if (current.isArchived) throw httpErrors.orderArchived();

  const { version, ...fields } = input;
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(changes).length === 0) {
    return getOrderDetail(actor, orderId);
  }

  await getDb().transaction(async (tx) => {
    const updated = await updateOrderWithVersion(tx, orderId, version, changes);
    if (!updated) throw httpErrors.versionConflict({ currentVersion: current.version });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'ORDER_UPDATED',
        entityType: 'order',
        entityId: orderId,
        beforeData: Object.fromEntries(
          Object.keys(changes).map((key) => [key, (current as Record<string, unknown>)[key]]),
        ),
        afterData: changes,
        ipAddress,
      },
      tx,
    );
  });

  return getOrderDetail(actor, orderId);
}

export async function transitionOrder(
  actor: AuthUser,
  orderId: string,
  input: TransitionOrderInput,
  ipAddress: string | null,
): Promise<OrderDetail> {
  const context = await requireVisibleOrder(actor, orderId);
  if (context.isArchived) throw httpErrors.orderArchived();

  const targetStage = await findStageById(input.toStageId);
  if (!targetStage) throw httpErrors.notFound('La etapa destino no existe.');

  const evaluation = evaluateTransition(actor.role, context.stagePosition, targetStage.position);
  if (!evaluation.allowed) {
    throw httpErrors.invalidTransition(evaluation.reason ?? undefined);
  }

  const reason = emptyToNull(input.reason);
  if (evaluation.requiresReason && !reason) throw httpErrors.reasonRequired();

  const needsAssignee = transitionRequiresAssignee(targetStage.code);
  const assigneeId = input.assigneeId ?? null;
  if (needsAssignee && !assigneeId) throw httpErrors.assigneeRequired();

  const note = emptyToNull(input.note);
  const isClosing = targetStage.code === CLOSED_STAGE_CODE;
  const now = new Date();

  await getDb().transaction(async (tx) => {
    if (assigneeId) await requireActiveUser(assigneeId);

    const updated = await updateOrderWithVersion(tx, orderId, input.version, {
      currentStageId: targetStage.id,
      currentAssigneeId: assigneeId,
      closedAt: isClosing ? now : null,
    });
    if (!updated) throw httpErrors.versionConflict({ currentVersion: context.version });

    // El tramo anterior se cierra guardando la nota o razon del movimiento.
    const closed = await closeOpenHistory(tx, orderId, now, reason ?? note);
    if (!closed) throw httpErrors.internal('La orden no tenia una etapa abierta.');

    await openHistory(tx, {
      orderId,
      stageId: targetStage.id,
      assigneeId,
      movedByUserId: actor.id,
      enteredAt: now,
    });

    if (note) {
      await insertNote(tx, { orderId, authorUserId: actor.id, body: note });
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'ORDER_TRANSITIONED',
        entityType: 'order',
        entityId: orderId,
        beforeData: {
          stageId: context.stageId,
          stageCode: context.stageCode,
          assigneeId: context.assigneeId,
        },
        afterData: { stageId: targetStage.id, stageCode: targetStage.code, assigneeId },
        metadata: {
          kind: evaluation.kind,
          reason,
          note,
          elapsedMinutes: closed.elapsedMinutes,
        },
        ipAddress,
      },
      tx,
    );
  });

  return getOrderDetail(actor, orderId);
}

export async function reassignOrder(
  actor: AuthUser,
  orderId: string,
  input: ReassignOrderInput,
  ipAddress: string | null,
): Promise<OrderDetail> {
  const context = await requireVisibleOrder(actor, orderId);
  if (context.isArchived) throw httpErrors.orderArchived();
  if (actor.role === 'PLANT') {
    throw httpErrors.forbidden('Planta no puede reasignar ordenes.');
  }

  await getDb().transaction(async (tx) => {
    await requireActiveUser(input.assigneeId);

    const updated = await updateOrderWithVersion(tx, orderId, input.version, {
      currentAssigneeId: input.assigneeId,
    });
    if (!updated) throw httpErrors.versionConflict({ currentVersion: context.version });

    await updateOpenHistoryAssignee(tx, orderId, input.assigneeId);

    const note = emptyToNull(input.note);
    if (note) {
      await insertNote(tx, { orderId, authorUserId: actor.id, body: note });
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'ORDER_REASSIGNED',
        entityType: 'order',
        entityId: orderId,
        beforeData: { assigneeId: context.assigneeId },
        afterData: { assigneeId: input.assigneeId },
        metadata: { note },
        ipAddress,
      },
      tx,
    );
  });

  return getOrderDetail(actor, orderId);
}

async function setArchived(
  actor: AuthUser,
  orderId: string,
  input: ArchiveOrderInput,
  archived: boolean,
  ipAddress: string | null,
): Promise<OrderDetail> {
  const current = await findOrderRow(orderId);
  if (!current) throw httpErrors.notFound('La orden no existe.');

  await getDb().transaction(async (tx) => {
    const updated = await updateOrderWithVersion(tx, orderId, input.version, {
      isArchived: archived,
    });
    if (!updated) throw httpErrors.versionConflict({ currentVersion: current.version });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: archived ? 'ORDER_ARCHIVED' : 'ORDER_RESTORED',
        entityType: 'order',
        entityId: orderId,
        beforeData: { isArchived: current.isArchived },
        afterData: { isArchived: archived },
        metadata: { reason: emptyToNull(input.reason) },
        ipAddress,
      },
      tx,
    );
  });

  return getOrderDetail(actor, orderId);
}

export function archiveOrder(
  actor: AuthUser,
  orderId: string,
  input: ArchiveOrderInput,
  ipAddress: string | null,
): Promise<OrderDetail> {
  return setArchived(actor, orderId, input, true, ipAddress);
}

export function restoreOrder(
  actor: AuthUser,
  orderId: string,
  input: ArchiveOrderInput,
  ipAddress: string | null,
): Promise<OrderDetail> {
  return setArchived(actor, orderId, input, false, ipAddress);
}

/**
 * Ordenes activas (ni cerradas ni archivadas) con su SLA ya calculado.
 * Base compartida por dashboard, equipo y reportes: una sola consulta y una
 * sola aplicacion de la formula de SLA.
 */
export async function loadActiveOrderCards(now = new Date()): Promise<OrderCard[]> {
  const rows = await listOrderContexts(
    { includeClosed: false, includeArchived: false },
    { id: '', role: 'OWNER', stageFocusIds: [] },
  );
  return rows.map((row) => toOrderCard(row, now));
}

export { requireVisibleOrder, canSeeOrder };
