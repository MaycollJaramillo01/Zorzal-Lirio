import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, type DbExecutor } from '../db/client.js';
import { orderSequences, orderStageHistory, orders, stages, users } from '../db/schema.js';
import type { Priority, Role } from '../../shared/constants/enums.js';
import type { StageCode } from '../../shared/constants/stages.js';
import { CLOSED_STAGE_CODE } from '../../shared/constants/stages.js';

const assigneeUser = alias(users, 'assignee_user');
const creatorUser = alias(users, 'creator_user');
const openHistory = alias(orderStageHistory, 'open_history');

export interface OrderContextRow {
  id: string;
  orderCode: string;
  purchaseOrderNumber: string;
  customerName: string;
  projectName: string;
  description: string | null;
  quantity: number;
  priority: Priority;
  purchaseOrderDate: string;
  expectedDeliveryDate: string | null;
  version: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  saleAmountCents: number;
  productionCostCents: number;
  paidAt: Date | null;
  stageId: string;
  stageCode: string;
  stageName: string;
  stagePosition: number;
  stageSlaMinutes: number | null;
  stageWarningBeforeMinutes: number | null;
  stageIsSlaEnabled: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeRole: Role | null;
  createdById: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdByRole: Role | null;
  openHistoryId: string | null;
  stageEnteredAt: Date | null;
}

const orderSelection = {
  id: orders.id,
  orderCode: orders.orderCode,
  purchaseOrderNumber: orders.purchaseOrderNumber,
  customerName: orders.customerName,
  projectName: orders.projectName,
  description: orders.description,
  quantity: orders.quantity,
  priority: orders.priority,
  purchaseOrderDate: orders.purchaseOrderDate,
  expectedDeliveryDate: orders.expectedDeliveryDate,
  version: orders.version,
  isArchived: orders.isArchived,
  createdAt: orders.createdAt,
  updatedAt: orders.updatedAt,
  closedAt: orders.closedAt,
  saleAmountCents: orders.saleAmountCents,
  productionCostCents: orders.productionCostCents,
  paidAt: orders.paidAt,
  stageId: stages.id,
  stageCode: stages.code,
  stageName: stages.name,
  stagePosition: stages.position,
  stageSlaMinutes: stages.slaMinutes,
  stageWarningBeforeMinutes: stages.warningBeforeMinutes,
  stageIsSlaEnabled: stages.isSlaEnabled,
  assigneeId: assigneeUser.id,
  assigneeName: assigneeUser.name,
  assigneeEmail: assigneeUser.email,
  assigneeRole: assigneeUser.role,
  createdById: creatorUser.id,
  createdByName: creatorUser.name,
  createdByEmail: creatorUser.email,
  createdByRole: creatorUser.role,
  openHistoryId: openHistory.id,
  stageEnteredAt: openHistory.enteredAt,
};

function baseQuery(exec: DbExecutor) {
  return exec
    .select(orderSelection)
    .from(orders)
    .innerJoin(stages, eq(stages.id, orders.currentStageId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, orders.currentAssigneeId))
    .leftJoin(creatorUser, eq(creatorUser.id, orders.createdByUserId))
    .leftJoin(
      openHistory,
      and(eq(openHistory.orderId, orders.id), isNull(openHistory.exitedAt)),
    );
}

