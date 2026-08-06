import {
  DEFAULT_TIMEZONE,
  formatDate,
  formatDateTime,
  formatLongDateTime,
} from '@shared/lib/datetime';
import { formatDuration } from '@shared/lib/sla';

/** Toda la interfaz muestra fechas en la zona horaria de Managua. */
export const APP_TIMEZONE = DEFAULT_TIMEZONE;

export const fmtDate = (value: string | Date) => formatDate(value, APP_TIMEZONE);
export const fmtDateTime = (value: string | Date) => formatDateTime(value, APP_TIMEZONE);
export const fmtLongDateTime = (value: string | Date) => formatLongDateTime(value, APP_TIMEZONE);
export const fmtDuration = (minutes: number) => formatDuration(minutes);

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function todayCalendarDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
