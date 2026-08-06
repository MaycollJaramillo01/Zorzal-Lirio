import { and, asc, desc, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, type DbExecutor } from '../db/client.js';
import { orders, orderStageHistory, stages, users } from '../db/schema.js';
import type { Role } from '../../shared/constants/enums.js';

const assigneeUser = alias(users, 'history_assignee');
const moverUser = alias(users, 'history_mover');

export interface HistoryRow {
  id: string;
  stageId: string;
  stageCode: string;
  stageName: string;
  stagePosition: number;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeRole: Role | null;
  movedById: string | null;
  movedByName: string | null;
  movedByEmail: string | null;
  movedByRole: Role | null;
  enteredAt: Date;
  exitedAt: Date | null;
  elapsedMinutes: number | null;
  transitionNote: string | null;
}

export async function listOrderHistory(
  orderId: string,
  exec: DbExecutor = getDb(),
): Promise<HistoryRow[]> {
  return exec
    .select({
      id: orderStageHistory.id,
      stageId: stages.id,
      stageCode: stages.code,
      stageName: stages.name,
      stagePosition: stages.position,
      assigneeId: assigneeUser.id,
      assigneeName: assigneeUser.name,
      assigneeEmail: assigneeUser.email,
      assigneeRole: assigneeUser.role,
      movedById: moverUser.id,
      movedByName: moverUser.name,
      movedByEmail: moverUser.email,
      movedByRole: moverUser.role,
      enteredAt: orderStageHistory.enteredAt,
      exitedAt: orderStageHistory.exitedAt,
      elapsedMinutes: orderStageHistory.elapsedMinutes,
      transitionNote: orderStageHistory.transitionNote,
    })
    .from(orderStageHistory)
    .innerJoin(stages, eq(stages.id, orderStageHistory.stageId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, orderStageHistory.assigneeId))
    .leftJoin(moverUser, eq(moverUser.id, orderStageHistory.movedByUserId))
    .where(eq(orderStageHistory.orderId, orderId))
    .orderBy(asc(orderStageHistory.enteredAt));
}

export async function findOpenHistory(orderId: string, exec: DbExecutor = getDb()) {
  const [row] = await exec
    .select()
    .from(orderStageHistory)
    .where(and(eq(orderStageHistory.orderId, orderId), isNull(orderStageHistory.exitedAt)))
    .limit(1);
  return row ?? null;
}

/** Cierra el tramo abierto y calcula el tiempo permanecido en minutos. */
export async function closeOpenHistory(
  exec: DbExecutor,
  orderId: string,
  exitedAt: Date,
  transitionNote: string | null,
) {
  const [row] = await exec
    .update(orderStageHistory)
    .set({
      exitedAt,
      transitionNote,
      elapsedMinutes: sql`greatest(0, floor(extract(epoch from (${exitedAt.toISOString()}::timestamptz - ${orderStageHistory.enteredAt})) / 60))::int`,
    })
    .where(and(eq(orderStageHistory.orderId, orderId), isNull(orderStageHistory.exitedAt)))
    .returning();
  return row ?? null;
}

export async function openHistory(
  exec: DbExecutor,
  data: {
    orderId: string;
    stageId: string;
    assigneeId: string | null;
    movedByUserId: string | null;
    enteredAt: Date;
  },
) {
  const [row] = await exec.insert(orderStageHistory).values(data).returning();
  return row!;
}

export async function updateOpenHistoryAssignee(
  exec: DbExecutor,
  orderId: string,
  assigneeId: string | null,
) {
  await exec
    .update(orderStageHistory)
    .set({ assigneeId })
    .where(and(eq(orderStageHistory.orderId, orderId), isNull(orderStageHistory.exitedAt)));
}

export interface StageDurationRow {
  stageId: string;
  stageCode: string;
  stageName: string;
  stagePosition: number;
  completedOrders: number;
  averageMinutes: number | null;
  medianMinutes: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  metSla: number;
  missedSla: number;
}

/**
 * Tiempos por etapa calculados con agregacion SQL sobre los tramos cerrados.
 * El cumplimiento se evalua contra el SLA vigente de cada etapa.
 */
export async function aggregateStageDurations(
  filters: { from?: Date; to?: Date },
  exec: DbExecutor = getDb(),
): Promise<StageDurationRow[]> {
  const conditions = [isNotNull(orderStageHistory.exitedAt)];
  if (filters.from) conditions.push(sql`${orderStageHistory.enteredAt} >= ${filters.from}`);
  if (filters.to) conditions.push(sql`${orderStageHistory.enteredAt} <= ${filters.to}`);

  return exec
    .select({
      stageId: stages.id,
      stageCode: stages.code,
      stageName: stages.name,
      stagePosition: stages.position,
      completedOrders: sql<number>`count(*)::int`,
      averageMinutes: sql<number | null>`round(avg(${orderStageHistory.elapsedMinutes}))::int`,
      medianMinutes: sql<
        number | null
      >`round(percentile_cont(0.5) within group (order by ${orderStageHistory.elapsedMinutes}))::int`,
      minMinutes: sql<number | null>`min(${orderStageHistory.elapsedMinutes})::int`,
      maxMinutes: sql<number | null>`max(${orderStageHistory.elapsedMinutes})::int`,
      metSla: sql<number>`count(*) filter (where ${stages.isSlaEnabled} and ${stages.slaMinutes} is not null and ${orderStageHistory.elapsedMinutes} <= ${stages.slaMinutes})::int`,
      missedSla: sql<number>`count(*) filter (where ${stages.isSlaEnabled} and ${stages.slaMinutes} is not null and ${orderStageHistory.elapsedMinutes} > ${stages.slaMinutes})::int`,
    })
    .from(orderStageHistory)
    .innerJoin(stages, eq(stages.id, orderStageHistory.stageId))
    .where(and(...conditions))
    .groupBy(stages.id, stages.code, stages.name, stages.position)
    .orderBy(asc(stages.position));
}

export interface RecentActivityRow {
  id: string;
  orderId: string;
  orderCode: string;
  stageName: string;
  assigneeName: string | null;
  movedByName: string | null;
  enteredAt: Date;
}

export async function listRecentActivity(
  limit: number,
  restrictToUserId: string | null,
  exec: DbExecutor = getDb(),
) {
  const conditions = restrictToUserId
    ? [eq(orderStageHistory.assigneeId, restrictToUserId)]
    : [];

  return exec
    .select({
      id: orderStageHistory.id,
      orderId: orderStageHistory.orderId,
      orderCode: orders.orderCode,
      stageName: stages.name,
      assigneeName: assigneeUser.name,
      movedByName: moverUser.name,
      enteredAt: orderStageHistory.enteredAt,
    })
    .from(orderStageHistory)
    .innerJoin(orders, eq(orders.id, orderStageHistory.orderId))
    .innerJoin(stages, eq(stages.id, orderStageHistory.stageId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, orderStageHistory.assigneeId))
    .leftJoin(moverUser, eq(moverUser.id, orderStageHistory.movedByUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orderStageHistory.enteredAt))
    .limit(limit);
}
