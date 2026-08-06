import { and, asc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, type DbExecutor } from '../db/client.js';
import { orderStageHistory, orders, stages, users } from '../db/schema.js';
import { CLOSED_STAGE_CODE } from '../../shared/constants/stages.js';

const exportAssignee = alias(users, 'export_assignee');
const exportMover = alias(users, 'export_mover');

export interface ThroughputFilters {
  from?: Date;
  to?: Date;
}

/** Ordenes cerradas agrupadas por mes (YYYY-MM), calculado en SQL. */
export async function aggregateClosedByMonth(
  filters: ThroughputFilters,
  exec: DbExecutor = getDb(),
): Promise<Array<{ period: string; closedOrders: number }>> {
  const conditions = [isNotNull(orders.closedAt)];
  if (filters.from) conditions.push(gte(orders.closedAt, filters.from));
  if (filters.to) conditions.push(lte(orders.closedAt, filters.to));

  return exec
    .select({
      period: sql<string>`to_char(${orders.closedAt}, 'YYYY-MM')`,
      closedOrders: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(...conditions))
    .groupBy(sql`to_char(${orders.closedAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${orders.closedAt}, 'YYYY-MM')`);
}

/** Tiempo total desde la creacion de la orden hasta su cierre, en minutos. */
export async function averageLeadTimeMinutes(
  filters: ThroughputFilters,
  exec: DbExecutor = getDb(),
): Promise<number | null> {
  const conditions = [isNotNull(orders.closedAt)];
  if (filters.from) conditions.push(gte(orders.closedAt, filters.from));
  if (filters.to) conditions.push(lte(orders.closedAt, filters.to));

  const [row] = await exec
    .select({
      averageMinutes: sql<
        number | null
      >`round(avg(extract(epoch from (${orders.closedAt} - ${orders.createdAt})) / 60))::int`,
    })
    .from(orders)
    .where(and(...conditions));

  return row?.averageMinutes ?? null;
}

export async function countOpenAndClosedOrders(
  exec: DbExecutor = getDb(),
): Promise<{ open: number; closed: number }> {
  const [row] = await exec
    .select({
      open: sql<number>`count(*) filter (where ${stages.code} <> ${CLOSED_STAGE_CODE})::int`,
      closed: sql<number>`count(*) filter (where ${stages.code} = ${CLOSED_STAGE_CODE})::int`,
    })
    .from(orders)
    .innerJoin(stages, eq(stages.id, orders.currentStageId))
    .where(eq(orders.isArchived, false));

  return { open: row?.open ?? 0, closed: row?.closed ?? 0 };
}

export async function countClosedSince(
  since: Date,
  exec: DbExecutor = getDb(),
): Promise<number> {
  const [row] = await exec
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(isNotNull(orders.closedAt), gte(orders.closedAt, since)));
  return row?.total ?? 0;
}

/** Etapa con mas tramos cerrados que superaron su SLA. */
export async function stageWithMostSlaMisses(
  exec: DbExecutor = getDb(),
): Promise<{ stageId: string; stageCode: string; stageName: string; stagePosition: number; overdueCount: number } | null> {
  const rows = await exec
    .select({
      stageId: stages.id,
      stageCode: stages.code,
      stageName: stages.name,
      stagePosition: stages.position,
      overdueCount: sql<number>`count(*)::int`,
    })
    .from(orderStageHistory)
    .innerJoin(stages, eq(stages.id, orderStageHistory.stageId))
    .where(
      and(
        isNotNull(orderStageHistory.exitedAt),
        eq(stages.isSlaEnabled, true),
        isNotNull(stages.slaMinutes),
        sql`${orderStageHistory.elapsedMinutes} > ${stages.slaMinutes}`,
      ),
    )
    .groupBy(stages.id, stages.code, stages.name, stages.position)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  return rows[0] ?? null;
}

export interface HistoryExportRow {
  orderCode: string;
  customerName: string;
  projectName: string;
  stageName: string;
  assigneeName: string | null;
  movedByName: string | null;
  enteredAt: Date;
  exitedAt: Date | null;
  elapsedMinutes: number | null;
  transitionNote: string | null;
}

export async function listHistoryForExport(
  filters: { from?: Date; to?: Date; customer?: string; stageId?: string; assigneeId?: string },
  exec: DbExecutor = getDb(),
): Promise<HistoryExportRow[]> {
  const conditions = [];
  if (filters.from) conditions.push(gte(orderStageHistory.enteredAt, filters.from));
  if (filters.to) conditions.push(lte(orderStageHistory.enteredAt, filters.to));
  if (filters.stageId) conditions.push(eq(orderStageHistory.stageId, filters.stageId));
  if (filters.assigneeId) conditions.push(eq(orderStageHistory.assigneeId, filters.assigneeId));
  if (filters.customer) {
    conditions.push(sql`${orders.customerName} ilike ${`%${filters.customer}%`}`);
  }

  return exec
    .select({
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      projectName: orders.projectName,
      stageName: stages.name,
      assigneeName: exportAssignee.name,
      movedByName: exportMover.name,
      enteredAt: orderStageHistory.enteredAt,
      exitedAt: orderStageHistory.exitedAt,
      elapsedMinutes: orderStageHistory.elapsedMinutes,
      transitionNote: orderStageHistory.transitionNote,
    })
    .from(orderStageHistory)
    .innerJoin(orders, eq(orders.id, orderStageHistory.orderId))
    .innerJoin(stages, eq(stages.id, orderStageHistory.stageId))
    .leftJoin(exportAssignee, eq(exportAssignee.id, orderStageHistory.assigneeId))
    .leftJoin(exportMover, eq(exportMover.id, orderStageHistory.movedByUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(orders.orderCode), asc(orderStageHistory.enteredAt));
}
