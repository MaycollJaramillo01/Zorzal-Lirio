import type { SlaState } from '../constants/enums.js';

/** Configuracion SLA de una etapa (valores siempre en minutos). */
export interface SlaStageConfig {
  slaMinutes: number | null;
  warningBeforeMinutes: number | null;
  isSlaEnabled: boolean;
}

export interface SlaComputation {
  state: SlaState;
  dueAt: Date | null;
  warningAt: Date | null;
  /** Minutos transcurridos dentro de la etapa. */
  minutesInStage: number;
  /** Minutos que faltan para vencer. Negativo cuando ya vencio. `null` sin SLA. */
  minutesRemaining: number | null;
  /** Minutos de atraso acumulado. `0` cuando no esta atrasado. `null` sin SLA. */
  minutesOverdue: number | null;
}

const MS_PER_MINUTE = 60_000;

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * MS_PER_MINUTE);
}

function diffMinutes(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_MINUTE);
}

/**
 * Formula unica de SLA del sistema. El backend es la fuente definitiva; el
 * frontend usa esta misma funcion solo para vistas provisionales.
 */
export function computeSla(stage: SlaStageConfig, enteredAt: Date, now: Date): SlaComputation {
  const minutesInStage = Math.max(0, diffMinutes(now, enteredAt));

  if (!stage.isSlaEnabled || stage.slaMinutes === null || stage.slaMinutes <= 0) {
    return {
      state: 'NO_SLA',
      dueAt: null,
      warningAt: null,
      minutesInStage,
      minutesRemaining: null,
      minutesOverdue: null,
    };
  }

  const dueAt = addMinutes(enteredAt, stage.slaMinutes);
  const warningAt = addMinutes(dueAt, -(stage.warningBeforeMinutes ?? 0));
  const minutesRemaining = diffMinutes(dueAt, now);

  let state: SlaState;
  if (now.getTime() > dueAt.getTime()) {
    state = 'OVERDUE';
  } else if (now.getTime() >= warningAt.getTime()) {
    state = 'WARNING';
  } else {
    state = 'NORMAL';
  }

  return {
    state,
    dueAt,
    warningAt,
    minutesInStage,
    minutesRemaining,
    minutesOverdue: state === 'OVERDUE' ? Math.max(0, -minutesRemaining) : 0,
  };
}

/** Texto accesible del estado SLA, sin depender del color. */
export function describeSla(computation: SlaComputation): string {
  switch (computation.state) {
    case 'NO_SLA':
      return 'Sin SLA';
    case 'OVERDUE':
      return `Atrasado por ${formatDuration(computation.minutesOverdue ?? 0)}`;
    case 'WARNING':
      return `Proximo a vencer en ${formatDuration(Math.max(0, computation.minutesRemaining ?? 0))}`;
    case 'NORMAL':
      return `En tiempo, restan ${formatDuration(Math.max(0, computation.minutesRemaining ?? 0))}`;
  }
}

/** Formatea minutos como texto corto en espanol: "3 d 4 h", "5 h 20 min", "12 min". */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} min`;

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  }
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Convierte minutos a dias con un decimal, para la interfaz de configuracion. */
export function minutesToDays(minutes: number | null): number | null {
  if (minutes === null) return null;
  return Math.round((minutes / 1440) * 100) / 100;
}

export function daysToMinutes(days: number | null): number | null {
  if (days === null) return null;
  return Math.round(days * 1440);
}
