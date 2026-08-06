import type { DbExecutor } from '../db/client.js';
import { insertAuditLog, type AuditInput, listAuditForEntity } from '../repositories/auditRepository.js';
import { AUDIT_ACTION_LABELS, type AuditAction } from '../../shared/constants/enums.js';
import type { AuditEntry } from '../../shared/types/index.js';
import type { AuditRow } from '../repositories/auditRepository.js';

export async function recordAudit(input: AuditInput, exec?: DbExecutor): Promise<void> {
  await insertAuditLog(input, exec);
}

export function toAuditEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    action: row.action as AuditAction,
    entityType: row.entityType,
    entityId: row.entityId,
    actor:
      row.actorId && row.actorName && row.actorEmail && row.actorRole
        ? { id: row.actorId, name: row.actorName, email: row.actorEmail, role: row.actorRole }
        : null,
    beforeData: row.beforeData,
    afterData: row.afterData,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOrderAudit(orderId: string, page: number, pageSize: number) {
  const { items, total } = await listAuditForEntity('order', orderId, { page, pageSize });
  return { items: items.map(toAuditEntry), total };
}

export function auditActionLabel(action: AuditAction): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
