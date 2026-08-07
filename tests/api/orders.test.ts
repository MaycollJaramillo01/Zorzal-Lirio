import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Express } from 'express';
import type { OrderDetail, StageDto, UserRef } from '../../shared/types/index.js';
import { ORDER_CODE_PATTERN } from '../unit/helpers.js';
import { SEED_USERS, buildApp, describeWithDb, loginAs, uniqueSuffix, type Agent } from './helpers.js';

describeWithDb('ordenes: creacion, transiciones e historial', () => {
  let app: Express;
  let owner: Agent;
  let stages: StageDto[];
  let users: UserRef[];

  const stageByCode = (code: string): StageDto => {
    const stage = stages.find((item) => item.code === code);
    if (!stage) throw new Error(`Etapa ${code} no encontrada`);
    return stage;
  };

  const userByEmail = (email: string): UserRef => {
    const user = users.find((item) => item.email === email);
    if (!user) throw new Error(`Usuario ${email} no encontrado`);
    return user;
  };

  async function createOrder(overrides: Record<string, unknown> = {}): Promise<OrderDetail> {
    const response = await owner.post('/api/orders').send({
      purchaseOrderNumber: `OC-TEST-${uniqueSuffix()}`,
      customerName: 'Cliente de pruebas',
      projectName: 'Uniformes de prueba',
      quantity: 25,
      purchaseOrderDate: new Date().toISOString().slice(0, 10),
      initialAssigneeId: userByEmail(SEED_USERS.compras.email).id,
      ...overrides,
    });
    expect(response.status).toBe(201);
    return response.body.data as OrderDetail;
  }

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

  /**
   * El consecutivo es un contador compartido por ano. Se comprueba contra
   * `order_sequences`, no contra la distancia entre dos codigos: cualquier otro
   * cliente conectado a la misma base tambien consume numeros.
   */
  async function readSequence(year: number): Promise<number> {
    const { eq } = await import('drizzle-orm');
    const { getDb } = await import('../../server/db/client.js');
    const { orderSequences } = await import('../../server/db/schema.js');
    const [row] = await getDb()
      .select({ lastNumber: orderSequences.lastNumber })
      .from(orderSequences)
      .where(eq(orderSequences.year, year))
      .limit(1);
    return row?.lastNumber ?? 0;
  }

  it('crea una orden en Orden recibida con codigo consecutivo', async () => {
    const year = new Date().getUTCFullYear();

    const before = await readSequence(year);
    const first = await createOrder();
    const afterFirst = await readSequence(year);

    expect(first.orderCode).toMatch(ORDER_CODE_PATTERN);
    expect(first.stage.code).toBe('ORDER_RECEIVED');
    expect(first.assignee?.email).toBe(SEED_USERS.compras.email);
    expect(first.version).toBe(1);

    // El contador avanza exactamente uno y el codigo refleja ese numero.
    expect(afterFirst).toBe(before + 1);
    expect(first.orderCode).toBe(`ZL-${year}-${String(afterFirst).padStart(4, '0')}`);

    const second = await createOrder();
    const afterSecond = await readSequence(year);
    expect(second.orderCode).toMatch(ORDER_CODE_PATTERN);
    expect(afterSecond).toBe(afterFirst + 1);
    expect(second.orderCode).toBe(`ZL-${year}-${String(afterSecond).padStart(4, '0')}`);
    expect(Number(second.orderCode.split('-')[2])).toBeGreaterThan(
      Number(first.orderCode.split('-')[2]),
    );
  });

  it('genera codigos distintos con creaciones concurrentes', async () => {
    const results = await Promise.all([createOrder(), createOrder(), createOrder()]);
    const codes = new Set(results.map((order) => order.orderCode));
    expect(codes.size).toBe(3);
  });

  it('mueve la orden a la etapa siguiente y registra entrada y salida', async () => {
    const order = await createOrder();

    const moved = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('FABRIC_PURCHASE').id,
      assigneeId: userByEmail(SEED_USERS.compras.email).id,
      note: 'Tela solicitada al proveedor',
    });

    expect(moved.status).toBe(200);
    const detail = moved.body.data as OrderDetail;
    expect(detail.stage.code).toBe('FABRIC_PURCHASE');
    expect(detail.version).toBe(order.version + 1);

    const history = await owner.get(`/api/orders/${order.id}/history`);
    expect(history.status).toBe(200);

    const entries = history.body.data.history as Array<{
      stage: { code: string };
      exitedAt: string | null;
      elapsedMinutes: number | null;
      transitionNote: string | null;
    }>;

    expect(entries).toHaveLength(2);
    expect(entries[0]!.stage.code).toBe('ORDER_RECEIVED');
    expect(entries[0]!.exitedAt).not.toBeNull();
    expect(entries[0]!.elapsedMinutes).not.toBeNull();
    expect(entries[0]!.transitionNote).toBe('Tela solicitada al proveedor');
    expect(entries[1]!.stage.code).toBe('FABRIC_PURCHASE');
    expect(entries[1]!.exitedAt).toBeNull();
  });

  it('rechaza el movimiento sin responsable', async () => {
    const order = await createOrder();

    const response = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('FABRIC_PURCHASE').id,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('ASSIGNEE_REQUIRED');
  });

  it('exige razon cuando el administrador salta o regresa etapas', async () => {
    const order = await createOrder();
    const compras = userByEmail(SEED_USERS.compras.email).id;

    const skip = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('EMBROIDERY').id,
      assigneeId: compras,
    });
    expect(skip.status).toBe(422);
    expect(skip.body.error.code).toBe('REASON_REQUIRED');

    const withReason = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('EMBROIDERY').id,
      assigneeId: compras,
      reason: 'La tela ya estaba en inventario',
    });
    expect(withReason.status).toBe(200);
    expect((withReason.body.data as OrderDetail).stage.code).toBe('EMBROIDERY');

    const back = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: (withReason.body.data as OrderDetail).version,
      toStageId: stageByCode('WORKSHOP').id,
      assigneeId: compras,
    });
    expect(back.status).toBe(422);
    expect(back.body.error.code).toBe('REASON_REQUIRED');
  });

  it('impide que planta salte o regrese etapas', async () => {
    const order = await createOrder();
    const compras = await loginAs(app, SEED_USERS.compras);

    const toFabric = await compras.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('FABRIC_PURCHASE').id,
      assigneeId: userByEmail(SEED_USERS.compras.email).id,
    });
    expect(toFabric.status).toBe(200);

    const current = toFabric.body.data as OrderDetail;

    const skip = await compras.post(`/api/orders/${order.id}/transition`).send({
      version: current.version,
      toStageId: stageByCode('SHIPPING').id,
      assigneeId: userByEmail(SEED_USERS.envio.email).id,
    });
    expect(skip.status).toBe(422);
    expect(skip.body.error.code).toBe('INVALID_TRANSITION');

    const backwards = await compras.post(`/api/orders/${order.id}/transition`).send({
      version: current.version,
      toStageId: stageByCode('ORDER_RECEIVED').id,
      assigneeId: userByEmail(SEED_USERS.compras.email).id,
    });
    expect(backwards.status).toBe(422);
    expect(backwards.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('devuelve 409 cuando la version enviada esta desactualizada', async () => {
    const order = await createOrder();
    const compras = userByEmail(SEED_USERS.compras.email).id;

    const first = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('FABRIC_PURCHASE').id,
      assigneeId: compras,
    });
    expect(first.status).toBe(200);

    const stale = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('WORKSHOP').id,
      assigneeId: userByEmail(SEED_USERS.taller.email).id,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('ORDER_VERSION_CONFLICT');
  });

  it('permite cerrar la orden sin responsable y registra closedAt', async () => {
    const order = await createOrder();
    const closed = await owner.post(`/api/orders/${order.id}/transition`).send({
      version: order.version,
      toStageId: stageByCode('CLOSED').id,
      reason: 'Pedido entregado y cobrado en la misma visita',
    });

    expect(closed.status).toBe(200);
    const detail = closed.body.data as OrderDetail;
    expect(detail.stage.code).toBe('CLOSED');
    expect(detail.closedAt).not.toBeNull();
    expect(detail.sla.state).toBe('NO_SLA');
  });

  it('archiva de forma logica sin borrar la orden', async () => {
    const order = await createOrder();

    const archived = await owner
      .post(`/api/orders/${order.id}/archive`)
      .send({ version: order.version, reason: 'Cancelada por el cliente' });
    expect(archived.status).toBe(200);
    expect((archived.body.data as OrderDetail).isArchived).toBe(true);

    const board = await owner.get('/api/orders');
    const visible = (board.body.data.orders as OrderDetail[]).some((item) => item.id === order.id);
    expect(visible).toBe(false);

    const archivedBoard = await owner.get('/api/orders?includeArchived=true');
    const listed = (archivedBoard.body.data.orders as OrderDetail[]).some(
      (item) => item.id === order.id,
    );
    expect(listed).toBe(true);

    const detail = await owner.get(`/api/orders/${order.id}`);
    expect(detail.status).toBe(200);

    const restored = await owner
      .post(`/api/orders/${order.id}/restore`)
      .send({ version: (archived.body.data as OrderDetail).version });
    expect(restored.status).toBe(200);
    expect((restored.body.data as OrderDetail).isArchived).toBe(false);
  });

  it('registra notas y auditoria del movimiento', async () => {
    const order = await createOrder();

    const note = await owner
      .post(`/api/orders/${order.id}/notes`)
      .send({ body: 'Cliente confirmo las tallas' });
    expect(note.status).toBe(201);
    expect(note.body.data.notes).toHaveLength(1);

    const audit = await owner.get(`/api/orders/${order.id}/audit`);
    expect(audit.status).toBe(200);
    const actions = (audit.body.data.items as Array<{ action: string }>).map((item) => item.action);
    expect(actions).toContain('ORDER_CREATED');
    expect(actions).toContain('NOTE_CREATED');
  });

  it('planta solo ve sus ordenes y las de sus etapas de enfoque', async () => {
    const order = await createOrder({
      initialAssigneeId: userByEmail(SEED_USERS.envio.email).id,
    });

    const compras = await loginAs(app, SEED_USERS.compras);
    const board = await compras.get('/api/orders');
    expect(board.status).toBe(200);

    const found = (board.body.data.orders as OrderDetail[]).some((item) => item.id === order.id);
    expect(found).toBe(false);

    const detail = await compras.get(`/api/orders/${order.id}`);
    expect(detail.status).toBe(403);
  });

  it('planta no puede crear ni reasignar ordenes', async () => {
    const order = await createOrder();
    const compras = await loginAs(app, SEED_USERS.compras);

    const create = await compras.post('/api/orders').send({
      purchaseOrderNumber: `OC-PLANTA-${uniqueSuffix()}`,
      customerName: 'Cliente',
      projectName: 'Proyecto',
      quantity: 1,
      purchaseOrderDate: new Date().toISOString().slice(0, 10),
      initialAssigneeId: userByEmail(SEED_USERS.compras.email).id,
    });
    expect(create.status).toBe(403);

    const reassign = await compras.post(`/api/orders/${order.id}/reassign`).send({
      version: order.version,
      assigneeId: userByEmail(SEED_USERS.taller.email).id,
    });
    expect(reassign.status).toBe(403);
  });
});
