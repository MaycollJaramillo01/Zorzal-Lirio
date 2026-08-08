import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  endOfCalendarDayUtc,
  formatDate,
  startOfCalendarDayUtc,
  toCalendarDate,
  todayCalendarDate,
} from '../../shared/lib/datetime.js';
import { toCsv } from '../../server/utils/csv.js';
import { mergeRecipients } from '../../server/services/alertService.js';

/** BUG-002: una fecha de calendario se mostraba un dia antes en America/Tegucigalpa. */
describe('fechas de calendario en la zona horaria de la operacion', () => {
  it('muestra el mismo dia que se guardo, no el anterior', () => {
    expect(formatDate('2026-08-07')).toBe('07/08/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('conserva la fecha al ida y vuelta', () => {
    expect(toCalendarDate('2026-08-07')).toBe('2026-08-07');
  });

  it('sigue respetando los instantes con hora', () => {
    // 07/08/2026 01:00 UTC son las 19:00 del 06/08 en Tegucigalpa.
    expect(formatDate('2026-08-07T01:00:00.000Z')).toBe('06/08/2026');
  });
});

/** BUG-003: el formulario proponia la fecha del dia siguiente por la noche. */
describe('todayCalendarDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa el calendario de Tegucigalpa y no el de UTC', () => {
    // 19:00 del 07/08 en Tegucigalpa = 01:00 del 08/08 en UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T01:00:00.000Z'));

    expect(todayCalendarDate(DEFAULT_TIMEZONE)).toBe('2026-08-07');
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-08-08');
  });
});

/** BUG-004: el rango de reportes anclaba ambos extremos al mediodia UTC. */
describe('rangos de reportes por dia completo', () => {
  it('empieza a la medianoche local y termina al final del dia local', () => {
    expect(startOfCalendarDayUtc('2026-08-07', DEFAULT_TIMEZONE).toISOString()).toBe(
      '2026-08-07T06:00:00.000Z',
    );
    expect(endOfCalendarDayUtc('2026-08-07', DEFAULT_TIMEZONE).toISOString()).toBe(
      '2026-08-08T05:59:59.999Z',
    );
  });

  it('cubre las 24 horas del dia elegido', () => {
    const from = startOfCalendarDayUtc('2026-08-07', DEFAULT_TIMEZONE).getTime();
    const to = endOfCalendarDayUtc('2026-08-07', DEFAULT_TIMEZONE).getTime();
    expect(to - from).toBe(24 * 60 * 60 * 1000 - 1);
  });
});

/** BUG-005: los valores de usuario llegaban al CSV como formulas ejecutables. */
describe('exportacion CSV: inyeccion de formulas', () => {
  const rows = [
    { texto: "=cmd|'/C calc'!A0" },
    { texto: '+1+1' },
    { texto: '-2+3' },
    { texto: '@SUM(A1:A9)' },
    { texto: 'Colegio Santa Marta' },
  ];
  const csv = toCsv(rows, [{ header: 'Texto', value: (row) => row.texto }]);

  it('neutraliza los prefijos peligrosos', () => {
    expect(csv).toContain("'=cmd|");
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'@SUM(A1:A9)");
  });

  it('no toca el texto inofensivo', () => {
    expect(csv).toContain('Colegio Santa Marta');
    expect(csv).not.toContain("'Colegio");
  });

  it('deja intactos los numeros que genera el sistema', () => {
    const numeric = toCsv([{ minutos: -120 }], [{ header: 'Minutos', value: (row) => row.minutos }]);
    expect(numeric).toContain('-120');
    expect(numeric).not.toContain("'-120");
  });
});

/** Destinatarios de alerta: responsable + gestores, sin repetidos. */
describe('destinatarios de alertas', () => {
  it('agrega al responsable sin duplicar gestores', () => {
    expect(mergeRecipients(['a', 'b'], 'b')).toEqual(['a', 'b']);
    expect(mergeRecipients(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(mergeRecipients(['a'], null)).toEqual(['a']);
  });
});
