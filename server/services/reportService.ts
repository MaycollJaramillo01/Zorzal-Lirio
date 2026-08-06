import { calendarDateToUtc } from '../../shared/lib/datetime.js';
import { formatDuration } from '../../shared/lib/sla.js';
import { CLOSED_STAGE_CODE } from '../../shared/constants/stages.js';
import type { ReportFilters } from '../../shared/schemas/reports.js';
import type {
  DashboardSummary,
  OrderCard,
  OverdueRow,
  StageTimeRow,
  ThroughputReport,
  UserRef,
  WorkloadRow,
} from '../../shared/types/index.js';
import type { StageCode } from '../../shared/constants/stages.js';
import type { AuthUser } from '../types/auth.js';
import { aggregateStageDurations, listRecentActivity } from '../repositories/historyRepository.js';
import {
  aggregateClosedByMonth,
  averageLeadTimeMinutes,
  countClosedSince,
  countOpenAndClosedOrders,
  listHistoryForExport,
  stageWithMostSlaMisses,
} from '../repositories/reportRepository.js';
import { listStages, toStageDto } from '../repositories/stageRepository.js';
import { loadActiveOrderCards } from './orderService.js';

function rangeFrom(filters: ReportFilters): { from?: Date; to?: Date } {
  return {
    from: filters.from ? calendarDateToUtc(filters.from) : undefined,
    to: filters.to ? calendarDateToUtc(filters.to) : undefined,
  };
}

function matchesFilters(card: OrderCard, filters: ReportFilters): boolean {
  if (filters.customer && !card.customerName.toLowerCase().includes(filters.customer.toLowerCase())) {
    return false;
  }
  if (filters.assigneeId && card.assignee?.id !== filters.assigneeId) return false;
  if (filters.stageId && card.stage.id !== filters.stageId) return false;
  if (filters.priority && card.priority !== filters.priority) return false;
  if (filters.sla && card.sla.state !== filters.sla) return false;
  if (filters.from && card.purchaseOrderDate < filters.from) return false;
  if (filters.to && card.purchaseOrderDate > filters.to) return false;
  return true;
}

async function filteredActiveCards(filters: ReportFilters): Promise<OrderCard[]> {
  const cards = await loadActiveOrderCards();
  return cards.filter((card) => matchesFilters(card, filters));
}

export async function getWorkloadReport(filters: ReportFilters): Promise<WorkloadRow[]> {
  const cards = await filteredActiveCards(filters);
  const byUser = new Map<string, WorkloadRow>();

  for (const card of cards) {
    if (!card.assignee) continue;
    const existing =
      byUser.get(card.assignee.id) ??
      ({
        user: card.assignee,
        activeOrders: 0,
        warningOrders: 0,
        overdueOrders: 0,
        byStage: [],
      } satisfies WorkloadRow);

    existing.activeOrders += 1;
    if (card.sla.state === 'WARNING') existing.warningOrders += 1;
    if (card.sla.state === 'OVERDUE') existing.overdueOrders += 1;

    const stageEntry = existing.byStage.find((item) => item.stage.id === card.stage.id);
    if (stageEntry) stageEntry.orders += 1;
    else existing.byStage.push({ stage: card.stage, orders: 1 });

    byUser.set(card.assignee.id, existing);
  }

  return [...byUser.values()].sort((a, b) => b.activeOrders - a.activeOrders);
}

export async function getOverdueReport(filters: ReportFilters): Promise<OverdueRow[]> {
  const cards = await filteredActiveCards(filters);
  return cards
    .filter((card) => card.sla.state === 'OVERDUE' && card.sla.dueAt)
    .map((card) => ({
      orderId: card.id,
      orderCode: card.orderCode,
      customerName: card.customerName,
      projectName: card.projectName,
      stage: card.stage,
      assignee: card.assignee,
      enteredAt: card.stageEnteredAt,
      dueAt: card.sla.dueAt!,
      minutesOverdue: card.sla.minutesOverdue ?? 0,
      priority: card.priority,
    }))
    .sort((a, b) => b.minutesOverdue - a.minutesOverdue);
}

export async function getStageTimesReport(filters: ReportFilters): Promise<StageTimeRow[]> {
  const rows = await aggregateStageDurations(rangeFrom(filters));
  return rows.map((row) => {
    const evaluated = row.metSla + row.missedSla;
    return {
      stage: {
        id: row.stageId,
        code: row.stageCode as StageCode,
        name: row.stageName,
        position: row.stagePosition,
      },
      completedOrders: row.completedOrders,
      averageMinutes: row.averageMinutes,
      medianMinutes: row.medianMinutes,
      minMinutes: row.minMinutes,
      maxMinutes: row.maxMinutes,
      metSlaPercent: evaluated > 0 ? Math.round((row.metSla / evaluated) * 100) : null,
      missedSlaPercent: evaluated > 0 ? Math.round((row.missedSla / evaluated) * 100) : null,
    };
  });
}

