import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../db/client.js';
import { alerts, orders, users } from '../db/schema.js';
import type { AlertChannel, AlertType } from '../../shared/constants/enums.js';

export type AlertRecord = typeof alerts.$inferSelect;

export function buildDedupeKey(
  orderId: string,
  stageHistoryId: string,
  alertType: AlertType,
  recipientUserId: string,
): string {
  return `${orderId}:${stageHistoryId}:${alertType}:${recipientUserId}`;
}

export async function findExistingDedupeKeys(
  keys: string[],
  exec: DbExecutor = getDb(),
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await exec
    .select({ dedupeKey: alerts.dedupeKey })
    .from(alerts)
    .where(inArray(alerts.dedupeKey, keys));
  return new Set(rows.map((row) => row.dedupeKey));
}

export interface PendingAlertInput {
  orderId: string;
  stageHistoryId: string;
  recipientUserId: string;
  alertType: AlertType;
  channel: AlertChannel;
  dedupeKey: string;
  subject: string;
  message: string;
}

/**
 * Inserta las alertas pendientes ignorando las que ya existen (idempotente).
 * Devuelve solamente las filas realmente creadas.
 */
export async function insertPendingAlerts(
  inputs: PendingAlertInput[],
  exec: DbExecutor = getDb(),
): Promise<AlertRecord[]> {
  if (inputs.length === 0) return [];
  return exec
    .insert(alerts)
    .values(inputs.map((input) => ({ ...input, status: 'PENDING' as const })))
    .onConflictDoNothing({ target: alerts.dedupeKey })
    .returning();
}

export async function markAlertSent(id: string, exec: DbExecutor = getDb()) {
  await exec
    .update(alerts)
    .set({
      status: 'SENT',
      sentAt: new Date(),
      failedAt: null,
      errorMessage: null,
      attemptCount: sql`${alerts.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, id));
}

export async function markAlertFailed(
  id: string,
  errorMessage: string,
  exec: DbExecutor = getDb(),
) {
  await exec
    .update(alerts)
    .set({
      status: 'FAILED',
      failedAt: new Date(),
      errorMessage: errorMessage.slice(0, 1000),
      attemptCount: sql`${alerts.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, id));
}

/** Alertas fallidas con reintentos disponibles, para el siguiente ciclo del cron. */
export async function listRetryableAlerts(
  maxAttempts: number,
  limit: number,
  exec: DbExecutor = getDb(),
): Promise<AlertRecord[]> {
  return exec
    .select()
    .from(alerts)
    .where(and(eq(alerts.status, 'FAILED'), sql`${alerts.attemptCount} < ${maxAttempts}`))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}

export async function listRecentAlerts(limit: number, exec: DbExecutor = getDb()) {
  return exec
    .select({
      id: alerts.id,
      orderId: alerts.orderId,
      orderCode: orders.orderCode,
      alertType: alerts.alertType,
      channel: alerts.channel,
      status: alerts.status,
      recipientEmail: users.email,
      subject: alerts.subject,
      sentAt: alerts.sentAt,
      failedAt: alerts.failedAt,
      errorMessage: alerts.errorMessage,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .innerJoin(orders, eq(orders.id, alerts.orderId))
    .innerJoin(users, eq(users.id, alerts.recipientUserId))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}

export async function findRecipientEmail(
  userId: string,
  exec: DbExecutor = getDb(),
): Promise<{ name: string; email: string } | null> {
  const [row] = await exec
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
