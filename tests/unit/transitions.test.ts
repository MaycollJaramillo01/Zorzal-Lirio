import { describe, expect, it } from 'vitest';
import {
  classifyTransition,
  evaluateTransition,
  transitionRequiresAssignee,
} from '../../shared/lib/transitions.js';
import { canModifyUser, capabilitiesFor, isManager } from '../../shared/lib/permissions.js';

describe('classifyTransition', () => {
  it('clasifica los cuatro tipos de movimiento', () => {
    expect(classifyTransition(2, 2)).toBe('SAME');
    expect(classifyTransition(2, 3)).toBe('FORWARD');
    expect(classifyTransition(2, 5)).toBe('SKIP');
    expect(classifyTransition(5, 2)).toBe('BACKWARD');
  });
});

describe('evaluateTransition para planta', () => {
  it('permite unicamente el avance a la etapa siguiente', () => {
    const result = evaluateTransition('PLANT', 2, 3);
    expect(result.allowed).toBe(true);
    expect(result.requiresReason).toBe(false);
  });

  it('bloquea el salto de etapas', () => {
    const result = evaluateTransition('PLANT', 2, 4);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('etapa siguiente');
  });

  it('bloquea el retroceso', () => {
    const result = evaluateTransition('PLANT', 4, 2);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('regresar');
  });
});

describe('evaluateTransition para dueno y administrador', () => {
  it('permite el avance normal sin razon', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      const result = evaluateTransition(role, 1, 2);
      expect(result.allowed).toBe(true);
      expect(result.requiresReason).toBe(false);
    }
  });

  it('exige razon al saltar etapas', () => {
    const result = evaluateTransition('ADMIN', 1, 4);
    expect(result.allowed).toBe(true);
    expect(result.requiresReason).toBe(true);
    expect(result.kind).toBe('SKIP');
  });

  it('exige razon al regresar la orden', () => {
    const result = evaluateTransition('OWNER', 5, 3);
    expect(result.allowed).toBe(true);
    expect(result.requiresReason).toBe(true);
    expect(result.kind).toBe('BACKWARD');
  });
});

describe('reglas comunes', () => {
  it('rechaza mover a la misma etapa para cualquier rol', () => {
    for (const role of ['OWNER', 'ADMIN', 'PLANT'] as const) {
      expect(evaluateTransition(role, 3, 3).allowed).toBe(false);
    }
  });

  it('exige responsable en toda etapa salvo CLOSED', () => {
    expect(transitionRequiresAssignee('WORKSHOP')).toBe(true);
    expect(transitionRequiresAssignee('COLLECTION')).toBe(true);
    expect(transitionRequiresAssignee('CLOSED')).toBe(false);
  });
});

describe('permisos por rol', () => {
  it('identifica a los roles gerenciales', () => {
    expect(isManager('OWNER')).toBe(true);
    expect(isManager('ADMIN')).toBe(true);
    expect(isManager('PLANT')).toBe(false);
  });

  it('planta no administra usuarios ni SLA', () => {
    const capabilities = capabilitiesFor('PLANT');
    expect(capabilities.manageUsers).toBe(false);
    expect(capabilities.configureSla).toBe(false);
    expect(capabilities.createOrder).toBe(false);
    expect(capabilities.viewAudit).toBe(false);
  });

  it('protege al dueno principal frente a otros usuarios', () => {
    expect(canModifyUser('ADMIN', 'admin-1', 'OWNER', 'owner-1', true)).toBe(false);
    expect(canModifyUser('OWNER', 'owner-2', 'OWNER', 'owner-1', true)).toBe(false);
    expect(canModifyUser('OWNER', 'owner-1', 'OWNER', 'owner-1', true)).toBe(true);
  });

  it('un administrador no puede modificar a un dueno', () => {
    expect(canModifyUser('ADMIN', 'admin-1', 'OWNER', 'owner-9', false)).toBe(false);
    expect(canModifyUser('ADMIN', 'admin-1', 'PLANT', 'plant-1', false)).toBe(true);
  });
});