function likeTerm(value: string): string {
  return `%${value.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
}

export interface OrderQueryFilters {
  search?: string;
  stageId?: string;
  assignee?: string;
  priority?: Priority;
  customer?: string;
  from?: string;
  to?: string;
  includeClosed?: boolean;
  includeArchived?: boolean;
  onlyMine?: boolean;
}

export interface Viewer {
  id: string;
  role: Role;
  stageFocusIds: string[];
}

export async function listOrderContexts(
  filters: OrderQueryFilters,
  viewer: Viewer,
  exec: DbExecutor = getDb(),
): Promise<OrderContextRow[]> {
  const conditions = [];

  if (!filters.includeArchived) {
    conditions.push(eq(orders.isArchived, false));
  }
  if (filters.includeClosed === false) {
    conditions.push(ne(stages.code, CLOSED_STAGE_CODE));
  }
  if (filters.stageId) {
    conditions.push(eq(orders.currentStageId, filters.stageId));
  }
  if (filters.priority) {
    conditions.push(eq(orders.priority, filters.priority));
  }
  if (filters.customer) {
    conditions.push(ilike(orders.customerName, likeTerm(filters.customer)));
  }
  if (filters.from) {
    conditions.push(gte(orders.purchaseOrderDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(orders.purchaseOrderDate, filters.to));
  }
  if (filters.search) {
    const term = likeTerm(filters.search);
    conditions.push(
      or(
        ilike(orders.orderCode, term),
        ilike(orders.purchaseOrderNumber, term),
        ilike(orders.customerName, term),
        ilike(orders.projectName, term),
      )!,
    );
  }

  const assigneeFilter = filters.onlyMine ? viewer.id : filters.assignee;
  if (assigneeFilter === 'me') {
    conditions.push(eq(orders.currentAssigneeId, viewer.id));
  } else if (assigneeFilter === 'unassigned') {
    conditions.push(isNull(orders.currentAssigneeId));
  } else if (assigneeFilter) {
    conditions.push(eq(orders.currentAssigneeId, assigneeFilter));
  }

  // Visibilidad de planta: ordenes propias o de sus etapas de enfoque.
  if (viewer.role === 'PLANT') {
    const visibility =
      viewer.stageFocusIds.length > 0
        ? or(
            eq(orders.currentAssigneeId, viewer.id),
            inArray(orders.currentStageId, viewer.stageFocusIds),
          )!
        : eq(orders.currentAssigneeId, viewer.id);
    conditions.push(visibility);
  }

  return baseQuery(exec)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(stages.position), asc(openHistory.enteredAt), desc(orders.createdAt));
}

export async function findOrderContext(
  id: string,
  exec: DbExecutor = getDb(),
): Promise<OrderContextRow | null> {
  const rows = await baseQuery(exec).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findOrderRow(id: string, exec: DbExecutor = getDb()) {
  const [row] = await exec.select().from(orders).where(eq(orders.id, id)).limit(1);
  return row ?? null;
}

/**
 * Consecutivo seguro ante concurrencia: un upsert atomico por ano devuelve
 * siempre un numero distinto, incluso con transacciones simultaneas.
 */
export async function nextOrderCode(exec: DbExecutor, year: number): Promise<string> {
  const [row] = await exec
    .insert(orderSequences)
    .values({ year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: orderSequences.year,
      set: { lastNumber: sql`${orderSequences.lastNumber} + 1`, updatedAt: new Date() },
    })
    .returning({ lastNumber: orderSequences.lastNumber });

  const sequence = row?.lastNumber ?? 1;
  return `ZL-${year}-${String(sequence).padStart(4, '0')}`;
}

export interface InsertOrderData {
  orderCode: string;
  purchaseOrderNumber: string;
  customerName: string;
  projectName: string;
  description: string | null;
  quantity: number;
  priority: Priority;
  purchaseOrderDate: string;
  expectedDeliveryDate: string | null;
  currentStageId: string;
  currentAssigneeId: string;
  createdByUserId: string;
}

export async function insertOrder(exec: DbExecutor, data: InsertOrderData) {
  const [row] = await exec.insert(orders).values(data).returning();
  return row!;
}

export interface OrderUpdateFields {
  purchaseOrderNumber?: string;
  customerName?: string;
  projectName?: string;
  description?: string | null;
  quantity?: number;
  priority?: Priority;
  purchaseOrderDate?: string;
  expectedDeliveryDate?: string | null;
  currentStageId?: string;
  currentAssigneeId?: string | null;
  isArchived?: boolean;
  closedAt?: Date | null;
  saleAmountCents?: number;
  productionCostCents?: number;
  paidAt?: Date | null;
}

/**
 * Actualiza aplicando control de concurrencia optimista. Devuelve `null` cuando
 * la version enviada ya no coincide.
 */
export async function updateOrderWithVersion(
  exec: DbExecutor,
  id: string,
  expectedVersion: number,
  fields: OrderUpdateFields,
) {
  const [row] = await exec
    .update(orders)
    .set({ ...fields, version: sql`${orders.version} + 1`, updatedAt: new Date() })
    .where(and(eq(orders.id, id), eq(orders.version, expectedVersion)))
    .returning();
  return row ?? null;
}

export async function listStageCodesById(
  exec: DbExecutor = getDb(),
): Promise<Map<string, StageCode>> {
  const rows = await exec.select({ id: stages.id, code: stages.code }).from(stages);
  return new Map(rows.map((row) => [row.id, row.code as StageCode]));
}
