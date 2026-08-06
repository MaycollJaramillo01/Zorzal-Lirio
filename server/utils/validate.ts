import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';
import { httpErrors } from './appError.js';

/** Valida una entrada y lanza `AppError` 422 con detalles por campo. */
export function parseInput<S extends ZodTypeAny>(schema: S, data: unknown): TypeOf<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw httpErrors.validation(formatZodError(result.error));
  }
  return result.data;
}

export function formatZodError(error: ZodError): { fields: Record<string, string[]> } {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return { fields };
}
