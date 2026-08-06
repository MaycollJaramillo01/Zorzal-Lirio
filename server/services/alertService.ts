import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { formatDuration } from '../../shared/lib/sla.js';
import { formatLongDate } from '../../shared/lib/datetime.js';
import type { AlertType } from '../../shared/constants/enums.js';
import type { SlaComputation } from '../../shared/lib/sla.js';
import {
  buildDedupeKey,
  findExistingDedupeKeys,
  findRecipientEmail,
  insertPendingAlerts,
  listRetryableAlerts,
  markAlertFailed,
  markAlertSent,
  type AlertRecord,
  type PendingAlertInput,
} from '../repositories/alertRepository.js';
import { listActiveUsersByRoles } from '../repositories/userRepository.js';
import { isEmailEnabled, logAlertToConsole, sendMail } from './mailer.js';

const MAX_ATTEMPTS = 3;

export interface AlertOrderContext {
  orderId: string;
  orderCode: string;
  customerName: string;
  projectName: string;
  stageName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  stageHistoryId: string;
}

export function buildAlertContent(
  context: AlertOrderContext,
  alertType: AlertType,
  sla: SlaComputation,
): { subject: string; message: string } {
  const dueAt = sla.dueAt ? formatLongDate(sla.dueAt, env.APP_TIMEZONE) : 'sin fecha limite';
  const responsable = context.assigneeName ?? 'Sin responsable asignado';

  if (alertType === 'SLA_WARNING') {
    return {
      subject: `[Zorzal Lirio] ${context.orderCode} esta proxima a vencer`,
      message: [
        `La orden ${context.orderCode} esta proxima a vencer.`,
        '',
        `Etapa: ${context.stageName}`,
        `Responsable: ${responsable}`,
        `Cliente: ${context.customerName}`,
        `Proyecto: ${context.projectName}`,
        `Fecha limite: ${dueAt}`,
        `Tiempo restante: ${formatDuration(Math.max(0, sla.minutesRemaining ?? 0))}`,
        '',
        `Ver la orden: ${env.APP_URL}/orders/${context.orderId}`,
      ].join('\n'),
    };
  }

  return {
    subject: `[Zorzal Lirio] ${context.orderCode} supero su SLA`,
    message: [
      `La orden ${context.orderCode} ha superado su SLA.`,
      '',
      `Etapa: ${context.stageName}`,
      `Responsable: ${responsable}`,
      `Cliente: ${context.customerName}`,
      `Proyecto: ${context.projectName}`,
      `Fecha limite: ${dueAt}`,
      `Atraso actual: ${formatDuration(sla.minutesOverdue ?? 0)}`,
      '',
      `Ver la orden: ${env.APP_URL}/orders/${context.orderId}`,
    ].join('\n'),
  };
}

/**
 * Destinatarios de una alerta: responsable actual mas duenos y administradores
 * activos, sin repetir usuarios.
 */
export async function resolveRecipients(assigneeId: string | null): Promise<string[]> {
  const managers = await listActiveUsersByRoles(['OWNER', 'ADMIN']);
  const ids = new Set(managers.map((manager) => manager.id));
  if (assigneeId) ids.add(assigneeId);
  return [...ids];
}

export interface AlertPlan {
  context: AlertOrderContext;
  alertType: AlertType;
  sla: SlaComputation;
}

export interface AlertDispatchResult {
  warningsCreated: number;
  overdueCreated: number;
  emailsSent: number;
  consoleAlerts: number;
  failedAlerts: number;
}

/**
 * Crea las alertas pendientes que aun no existen y las despacha.
 * Es idempotente: la clave unica impide duplicados entre ejecuciones.
 */
export async function createAndDispatchAlerts(plans: AlertPlan[]): Promise<AlertDispatchResult> {
  const result: AlertDispatchResult = {
    warningsCreated: 0,
    overdueCreated: 0,
    emailsSent: 0,
    consoleAlerts: 0,
    failedAlerts: 0,
  };

  const candidates: Array<PendingAlertInput & { alertType: AlertType }> = [];

  for (const plan of plans) {
    const recipients = await resolveRecipients(plan.context.assigneeId);
    const { subject, message } = buildAlertContent(plan.context, plan.alertType, plan.sla);

    for (const recipientUserId of recipients) {
      candidates.push({
        orderId: plan.context.orderId,
        stageHistoryId: plan.context.stageHistoryId,
        recipientUserId,
        alertType: plan.alertType,
        channel: isEmailEnabled() ? 'EMAIL' : 'CONSOLE',
        dedupeKey: buildDedupeKey(
          plan.context.orderId,
          plan.context.stageHistoryId,
          plan.alertType,
          recipientUserId,
        ),
        subject,
        message,
      });
    }
  }

  if (candidates.length === 0) return result;

  const existing = await findExistingDedupeKeys(candidates.map((item) => item.dedupeKey));
  const fresh = candidates.filter((item) => !existing.has(item.dedupeKey));
  if (fresh.length === 0) return result;

  const created = await insertPendingAlerts(fresh);

  for (const alert of created) {
    if (alert.alertType === 'SLA_WARNING') result.warningsCreated += 1;
    else result.overdueCreated += 1;
  }

  const dispatch = await dispatchAlerts(created);
  result.emailsSent += dispatch.emailsSent;
  result.consoleAlerts += dispatch.consoleAlerts;
  result.failedAlerts += dispatch.failedAlerts;

  return result;
}

async function dispatchAlerts(
  records: AlertRecord[],
): Promise<{ emailsSent: number; consoleAlerts: number; failedAlerts: number }> {
  let emailsSent = 0;
  let consoleAlerts = 0;
  let failedAlerts = 0;

  for (const alert of records) {
    const recipient = await findRecipientEmail(alert.recipientUserId);
    if (!recipient) {
      await markAlertFailed(alert.id, 'El destinatario ya no existe.');
      failedAlerts += 1;
      continue;
    }

    const message = { to: recipient.email, subject: alert.subject, text: alert.message };

    try {
      if (isEmailEnabled()) {
        await sendMail(message);
        emailsSent += 1;
      } else {
        logAlertToConsole(message);
        consoleAlerts += 1;
      }
      await markAlertSent(alert.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, alertId: alert.id }, 'No se pudo enviar la alerta');
      await markAlertFailed(alert.id, detail);
      failedAlerts += 1;
    }
  }

  return { emailsSent, consoleAlerts, failedAlerts };
}

/** Reintenta las alertas fallidas que aun tienen intentos disponibles. */
export async function retryFailedAlerts(limit = 50): Promise<{
  emailsSent: number;
  consoleAlerts: number;
  failedAlerts: number;
}> {
  const pending = await listRetryableAlerts(MAX_ATTEMPTS, limit);
  if (pending.length === 0) return { emailsSent: 0, consoleAlerts: 0, failedAlerts: 0 };
  return dispatchAlerts(pending);
}
