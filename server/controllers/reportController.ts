import type { RequestHandler } from 'express';
import { reportExportSchema, reportFiltersSchema } from '../../shared/schemas/reports.js';
import { parseInput } from '../utils/validate.js';
import { sendOk } from '../utils/apiResponse.js';
import { getAuth } from '../middleware/auth.js';
import { csvFilename, toCsv } from '../utils/csv.js';
import { formatDateTime } from '../../shared/lib/datetime.js';
import { formatDuration } from '../../shared/lib/sla.js';
import { PRIORITY_LABELS, ROLE_LABELS } from '../../shared/constants/enums.js';
import { env } from '../config/env.js';
import {
  getDashboard,
  getHistoryExportRows,
  getOverdueReport,
  getStageTimesReport,
  getThroughputReport,
  getWorkloadReport,
} from '../services/reportService.js';

export const getSummary: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  sendOk(res, await getDashboard(auth.user));
};

export const getWorkload: RequestHandler = async (req, res) => {
  const filters = parseInput(reportFiltersSchema, req.query);
  sendOk(res, { rows: await getWorkloadReport(filters) });
};

export const getOverdue: RequestHandler = async (req, res) => {
  const filters = parseInput(reportFiltersSchema, req.query);
  sendOk(res, { rows: await getOverdueReport(filters) });
};

export const getStageTimes: RequestHandler = async (req, res) => {
  const filters = parseInput(reportFiltersSchema, req.query);
  sendOk(res, { rows: await getStageTimesReport(filters) });
};

export const getThroughput: RequestHandler = async (req, res) => {
  const filters = parseInput(reportFiltersSchema, req.query);
  sendOk(res, await getThroughputReport(filters));
};

/** Exportacion CSV que respeta los filtros activos. */
export const getExport: RequestHandler = async (req, res) => {
  const input = parseInput(reportExportSchema, req.query);
  const { report, ...filters } = input;
  const tz = env.APP_TIMEZONE;

  let csv: string;
  let prefix: string;

  switch (report) {
    case 'workload': {
      const rows = await getWorkloadReport(filters);
      prefix = 'carga-por-persona';
      csv = toCsv(rows, [
        { header: 'Responsable', value: (row) => row.user.name },
        { header: 'Correo', value: (row) => row.user.email },
        { header: 'Rol', value: (row) => ROLE_LABELS[row.user.role] },
        { header: 'Ordenes activas', value: (row) => row.activeOrders },
        { header: 'Proximas a vencer', value: (row) => row.warningOrders },
        { header: 'Atrasadas', value: (row) => row.overdueOrders },
        {
          header: 'Distribucion por etapa',
          value: (row) => row.byStage.map((item) => `${item.stage.name}: ${item.orders}`).join(' | '),
        },
      ]);
      break;
    }
    case 'overdue': {
      const rows = await getOverdueReport(filters);
      prefix = 'ordenes-atrasadas';
      csv = toCsv(rows, [
        { header: 'Codigo', value: (row) => row.orderCode },
        { header: 'Cliente', value: (row) => row.customerName },
        { header: 'Proyecto', value: (row) => row.projectName },
        { header: 'Etapa', value: (row) => row.stage.name },
        { header: 'Responsable', value: (row) => row.assignee?.name ?? 'Sin asignar' },
        { header: 'Entrada a la etapa', value: (row) => formatDateTime(row.enteredAt, tz) },
        { header: 'Fecha limite', value: (row) => formatDateTime(row.dueAt, tz) },
        { header: 'Tiempo atrasado', value: (row) => formatDuration(row.minutesOverdue) },
        { header: 'Minutos atrasado', value: (row) => row.minutesOverdue },
        { header: 'Prioridad', value: (row) => PRIORITY_LABELS[row.priority] },
      ]);
      break;
    }
    case 'stage-times': {
      const rows = await getStageTimesReport(filters);
      prefix = 'tiempos-por-etapa';
      csv = toCsv(rows, [
        { header: 'Etapa', value: (row) => row.stage.name },
        { header: 'Ordenes completadas', value: (row) => row.completedOrders },
        { header: 'Promedio', value: (row) => (row.averageMinutes === null ? '' : formatDuration(row.averageMinutes)) },
        { header: 'Mediana', value: (row) => (row.medianMinutes === null ? '' : formatDuration(row.medianMinutes)) },
        { header: 'Minimo', value: (row) => (row.minMinutes === null ? '' : formatDuration(row.minMinutes)) },
        { header: 'Maximo', value: (row) => (row.maxMinutes === null ? '' : formatDuration(row.maxMinutes)) },
        { header: '% cumplio SLA', value: (row) => row.metSlaPercent ?? '' },
        { header: '% incumplio SLA', value: (row) => row.missedSlaPercent ?? '' },
      ]);
      break;
    }
    case 'history': {
      const rows = await getHistoryExportRows(filters);
      prefix = 'historial-de-ordenes';
      csv = toCsv(rows, [
        { header: 'Codigo', value: (row) => row.orderCode },
        { header: 'Cliente', value: (row) => row.customerName },
        { header: 'Proyecto', value: (row) => row.projectName },
        { header: 'Etapa', value: (row) => row.stageName },
        { header: 'Responsable', value: (row) => row.assigneeName ?? '' },
        { header: 'Movido por', value: (row) => row.movedByName ?? '' },
        { header: 'Entrada', value: (row) => formatDateTime(row.enteredAt, tz) },
        { header: 'Salida', value: (row) => (row.exitedAt ? formatDateTime(row.exitedAt, tz) : '') },
        {
          header: 'Tiempo en etapa',
          value: (row) => (row.elapsedMinutes === null ? '' : formatDuration(row.elapsedMinutes)),
        },
        { header: 'Nota de transicion', value: (row) => row.transitionNote ?? '' },
      ]);
      break;
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${csvFilename(prefix)}"`);
  res.status(200).send(csv);
};
