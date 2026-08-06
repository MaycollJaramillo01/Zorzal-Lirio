import { z } from 'zod';
import { PRIORITIES, SLA_STATES } from '../constants/enums.js';
import { boolParamSchema, calendarDateSchema, uuidSchema } from './common.js';

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const createOrderSchema = z.object({
  purchaseOrderNumber: shortText(80),
  customerName: shortText(160),
  projectName: shortText(160),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser mayor a cero.').max(1_000_000),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  purchaseOrderDate: calendarDateSchema,
  expectedDeliveryDate: calendarDateSchema.optional().or(z.literal('')),
  initialAssigneeId: uuidSchema,
  initialNote: z.string().trim().max(4000).optional().or(z.literal('')),
});

export const updateOrderSchema = z.object({
  version: z.coerce.number().int().min(1),
  purchaseOrderNumber: shortText(80).optional(),
  customerName: shortText(160).optional(),
  projectName: shortText(160).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(1_000_000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  purchaseOrderDate: calendarDateSchema.optional(),
  expectedDeliveryDate: calendarDateSchema.nullable().optional(),
});

export const transitionOrderSchema = z.object({
  version: z.coerce.number().int().min(1),
  toStageId: uuidSchema,
  assigneeId: uuidSchema.nullable().optional(),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
  reason: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const reassignOrderSchema = z.object({
  version: z.coerce.number().int().min(1),
  assigneeId: uuidSchema,
  note: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const archiveOrderSchema = z.object({
  version: z.coerce.number().int().min(1),
  reason: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const createNoteSchema = z.object({
  body: z.string().trim().min(1, 'Escribe el contenido de la nota.').max(4000),
});

export const orderFiltersSchema = z.object({
  search: z.string().trim().max(160).optional(),
  stageId: uuidSchema.optional(),
  /** uuid del responsable, `me` o `unassigned`. */
  assignee: z.union([uuidSchema, z.enum(['me', 'unassigned'])]).optional(),
  priority: z.enum(PRIORITIES).optional(),
  sla: z.enum(SLA_STATES).optional(),
  customer: z.string().trim().max(160).optional(),
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  onlyMine: boolParamSchema.optional(),
  includeClosed: boolParamSchema.optional(),
  includeArchived: boolParamSchema.optional(),
});

/** Valores tal como los escribe el formulario, antes de aplicar los defaults. */
export type CreateOrderFormValues = z.input<typeof createOrderSchema>;

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>;
export type ReassignOrderInput = z.infer<typeof reassignOrderSchema>;
export type ArchiveOrderInput = z.infer<typeof archiveOrderSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type OrderFilters = z.infer<typeof orderFiltersSchema>;
