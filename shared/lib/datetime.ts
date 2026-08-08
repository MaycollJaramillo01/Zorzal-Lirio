import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

/** Zona horaria de presentacion. El almacenamiento siempre es UTC. */
export const DEFAULT_TIMEZONE = 'America/Tegucigalpa';

/** "2026-08-07": fecha de calendario sin hora ni zona. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza cualquier entrada a `Date`.
 *
 * Una fecha de calendario ("2026-08-07") se ancla al mediodia UTC: si se dejara
 * en la medianoche UTC que usa `new Date(...)`, al formatearla en America/Tegucigalpa
 * (UTC-6) se mostraria el dia anterior.
 */
export function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && CALENDAR_DATE.test(value)) return calendarDateToUtc(value);
  return new Date(value);
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

/** Devuelve "YYYY-MM-DD" de una fecha, leida en la zona horaria indicada. */
export function toCalendarDate(
  value: Date | string | number,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(toDate(value), timeZone, 'yyyy-MM-dd');
}

/** Fecha de hoy segun el reloj de la operacion, no segun UTC. */
export function todayCalendarDate(timeZone = DEFAULT_TIMEZONE): string {
  return toCalendarDate(new Date(), timeZone);
}

/** Instante UTC en que empieza "YYYY-MM-DD" en la zona horaria indicada. */
export function startOfCalendarDayUtc(value: string, timeZone = DEFAULT_TIMEZONE): Date {
  return fromZonedTime(`${value}T00:00:00.000`, timeZone);
}

/** Instante UTC en que termina "YYYY-MM-DD" en la zona horaria indicada. */
export function endOfCalendarDayUtc(value: string, timeZone = DEFAULT_TIMEZONE): Date {
  return fromZonedTime(`${value}T23:59:59.999`, timeZone);
}
