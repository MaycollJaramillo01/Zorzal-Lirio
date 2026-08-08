import {
  DEFAULT_TIMEZONE,
  formatDate,
  formatDateTime,
  formatLongDateTime,
  toCalendarDate as calendarDateInTimeZone,
  todayCalendarDate as todayInTimeZone,
} from '@shared/lib/datetime';
import { formatDuration } from '@shared/lib/sla';

/** Toda la interfaz muestra fechas en la zona horaria de Honduras. */
export const APP_TIMEZONE = DEFAULT_TIMEZONE;

export const fmtDate = (value: string | Date) => formatDate(value, APP_TIMEZONE);
export const fmtDateTime = (value: string | Date) => formatDateTime(value, APP_TIMEZONE);
export const fmtLongDateTime = (value: string | Date) => formatLongDateTime(value, APP_TIMEZONE);
export const fmtDuration = (minutes: number) => formatDuration(minutes);

const hnlFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  minimumFractionDigits: 2,
});

export const fmtHnl = (cents: number) => hnlFormatter.format(cents / 100);
export const calendarDateValue = (value: string | Date) =>
  calendarDateInTimeZone(value, APP_TIMEZONE);

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Hoy segun el reloj de la planta. Con `toISOString()` el formulario proponia
 * la fecha del dia siguiente entre las 18:00 y la medianoche de Tegucigalpa.
 */
export function todayCalendarDate(): string {
  return todayInTimeZone(APP_TIMEZONE);
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
