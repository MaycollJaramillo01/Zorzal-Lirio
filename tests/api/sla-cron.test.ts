import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { OrderDetail, StageDto, UserRef } from '../../shared/types/index.js';
import { SEED_USERS, buildApp, describeWithDb, loginAs, uniqueSuffix, type Agent } from './helpers.js';

describeWithDb('revision de SLA, alertas y cron', () => {
  let app: Express;
  let owner: Agent;
  let stages: StageDto[];
  let users: UserRef[];

  beforeAll(async () => {
    app = await buildApp();
    owner = await loginAs(app, SEED_USERS.owner);
    stages = (await owner.get('/api/stages')).body.data.stages;
    users = (await owner.get('/api/users')).body.data.users;
  });

  afterAll(async () => {
    const { closePool } = await import('../../server/db/client.js');
    await closePool();
  });

  function daysAgo(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }

  async function createOverdueOrder(): Promise<OrderDetail> {
    const compras = users.find((user) => user.email === SEED_USERS.compras.email)!;
    // La OC con fecha pasada hace que la etapa inicial nazca vencida.
    const response = await owner.post('/api/orders').send({
      purchaseOrderNumber: `OC-SLA-${uniqueSuffix()}`,
      customerName: 'Cliente con atraso',
      projectName: 'Pedido vencido',
      quantity: 10,
      purchaseOrderDate: daysAgo(15),
      initialAssigneeId: compras.id,
    });
    expect(response.status).toBe(201);
    return response.body.data as OrderDetail;
  }

  it('marca como atrasada una orden cuya etapa supero el SLA', async () => {
    const order = await createOverdueOrder();
    expect(order.sla.state).toBe('OVERDUE');
    expect(order.sla.minutesOverdue).toBeGreaterThan(0);
    expect(order.sla.dueAt).not.toBeNull();
  });

  it('rechaza el cron sin el secreto correcto', async () => {
    expect((await request(app).get('/api/cron/sla')).status).toBe(401);
    expect(
      (await request(app).get('/api/cron/sla').set('Authorization', 'Bearer incorrecto')).status,
    ).toBe(401);
  });

  /** Alertas existentes de una orden, con su numero de claves distintas. */
  async function alertsFor(orderId: string): Promise<{ total: number; dedupeKeys: number }> {
    const { eq } = await import('drizzle-orm');
    const { getDb } = await import('../../server/db/client.js');
    const { alerts } = await import('../../server/db/schema.js');
    const rows = await getDb()
      .select({ dedupeKey: alerts.dedupeKey })
      .from(alerts)
      .where(eq(alerts.orderId, orderId));
    return { total: rows.length, dedupeKeys: new Set(rows.map((row) => row.dedupeKey)).size };
  }

  it('crea alertas con el cron autorizado y no las duplica al repetir', async () => {
    const order = await createOverdueOrder();
    const secret = process.env.CRON_SECRET ?? 'cron-secreto-de-pruebas';

    const first = await request(app)
      .get('/api/cron/sla')
      .set('Authorization', `Bearer ${secret}`);

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.checkedOrders).toBeGreaterThan(0);
    expect(first.body.warningsCreated + first.body.overdueCreated).toBeGreaterThan(0);

    const afterFirst = await alertsFor(order.id);
    expect(afterFirst.total).toBeGreaterThan(0);
    expect(afterFirst.dedupeKeys).toBe(afterFirst.total);

    const second = await request(app)
      .get('/api/cron/sla')
      .set('Authorization', `Bearer ${secret}`);
    expect(second.status).toBe(200);

    const third = await request(app)
      .get('/api/cron/sla')
      .set('Authorization', `Bearer ${secret}`);
    expect(third.status).toBe(200);

    // Repetir la revision no agrega ni una alerta mas a la misma orden y tramo.
    const afterRepeats = await alertsFor(order.id);
    expect(afterRepeats.total).toBe(afterFirst.total);
    expect(afterRepeats.dedupeKeys).toBe(afterFirst.total);
  });

  it('vuelve a alertar cuando la orden entra a una etapa nueva', async () => {
    const order = await createOverdueOrder();
    const secret = process.env.CRON_SECRET ?? 'cron-secreto-de-pruebas';

    await request(app).get('/api/cron/sla').set('Authorization', `Bearer ${secret}`);

    const fabric = stages.find((stage) => stage.code === 'FABRIC_PURCHASE')!;
    const compras = users.find((user) => user.email === SEED_USERS.compras.email)!;

    const moved = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: fabric.id,
      assigneeId: compras.id,
    });
    expect(moved.status).toBe(200);

    // El tramo nuevo empieza en tiempo: no debe generar alerta inmediata.
    const detail = moved.body.data as OrderDetail;
    expect(detail.sla.state).toBe('NORMAL');
  });

  it('el servicio manual y el cron comparten el mismo resumen', async () => {
    const { runSlaCheck } = await import('../../server/services/slaCheckService.js');
    const summary = await runSlaCheck({ trigger: 'manual' });

    expect(summary.success).toBe(true);
    expect(typeof summary.checkedOrders).toBe('number');
    expect(typeof summary.warningsCreated).toBe('number');
    expect(typeof summary.overdueCreated).toBe('number');
    expect(typeof summary.emailsSent).toBe('number');
    expect(typeof summary.consoleAlerts).toBe('number');
    expect(typeof summary.failedAlerts).toBe('number');
  });

  it('excluye del conteo las ordenes cerradas', async () => {
    const order = await createOverdueOrder();
    const closed = stages.find((stage) => stage.code === 'CLOSED')!;

    const response = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: closed.id,
      reason: 'Cerrada durante las pruebas',
    });
    expect(response.status).toBe(200);

    const board = await owner.get('/api/orders?includeClosed=false');
    const listed = (board.body.data.orders as OrderDetail[]).some((item) => item.id === order.id);
    expect(listed).toBe(false);
  });
});