export async function getThroughputReport(filters: ReportFilters): Promise<ThroughputReport> {
  const range = rangeFrom(filters);
  const [counts, closedByPeriod, leadTime, stageTimes, worstStage] = await Promise.all([
    countOpenAndClosedOrders(),
    aggregateClosedByMonth(range),
    averageLeadTimeMinutes(range),
    getStageTimesReport(filters),
    stageWithMostSlaMisses(),
  ]);

  const overdue = (await getOverdueReport(filters)).length;

  const slowest = stageTimes
    .filter((row) => row.averageMinutes !== null)
    .sort((a, b) => (b.averageMinutes ?? 0) - (a.averageMinutes ?? 0))[0];

  return {
    openOrders: counts.open,
    closedOrders: counts.closed,
    overdueOrders: overdue,
    averageLeadTimeMinutes: leadTime,
    closedByPeriod,
    slowestStage: slowest ? { stage: slowest.stage, averageMinutes: slowest.averageMinutes! } : null,
    mostOverdueStage: worstStage
      ? {
          stage: {
            id: worstStage.stageId,
            code: worstStage.stageCode as StageCode,
            name: worstStage.stageName,
            position: worstStage.stagePosition,
          },
          overdueCount: worstStage.overdueCount,
        }
      : null,
  };
}

export async function getDashboard(viewer: AuthUser): Promise<DashboardSummary> {
  const all = await loadActiveOrderCards();
  const isPlant = viewer.role === 'PLANT';
  const cards = isPlant
    ? all.filter(
        (card) =>
          card.assignee?.id === viewer.id || viewer.stageFocusIds.includes(card.stage.id),
      )
    : all;

  const stages = (await listStages()).map(toStageDto);
  const startOfMonth = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 0, 0, 0),
  );

  const [closedThisMonth, leadTime, activity] = await Promise.all([
    countClosedSince(startOfMonth),
    averageLeadTimeMinutes({}),
    listRecentActivity(10, isPlant ? viewer.id : null),
  ]);

  const stageDistribution = stages
    .filter((stage) => stage.code !== CLOSED_STAGE_CODE)
    .map((stage) => {
      const inStage = cards.filter((card) => card.stage.id === stage.id);
      return {
        stage: { id: stage.id, code: stage.code, name: stage.name, position: stage.position },
        orders: inStage.length,
        overdue: inStage.filter((card) => card.sla.state === 'OVERDUE').length,
      };
    });

  const busiest = [...stageDistribution].sort((a, b) => b.orders - a.orders)[0];

  const workloadMap = new Map<string, { user: UserRef; activeOrders: number; warningOrders: number; overdueOrders: number }>();
  for (const card of cards) {
    if (!card.assignee) continue;
    const entry = workloadMap.get(card.assignee.id) ?? {
      user: card.assignee,
      activeOrders: 0,
      warningOrders: 0,
      overdueOrders: 0,
    };
    entry.activeOrders += 1;
    if (card.sla.state === 'WARNING') entry.warningOrders += 1;
    if (card.sla.state === 'OVERDUE') entry.overdueOrders += 1;
    workloadMap.set(card.assignee.id, entry);
  }

  return {
    activeOrders: cards.length,
    warningOrders: cards.filter((card) => card.sla.state === 'WARNING').length,
    overdueOrders: cards.filter((card) => card.sla.state === 'OVERDUE').length,
    closedThisMonth,
    averageLeadTimeMinutes: leadTime,
    busiestStage: busiest && busiest.orders > 0 ? { stage: busiest.stage, orders: busiest.orders } : null,
    stageDistribution,
    workload: [...workloadMap.values()].sort((a, b) => b.activeOrders - a.activeOrders),
    topOverdue: cards
      .filter((card) => card.sla.state === 'OVERDUE')
      .sort((a, b) => (b.sla.minutesOverdue ?? 0) - (a.sla.minutesOverdue ?? 0))
      .slice(0, 5),
    recentActivity: activity.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      orderCode: item.orderCode,
      stageName: item.stageName,
      assigneeName: item.assigneeName,
      movedByName: item.movedByName,
      enteredAt: item.enteredAt.toISOString(),
    })),
  };
}

export async function getHistoryExportRows(filters: ReportFilters) {
  const range = rangeFrom(filters);
  return listHistoryForExport({
    from: range.from,
    to: range.to,
    customer: filters.customer,
    stageId: filters.stageId,
    assigneeId: filters.assigneeId,
  });
}

export { formatDuration };
