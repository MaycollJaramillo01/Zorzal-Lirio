import { describe, expect, it } from 'vitest';
import { buildDedupeKey } from '../../server/repositories/alertRepository.js';
import { buildAlertContent } from '../../server/services/alertService.js';
import { computeSla } from '../../shared/lib/sla.js';
import { toCsv } from '../../server/utils/csv.js';
import { calendarDateToUtc, toCalendarDate } from '../../shared/lib/datetime.js';
import { validateOrderCode } from './helpers.js';

const context = {
  orderId: 'a2f1b6c4-0000-4000-8000-000000000001',
  orderCode: 'ZL-2026-0015',
  customerName: 'Empresa Ejemplo',
  projectName: 'Uniformes administrativos',
  stageName: 'Compra de tela',
  assigneeId: 'a2f1b6c4-0000-4000-8000-000000000002',
  assigneeName: 'Responsable de compras',
  stageHistoryId: 'a2f1b6c4-0000-4000-8000-000000000003',
};

describe('deduplicacion de alertas', () => {
  it('genera la misma clave para la misma orden, tramo, tipo y destinatario', () => {
    const first = buildDedupeKey(context.orderId, context.stageHistoryId, 'SLA_WARNING', 'user-1');
    const second = buildDedupeKey(context.orderId, context.stageHistoryId, 'SLA_WARNING', 'user-1');
    expect(first).toBe(second);
  });

  it('distingue tipo de alerta, tramo y destinatario', () => {
    const warning = buildDedupeKey(context.orderId, context.stageHistoryId, 'SLA_WARNING', 'user-1');
    expect(warning).not.toBe(
      buildDedupeKey(context.orderId, context.stageHistoryId, 'SLA_OVERDUE', 'user-1'),
    );
    expect(warning).not.toBe(
      buildDedupeKey(context.orderId, context.stageHistoryId, 'SLA_WARNING', 'user-2'),
    );
    expect(warning).not.toBe(buildDedupeKey(context.orderId, 'otro-tramo', 'SLA_WARNING', 'user-1'));
  });
});

describe('contenido de las alertas', () => {
  const stage = { slaMinutes: 5 * 1440, warningBeforeMinutes: 1440, isSlaEnabled: true };
  const enteredAt = new Date('2026-08-03T14:00:00.000Z');

  it('describe una alerta de proximo vencimiento', () => {
    const sla = computeSla(stage, enteredAt, new Date('2026-08-07T20:00:00.000Z'));
    const content = buildAlertContent(context, 'SLA_WARNING', sla);

    expect(sla.state).toBe('WARNING');
    expect(content.subject).toContain('ZL-2026-0015');
    expect(content.message).toContain('esta proxima a vencer');
    expect(content.message).toContain('Etapa: Compra de tela');
    expect(content.message).toContain('Responsable: Responsable de compras');
    expect(content.message).toContain('Cliente: Empresa Ejemplo');
    expect(content.message).toContain('Tiempo restante:');
  });

  it('describe una alerta de SLA superado', () => {
    const sla = computeSla(stage, enteredAt, new Date('2026-08-10T14:00:00.000Z'));
    const content = buildAlertContent(context, 'SLA_OVERDUE', sla);

    expect(sla.state).toBe('OVERDUE');
    expect(content.message).toContain('ha superado su SLA');
    expect(content.message).toContain('Atraso actual: 2 d');
  });
});

describe('exportacion CSV', () => {
  it('escapa comillas, separadores y saltos de linea', () => {
    const csv = toCsv(
      [
        { name: 'Taller "Lopez"', note: 'linea1\nlinea2', total: 3 },
        { name: 'Cliente; con separador', note: null, total: 0 },
      ],
      [
        { header: 'Nombre', value: (row) => row.name },
        { header: 'Nota', value: (row) => row.note },
        { header: 'Total', value: (row) => row.total },
      ],
    );

    expect(csv).toContain('Nombre;Nota;Total');
    expect(csv).toContain('"Taller ""Lopez"""');
    expect(csv).toContain('"linea1\nlinea2"');
    expect(csv).toContain('"Cliente; con separador"');
    expect(csv.startsWith('﻿')).toBe(true);
  });
});

describe('formato del codigo de orden', () => {
  it('acepta el formato ZL-AAAA-NNNN', () => {
    expect(validateOrderCode('ZL-2026-0001')).toBe(true);
    expect(validateOrderCode('ZL-2026-1234')).toBe(true);
  });

  it('rechaza formatos invalidos', () => {
    expect(validateOrderCode('ZL-26-0001')).toBe(false);
    expect(validateOrderCode('XX-2026-0001')).toBe(false);
    expect(validateOrderCode('ZL-2026-1')).toBe(false);
  });
});

describe('fechas de calendario', () => {
  it('convierte a UTC estable y de vuelta', () => {
    const date = calendarDateToUtc('2026-08-06');
    expect(date.toISOString()).toBe('2026-08-06T12:00:00.000Z');
    expect(toCalendarDate(date)).toBe('2026-08-06');
  });
});
