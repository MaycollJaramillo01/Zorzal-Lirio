import type { Role } from '../constants/enums.js';
import { CLOSED_STAGE_CODE, type StageCode } from '../constants/stages.js';

export type TransitionKind = 'SAME' | 'FORWARD' | 'SKIP' | 'BACKWARD';

export interface TransitionEvaluation {
  kind: TransitionKind;
  allowed: boolean;
  requiresReason: boolean;
  /** Mensaje listo para mostrar cuando `allowed` es `false`. */
  reason: string | null;
}

export function classifyTransition(fromPosition: number, toPosition: number): TransitionKind {
  if (fromPosition === toPosition) return 'SAME';
  if (toPosition < fromPosition) return 'BACKWARD';
  return toPosition === fromPosition + 1 ? 'FORWARD' : 'SKIP';
}

/**
 * Reglas de movimiento por rol. Unica fuente de verdad: la usa el backend para
 * autorizar y el frontend para habilitar o deshabilitar controles.
 */
export function evaluateTransition(
  role: Role,
  fromPosition: number,
  toPosition: number,
): TransitionEvaluation {
  const kind = classifyTransition(fromPosition, toPosition);

  if (kind === 'SAME') {
    return { kind, allowed: false, requiresReason: false, reason: 'La orden ya se encuentra en esa etapa.' };
  }

  if (role === 'PLANT') {
    if (kind !== 'FORWARD') {
      return {
        kind,
        allowed: false,
        requiresReason: false,
        reason:
          kind === 'BACKWARD'
            ? 'Planta no puede regresar ordenes a una etapa anterior.'
            : 'Planta solo puede mover la orden a la etapa siguiente.',
      };
    }
    return { kind, allowed: true, requiresReason: false, reason: null };
  }

  // OWNER y ADMIN pueden saltar o regresar, pero deben justificarlo.
  return {
    kind,
    allowed: true,
    requiresReason: kind === 'BACKWARD' || kind === 'SKIP',
    reason: null,
  };
}

/** Toda etapa exige responsable salvo la etapa final `CLOSED`. */
export function transitionRequiresAssignee(toStageCode: StageCode | string): boolean {
  return toStageCode !== CLOSED_STAGE_CODE;
}

export const TRANSITION_KIND_LABELS: Record<TransitionKind, string> = {
  SAME: 'Misma etapa',
  FORWARD: 'Avance normal',
  SKIP: 'Salto de etapa',
  BACKWARD: 'Retroceso',
};
