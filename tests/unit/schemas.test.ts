import { describe, expect, it } from 'vitest';
import { loginSchema, changePasswordSchema } from '../../shared/schemas/auth.js';
import {
  createOrderSchema,
  transitionOrderSchema,
  updateOrderFinanceSchema,
} from '../../shared/schemas/orders.js';
import { financialReportSchema } from '../../shared/schemas/reports.js';
import { updateStageSlaSchema } from '../../shared/schemas/stages.js';
import { createUserSchema } from '../../shared/schemas/users.js';

const uuid = '2f5a2a5c-9e4f-4a1a-9d1a-8b7c6d5e4f30';

describe('loginSchema', () => {
  it('normaliza el correo a minusculas', () => {
    const result = loginSchema.parse({ email: '  Owner@ZorzalLirio.LOCAL ', password: 'owner123' });
    expect(result.email).toBe('owner@zorzallirio.local');
  });

  it('rechaza correos invalidos', () => {
    expect(loginSchema.safeParse({ email: 'no-es-correo', password: 'x' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('exige que ambas contrasenas coincidan', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'owner123',
      newPassword: 'nuevaClave1',
      confirmPassword: 'otraClave1',
    });
    expect(result.success).toBe(false);
  });

  it('exige una contrasena distinta de la actual', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'claveActual1',
      newPassword: 'claveActual1',
      confirmPassword: 'claveActual1',
    });
    expect(result.success).toBe(false);
  });

  it('acepta un cambio valido', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'owner123',
      newPassword: 'claveNueva9',
      confirmPassword: 'claveNueva9',
    });
    expect(result.success).toBe(true);
  });
});

describe('createOrderSchema', () => {
  const valid = {
    purchaseOrderNumber: 'OC-2026-1180',
    customerName: 'Colegio Santa Marta',
    projectName: 'Uniformes escolares',
    quantity: 320,
    purchaseOrderDate: '2026-08-01',
    initialAssigneeId: uuid,
  };

  it('aplica NORMAL como prioridad por defecto', () => {
    expect(createOrderSchema.parse(valid).priority).toBe('NORMAL');
  });

  it('exige responsable inicial', () => {
    const { initialAssigneeId: _omitted, ...withoutAssignee } = valid;
    expect(createOrderSchema.safeParse(withoutAssignee).success).toBe(false);
  });

  it('rechaza cantidades no positivas', () => {
    expect(createOrderSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
  });

  it('rechaza fechas con formato invalido', () => {
    expect(createOrderSchema.safeParse({ ...valid, purchaseOrderDate: '01/08/2026' }).success).toBe(
      false,
    );
  });
});

describe('transitionOrderSchema', () => {
  it('exige version y etapa destino', () => {
    expect(transitionOrderSchema.safeParse({ toStageId: uuid }).success).toBe(false);
    expect(transitionOrderSchema.safeParse({ version: 1, toStageId: uuid }).success).toBe(true);
  });

  it('acepta responsable nulo para cerrar la orden', () => {
    const result = transitionOrderSchema.safeParse({ version: 2, toStageId: uuid, assigneeId: null });
    expect(result.success).toBe(true);
  });
});

describe('updateOrderFinanceSchema', () => {
  it('acepta montos en centavos y una fecha de cobro valida', () => {
    const result = updateOrderFinanceSchema.safeParse({
      version: 3,
      saleAmountCents: 150_000,
      productionCostCents: 90_000,
      paidAt: '2026-08-08',
    });
    expect(result.success).toBe(true);
  });

  it('no permite marcar como cobrada una venta sin monto', () => {
    const result = updateOrderFinanceSchema.safeParse({
      version: 3,
      saleAmountCents: 0,
      productionCostCents: 0,
      paidAt: '2026-08-08',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza montos negativos', () => {
    const result = updateOrderFinanceSchema.safeParse({
      version: 3,
      saleAmountCents: 100_000,
      productionCostCents: -1,
      paidAt: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('financialReportSchema', () => {
  it('acepta meses validos y rechaza meses inexistentes', () => {
    expect(financialReportSchema.safeParse({ month: '2026-08' }).success).toBe(true);
    expect(financialReportSchema.safeParse({ month: '2026-13' }).success).toBe(false);
  });
});

describe('updateStageSlaSchema', () => {
  it('exige tiempo permitido cuando el SLA esta activo', () => {
    const result = updateStageSlaSchema.safeParse({
      isSlaEnabled: true,
      slaMinutes: null,
      warningBeforeMinutes: 1440,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza una advertencia mayor que el SLA', () => {
    const result = updateStageSlaSchema.safeParse({
      isSlaEnabled: true,
      slaMinutes: 1440,
      warningBeforeMinutes: 2880,
    });
    expect(result.success).toBe(false);
  });

  it('permite desactivar el SLA sin valores', () => {
    const result = updateStageSlaSchema.safeParse({
      isSlaEnabled: false,
      slaMinutes: null,
      warningBeforeMinutes: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('createUserSchema', () => {
  it('exige contrasenas de al menos 8 caracteres', () => {
    const result = createUserSchema.safeParse({
      name: 'Taller Confecciones Lopez',
      email: 'taller.lopez@example.com',
      role: 'PLANT',
      password: 'corta',
    });
    expect(result.success).toBe(false);
  });

  it('aplica valores por defecto de enfoque y cambio de contrasena', () => {
    const result = createUserSchema.parse({
      name: 'Taller Confecciones Lopez',
      email: 'Taller.Lopez@Example.com',
      role: 'PLANT',
      password: 'clave-segura-1',
    });
    expect(result.stageIds).toEqual([]);
    expect(result.mustChangePassword).toBe(true);
    expect(result.email).toBe('taller.lopez@example.com');
  });
});
