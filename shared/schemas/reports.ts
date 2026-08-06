import { z } from 'zod';
import { PRIORITIES, SLA_STATES } from '../constants/enums.js';
import { calendarDateSchema, uuidSchema } from './common.js';

export const REPORT_EXPORTS = ['workload', 'overdue', 'stage-times', 'history'] as const;
export type ReportExport = (typeof REPORT_EXPORTS)[number];

export const REPORT_EXPORT_LABELS: Record<ReportExport, string> = {
  workload: 'Carga por persona',
  overdue: 'Ordenes atrasadas',
  'stage-times': 'Tiempos por etapa',
  history: 'Historial de ordenes',
};

export const reportFiltersSchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  customer: z.string().trim().max(160).optional(),
  assigneeId: uuidSchema.optional(),
  stageId: uuidSchema.optional(),
  priority: z.enum(PRIORITIES).optional(),
  sla: z.enum(SLA_STATES).optional(),
});

export const reportExportSchema = reportFiltersSchema.extend({
  report: z.enum(REPORT_EXPORTS),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type ReportExportInput = z.infer<typeof reportExportSchema>;
