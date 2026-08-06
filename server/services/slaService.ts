import { computeSla, type SlaComputation, type SlaStageConfig } from '../../shared/lib/sla.js';
import type { StageCode } from '../../shared/constants/stages.js';
import type { OrderCard, OrderDetail, OrderSlaInfo, UserRef } from '../../shared/types/index.js';
import type { OrderContextRow } from '../repositories/orderRepository.js';

/**
 * Servicio de dominio de SLA. Es la unica puerta de entrada del backend a la
 * formula definida en `shared/lib/sla.ts`.
 */
export const SlaService = {
  compute(stage: SlaStageConfig, enteredAt: Date, now: Date): SlaComputation {
    return computeSla(stage, enteredAt, now);
  },

  computeForRow(row: OrderContextRow, now: Date): SlaComputation {
    return computeSla(
      {
        slaMinutes: row.stageSlaMinutes,
        warningBeforeMinutes: row.stageWarningBeforeMinutes,
        isSlaEnabled: row.stageIsSlaEnabled,
      },
      stageEnteredAt(row),
      now,
    );
  },
};

export function stageEnteredAt(row: OrderContextRow): Date {
  return row.stageEnteredAt ?? row.createdAt;
}

function toSlaInfo(computation: SlaComputation): OrderSlaInfo {
  return {
    state: computation.state,
    dueAt: computation.dueAt ? computation.dueAt.toISOString() : null,
    warningAt: computation.warningAt ? computation.warningAt.toISOString() : null,
    minutesInStage: computation.minutesInStage,
    minutesRemaining: computation.minutesRemaining,
    minutesOverdue: computation.minutesOverdue,
  };
}

function toAssignee(row: OrderContextRow): UserRef | null {
  if (!row.assigneeId || !row.assigneeName || !row.assigneeEmail || !row.assigneeRole) return null;
  return {
    id: row.assigneeId,
    name: row.assigneeName,
    email: row.assigneeEmail,
    role: row.assigneeRole,
  };
}

function toCreator(row: OrderContextRow): UserRef | null {
  if (!row.createdById || !row.createdByName || !row.createdByEmail || !row.createdByRole) {
    return null;
  }
  return {
    id: row.createdById,
    name: row.createdByName,
    email: row.createdByEmail,
    role: row.createdByRole,
  };
}

export function toOrderCard(row: OrderContextRow, now: Date): OrderCard {
  return {
    id: row.id,
    orderCode: row.orderCode,
    purchaseOrderNumber: row.purchaseOrderNumber,
    customerName: row.customerName,
    projectName: row.projectName,
    quantity: row.quantity,
    priority: row.priority,
    purchaseOrderDate: row.purchaseOrderDate,
    expectedDeliveryDate: row.expectedDeliveryDate,
    stage: {
      id: row.stageId,
      code: row.stageCode as StageCode,
      name: row.stageName,
      position: row.stagePosition,
    },
    assignee: toAssignee(row),
    stageEnteredAt: stageEnteredAt(row).toISOString(),
    sla: toSlaInfo(SlaService.computeForRow(row, now)),
    version: row.version,
    isArchived: row.isArchived,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  };
}

export function toOrderDetail(row: OrderContextRow, now: Date): OrderDetail {
  return {
    ...toOrderCard(row, now),
    description: row.description,
    createdBy: toCreator(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
