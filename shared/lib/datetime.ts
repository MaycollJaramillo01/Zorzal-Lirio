import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

/** Zona horaria de presentacion. El almacenamiento siempre es UTC. */
export const DEFAULT_TIMEZONE = 'America/Managua';

export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(value: Date | string | number, timeZone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), timeZone, "dd/MM/yyyy HH:mm", { locale: es });
}

export function formatDate(value: Date | string | number, timeZone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), timeZone, 'dd/MM/yyyy', { locale: es });
}

/** Formato largo para correos: "8 de agosto de 2026". */
export function formatLongDate(value: Date | string | number, timeZone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), timeZone, "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function formatLongDateTime(
  value: Date | string | number,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(toDate(value), timeZone, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
}

/** Convierte "2026-08-06" (fecha de calendario) a un Date UTC estable a mediodia. */
export function calendarDateToUtc(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

/** Devuelve "YYYY-MM-DD" a partir de una fecha almacenada. */
export function toCalendarDate(value: Date | string | number): string {
  return toDate(value).toISOString().slice(0, 10);
}
