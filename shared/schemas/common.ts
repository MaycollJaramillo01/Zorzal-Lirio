import { z } from 'zod';

export const uuidSchema = z.string().uuid('Identificador invalido.');

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.');

/** Booleano tolerante para query strings: "true"/"1" son verdaderos. */
export const boolParamSchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Escribe un correo valido.')
  .max(160);

export const passwordSchema = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres.')
  .max(200);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type Pagination = z.infer<typeof paginationSchema>;
