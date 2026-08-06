import { and, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, type DbExecutor } from '../db/client.js';
import { auditLogs, users } from '../db/schema.js';
import type { AuditAction, Role } from '../../shared/constants/enums.js';

const actorUser = alias(users, 'audit_actor');

export interface AuditInput {
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
}

export async function insertAuditLog(input: AuditInput, exec: DbExecutor = getDb()) {
  await exec.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeData: input.beforeData ?? null,
    afterData: input.afterData ?? null,
    metadata: input.metadata ?? null,
    ipAddress: input.ipAddress ?? null,
  });
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: Date;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: Role | null;
}

export async function listAuditForEntity(
  entityType: string,
  entityId: string,
  pagination: { page: number; pageSize: number },
  exec: DbExecutor = getDb(),
): Promise<{ items: AuditRow[]; total: number }> {
  const where = and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId));

  const [totalRow] = await exec
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);

  const items = await exec
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      beforeData: auditLogs.beforeData,
      afterData: auditLogs.afterData,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorId: actorUser.id,
      actorName: actorUser.name,
      actorEmail: actorUser.email,
      actorRole: actorUser.role,
    })
    .from(auditLogs)
    .leftJoin(actorUser, eq(actorUser.id, auditLogs.actorUserId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize);

  return { items, total: totalRow?.total ?? 0 };
}
