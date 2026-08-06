import { describe, expect, it } from 'vitest';
import {
  computeSla,
  daysToMinutes,
  describeSla,
  formatDuration,
  minutesToDays,
} from '../../shared/lib/sla.js';

const DAY = 1440;
const base = new Date('2026-08-01T12:00:00.000Z');

function at(minutesFromBase: number): Date {
  return new Date(base.getTime() + minutesFromBase * 60_000);
}

describe('computeSla', () => {
  const stage = { slaMinutes: 5 * DAY, warningBeforeMinutes: 1 * DAY, isSlaEnabled: true };

  it('devuelve NORMAL antes de la ventana de advertencia', () => {
    const result = computeSla(stage, base, at(2 * DAY));
    expect(result.state).toBe('NORMAL');
    expect(result.minutesRemaining).toBe(3 * DAY);
    expect(result.minutesOverdue).toBe(0);
  });

  it('devuelve WARNING dentro del ultimo dia', () => {
    const result = computeSla(stage, base, at(4 * DAY + 60));
    expect(result.state).toBe('WARNING');
    expect(result.minutesRemaining).toBeLessThanOrEqual(DAY);
    expect(result.minutesRemaining).toBeGreaterThan(0);
  });

  it('marca WARNING justo al alcanzar warning_at', () => {
    const result = computeSla(stage, base, at(4 * DAY));
    expect(result.state).toBe('WARNING');
  });

  it('sigue en WARNING exactamente en la fecha limite', () => {
    const result = computeSla(stage, base, at(5 * DAY));
    expect(result.state).toBe('WARNING');
    expect(result.minutesRemaining).toBe(0);
  });

  it('devuelve OVERDUE al pasar la fecha limite y calcula el atraso', () => {
    const result = computeSla(stage, base, at(7 * DAY));
    expect(result.state).toBe('OVERDUE');
    expect(result.minutesOverdue).toBe(2 * DAY);
    expect(describeSla(result)).toBe('Atrasado por 2 d');
  });

  it('devuelve NO_SLA cuando la etapa no tiene SLA activo', () => {
    const result = computeSla(
      { slaMinutes: null, warningBeforeMinutes: null, isSlaEnabled: false },
      base,
      at(30 * DAY),
    );
    expect(result.state).toBe('NO_SLA');
    expect(result.dueAt).toBeNull();
    expect(result.minutesRemaining).toBeNull();
    expect(describeSla(result)).toBe('Sin SLA');
  });

  it('calcula dueAt y warningAt a partir de la entrada a la etapa', () => {
    const result = computeSla(stage, base, base);
    expect(result.dueAt?.toISOString()).toBe('2026-08-06T12:00:00.000Z');
    expect(result.warningAt?.toISOString()).toBe('2026-08-05T12:00:00.000Z');
    expect(result.minutesInStage).toBe(0);
  });
});

describe('formatDuration', () => {
  it('usa minutos por debajo de una hora', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('usa horas y minutos por debajo de un dia', () => {
    expect(formatDuration(200)).toBe('3 h 20 min');
  });

  it('usa dias y horas para periodos largos', () => {
    expect(formatDuration(2 * DAY + 300)).toBe('2 d 5 h');
    expect(formatDuration(3 * DAY)).toBe('3 d');
  });
});

describe('conversion de dias y minutos', () => {
  it('convierte en ambos sentidos', () => {
    expect(daysToMinutes(5)).toBe(5 * DAY);
    expect(minutesToDays(5 * DAY)).toBe(5);
    expect(daysToMinutes(null)).toBeNull();
    expect(minutesToDays(null)).toBeNull();
  });
});
