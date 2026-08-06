import { randomUUID } from 'node:crypto';
import { logger } from '../config/logger.js';
import type { SlaCheckSummary } from '../../shared/types/index.js';
import { acquireCronLock, releaseCronLock } from '../repositories/cronLockRepository.js';
import { listOrderContexts } from '../repositories/orderRepository.js';
import { createAndDispatchAlerts, retryFailedAlerts, type AlertPlan } from './alertService.js';
import { SlaService } from './slaService.js';

export const SLA_LOCK_NAME = 'sla-check';
const LOCK_TTL_MS = 5 * 60 * 1000;

export interface SlaCheckOptions {
  trigger: 'cron' | 'manual';
  /** Permite fijar el instante de evaluacion en pruebas. */
  now?: Date;
}

/**
 * Servicio unico de revision de SLA. Lo consumen tanto `GET /api/cron/sla` como
 * `npm run check:sla`; no existe una segunda implementacion del algoritmo.
 */
export async function runSlaCheck(options: SlaCheckOptions): Promise<SlaCheckSummary> {
  const owner = `${options.trigger}:${randomUUID()}`;
  const acquired = await acquireCronLock(SLA_LOCK_NAME, LOCK_TTL_MS, owner);

  if (!acquired) {
    logger.warn({ trigger: options.trigger }, 'Revision de SLA omitida: ya hay una en curso');
    return {
      success: true,
      checkedOrders: 0,
      warningsCreated: 0,
      overdueCreated: 0,
      emailsSent: 0,
      consoleAlerts: 0,
      failedAlerts: 0,
      skipped: true,
      reason: 'Ya hay una revision de SLA en curso.',
    };
  }

  const now = options.now ?? new Date();
  let summary: SlaCheckSummary = {
    success: true,
    checkedOrders: 0,
    warningsCreated: 0,
    overdueCreated: 0,
    emailsSent: 0,
    consoleAlerts: 0,
    failedAlerts: 0,
  };

  try {
    // Solo ordenes activas: las cerradas y archivadas quedan fuera.
    const rows = await listOrderContexts(
      { includeClosed: false, includeArchived: false },
      { id: '', role: 'OWNER', stageFocusIds: [] },
    );

    const plans: AlertPlan[] = [];

    for (const row of rows) {
      const sla = SlaService.computeForRow(row, now);
      if (sla.state !== 'WARNING' && sla.state !== 'OVERDUE') continue;
      if (!row.openHistoryId) {
        logger.warn({ orderId: row.id }, 'Orden sin tramo abierto: se omite de la revision');
        continue;
      }

      plans.push({
        alertType: sla.state === 'WARNING' ? 'SLA_WARNING' : 'SLA_OVERDUE',
        sla,
        context: {
          orderId: row.id,
          orderCode: row.orderCode,
          customerName: row.customerName,
          projectName: row.projectName,
          stageName: row.stageName,
          assigneeId: row.assigneeId,
          assigneeName: row.assigneeName,
          stageHistoryId: row.openHistoryId,
        },
      });
    }

    const dispatch = await createAndDispatchAlerts(plans);
    const retried = await retryFailedAlerts();

    summary = {
      success: true,
      checkedOrders: rows.length,
      warningsCreated: dispatch.warningsCreated,
      overdueCreated: dispatch.overdueCreated,
      emailsSent: dispatch.emailsSent + retried.emailsSent,
      consoleAlerts: dispatch.consoleAlerts + retried.consoleAlerts,
      failedAlerts: dispatch.failedAlerts + retried.failedAlerts,
    };

    logger.info({ ...summary, trigger: options.trigger }, 'Revision de SLA completada');
    return summary;
  } catch (error) {
    logger.error({ err: error, trigger: options.trigger }, 'Fallo la revision de SLA');
    summary = { ...summary, success: false };
    throw error;
  } finally {
    // El lock se libera siempre, incluso ante error.
    await releaseCronLock(SLA_LOCK_NAME, summary).catch((error: unknown) => {
      logger.error({ err: error }, 'No se pudo liberar el lock de SLA');
    });
  }
}
