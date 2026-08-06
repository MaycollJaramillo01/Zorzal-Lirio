import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { SEED_USERS, buildApp, describeWithDb, loginAs, uniqueSuffix } from './helpers.js';

describeWithDb('autenticacion y control de acceso', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    const { closePool } = await import('../../server/db/client.js');
    await closePool();
  });

  it('inicia sesion con credenciales correctas y entrega la cookie de sesion', async () => {
    const response = await request(app).post('/api/auth/login').send(SEED_USERS.owner);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(SEED_USERS.owner.email);
    expect(response.body.data.role).toBe('OWNER');

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('zl_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
  });

  it('rechaza credenciales incorrectas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USERS.owner.email, password: 'contrasena-incorrecta' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rechaza correos inexistentes sin revelar el motivo', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: `nadie-${uniqueSuffix()}@zorzallirio.local`, password: 'lo-que-sea' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('bloquea el acceso de un usuario desactivado', async () => {
    const owner = await loginAs(app, SEED_USERS.owner);
    const email = `desactivado-${uniqueSuffix()}@zorzallirio.local`;

    const created = await owner
      .post('/api/users')
      .send({
        name: 'Usuario temporal desactivado',
        email,
        role: 'PLANT',
        password: 'clave-temporal-1',
        mustChangePassword: false,
        stageIds: [],
      });
    expect(created.status).toBe(201);

    const user = (created.body.data.users as Array<{ id: string; email: string }>).find(
      (item) => item.email === email,
    );
    expect(user).toBeDefined();

    const before = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'clave-temporal-1' });
    expect(before.status).toBe(200);

    const deactivated = await owner.post(`/api/users/${user!.id}/deactivate`).send();
    expect(deactivated.status).toBe(200);

    const after = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'clave-temporal-1' });
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('USER_INACTIVE');
  });

  it('exige sesion para las rutas protegidas', async () => {
    const response = await request(app).get('/api/orders');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('impide que planta administre usuarios, SLA o reportes', async () => {
    const plant = await loginAs(app, SEED_USERS.compras);

    const create = await plant.post('/api/users').send({
      name: 'Intruso',
      email: `intruso-${uniqueSuffix()}@zorzallirio.local`,
      role: 'PLANT',
      password: 'clave-intrusa-1',
    });
    expect(create.status).toBe(403);

    const reports = await plant.get('/api/reports/workload');
    expect(reports.status).toBe(403);

    const stages = await plant.get('/api/stages');
    expect(stages.status).toBe(200);

    const stageId = (stages.body.data.stages as Array<{ id: string }>)[0]!.id;
    const sla = await plant
      .patch(`/api/stages/${stageId}/sla`)
      .send({ isSlaEnabled: true, slaMinutes: 1440, warningBeforeMinutes: 60 });
    expect(sla.status).toBe(403);
  });

  it('cierra la sesion y deja de reconocer la cookie', async () => {
    const agent = await loginAs(app, SEED_USERS.admin);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const logout = await agent.post('/api/auth/logout').send();
    expect(logout.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('responde el health check con el estado de la base de datos', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
    expect(typeof response.body.timestamp).toBe('string');
  });
});
