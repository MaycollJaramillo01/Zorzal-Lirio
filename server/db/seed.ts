import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { closePool, getDb } from './client.js';
import { orders, stages, systemSettings, users } from './schema.js';
import { STAGE_DEFINITIONS, type StageCode } from '../../shared/constants/stages.js';
import type { Role } from '../../shared/constants/enums.js';
import { hashPassword } from '../services/authService.js';
import { replaceStageFocus } from '../repositories/userRepository.js';
import { createOrder, transitionOrder } from '../services/orderService.js';
import type { AuthUser } from '../types/auth.js';

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  focus: StageCode[];
  isPrimaryOwner?: boolean;
}

const SEED_USERS: SeedUser[] = [
  {
    name: 'Dueno Zorzal Lirio',
    email: 'owner@zorzallirio.local',
    password: 'owner123',
    role: 'OWNER',
    focus: STAGE_DEFINITIONS.map((stage) => stage.code),
    isPrimaryOwner: true,
  },
  {
    name: 'Administrador',
    email: 'admin@zorzallirio.local',
    password: 'admin123',
    role: 'ADMIN',
    focus: STAGE_DEFINITIONS.map((stage) => stage.code),
  },
  {
    name: 'Responsable de compras',
    email: 'compras@zorzallirio.local',
    password: 'planta123',
    role: 'PLANT',
    focus: ['FABRIC_PURCHASE'],
  },
  {
    name: 'Responsable de taller',
    email: 'taller@zorzallirio.local',
    password: 'planta123',
    role: 'PLANT',
    focus: ['WORKSHOP', 'EMBROIDERY'],
  },
  {
    name: 'Responsable de envios',
    email: 'envio@zorzallirio.local',
    password: 'planta123',
    role: 'PLANT',
    focus: ['SHIPPING', 'COLLECTION'],
  },
];

async function seedStages(): Promise<Map<StageCode, string>> {
  const db = getDb();
  const map = new Map<StageCode, string>();

  for (const definition of STAGE_DEFINITIONS) {
    const [existing] = await db.select().from(stages).where(eq(stages.code, definition.code)).limit(1);

    if (existing) {
      // Nombre y posicion pertenecen al sistema; el SLA lo administra el usuario.
      await db
        .update(stages)
        .set({ name: definition.name, position: definition.position, updatedAt: new Date() })
        .where(eq(stages.id, existing.id));
      map.set(definition.code, existing.id);
      continue;
    }

    const [created] = await db
      .insert(stages)
      .values({
        code: definition.code,
        name: definition.name,
        position: definition.position,
        slaMinutes: definition.slaMinutes,
        warningBeforeMinutes: definition.warningBeforeMinutes,
        isSlaEnabled: definition.isSlaEnabled,
      })
      .returning();
    map.set(definition.code, created!.id);
  }

  return map;
}

async function seedUsers(stageIds: Map<StageCode, string>): Promise<Map<string, string>> {
  const db = getDb();
  const created = new Map<string, string>();

  if (!env.SEED_DEFAULT_USERS) {
    logger.info('SEED_DEFAULT_USERS=false: se omite la creacion de usuarios iniciales.');
    const existing = await db.select({ id: users.id, email: users.email }).from(users);
    for (const user of existing) created.set(user.email, user.id);
    return created;
  }

  for (const seedUser of SEED_USERS) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, seedUser.email))
      .limit(1);

    if (existing) {
      created.set(seedUser.email, existing.id);
      continue;
    }

    const [user] = await db
      .insert(users)
      .values({
        name: seedUser.name,
        email: seedUser.email,
        passwordHash: await hashPassword(seedUser.password),
        role: seedUser.role,
        // En produccion las cuentas iniciales exigen cambio de contrasena.
        mustChangePassword: env.isProduction,
        isPrimaryOwner: seedUser.isPrimaryOwner ?? false,
      })
      .returning();

    const focusIds = seedUser.focus
      .map((code) => stageIds.get(code))
      .filter((id): id is string => Boolean(id));
    await replaceStageFocus(user!.id, focusIds);

    created.set(seedUser.email, user!.id);
    logger.info({ email: seedUser.email, role: seedUser.role }, 'Usuario inicial creado');
  }

  return created;
}

async function seedSettings(): Promise<void> {
  const db = getDb();
  const defaults: Array<{ key: string; value: unknown }> = [
    { key: 'app.name', value: 'Zorzal Lirio OS' },
    { key: 'app.timezone', value: env.APP_TIMEZONE },
    { key: 'alerts.channel', value: env.smtpEnabled ? 'EMAIL' : 'CONSOLE' },
  ];

  for (const setting of defaults) {
    await db
      .insert(systemSettings)
      .values({ key: setting.key, value: setting.value })
      .onConflictDoNothing({ target: systemSettings.key });
  }
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function seedDemoOrders(userIds: Map<string, string>, stageIds: Map<StageCode, string>) {
  if (env.isProduction) return;

  const db = getDb();
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(orders);
  if ((row?.total ?? 0) > 0) {
    logger.info('Ya existen ordenes: se omiten las ordenes de demostracion.');
    return;
  }

  const ownerId = userIds.get('owner@zorzallirio.local');
  const comprasId = userIds.get('compras@zorzallirio.local');
  const tallerId = userIds.get('taller@zorzallirio.local');
  const envioId = userIds.get('envio@zorzallirio.local');
  if (!ownerId || !comprasId || !tallerId || !envioId) {
    logger.warn('Faltan usuarios iniciales: se omiten las ordenes de demostracion.');
    return;
  }

  const actor: AuthUser = {
    id: ownerId,
    name: 'Dueno Zorzal Lirio',
    email: 'owner@zorzallirio.local',
    role: 'OWNER',
    isActive: true,
    mustChangePassword: false,
    isPrimaryOwner: true,
    lastLoginAt: null,
    stageFocusIds: [...stageIds.values()],
  };

  const demos = [
    {
      purchaseOrderNumber: 'OC-2026-1180',
      customerName: 'Colegio Santa Marta',
      projectName: 'Uniformes escolares primaria',
      quantity: 320,
      priority: 'HIGH' as const,
      purchaseOrderDate: daysAgo(12),
      initialAssigneeId: comprasId,
      advanceTo: ['FABRIC_PURCHASE', 'WORKSHOP'] as StageCode[],
      assignees: [comprasId, tallerId],
    },
    {
      purchaseOrderNumber: 'OC-2026-1181',
      customerName: 'Hotel Gran Managua',
      projectName: 'Uniformes de recepcion',
      quantity: 45,
      priority: 'NORMAL' as const,
      purchaseOrderDate: daysAgo(9),
      initialAssigneeId: comprasId,
      advanceTo: ['FABRIC_PURCHASE'] as StageCode[],
      assignees: [comprasId],
    },
    {
      purchaseOrderNumber: 'OC-2026-1182',
      customerName: 'Ferreteria El Martillo',
      projectName: 'Camisas de bodega',
      quantity: 60,
      priority: 'URGENT' as const,
      purchaseOrderDate: daysAgo(20),
      initialAssigneeId: tallerId,
      advanceTo: ['FABRIC_PURCHASE', 'WORKSHOP', 'EMBROIDERY'] as StageCode[],
      assignees: [comprasId, tallerId, tallerId],
    },
    {
      purchaseOrderNumber: 'OC-2026-1183',
      customerName: 'Clinica San Rafael',
      projectName: 'Gabachas medicas',
      quantity: 120,
      priority: 'NORMAL' as const,
      purchaseOrderDate: daysAgo(4),
      initialAssigneeId: comprasId,
      advanceTo: [] as StageCode[],
      assignees: [] as string[],
    },
    {
      purchaseOrderNumber: 'OC-2026-1184',
      customerName: 'Transporte Rivas',
      projectName: 'Chalecos reflectivos',
      quantity: 80,
      priority: 'LOW' as const,
      purchaseOrderDate: daysAgo(30),
      initialAssigneeId: envioId,
      advanceTo: ['FABRIC_PURCHASE', 'WORKSHOP', 'EMBROIDERY', 'SHIPPING'] as StageCode[],
      assignees: [comprasId, tallerId, tallerId, envioId],
    },
    {
      purchaseOrderNumber: 'OC-2026-1185',
      customerName: 'Panaderia La Espiga',
      projectName: 'Delantales y gorros',
      quantity: 35,
      priority: 'NORMAL' as const,
      purchaseOrderDate: daysAgo(2),
      initialAssigneeId: comprasId,
      advanceTo: [] as StageCode[],
      assignees: [] as string[],
    },
  ];

  for (const demo of demos) {
    let order = await createOrder(
      actor,
      {
        purchaseOrderNumber: demo.purchaseOrderNumber,
        customerName: demo.customerName,
        projectName: demo.projectName,
        description: 'Orden de demostracion generada por el seed.',
        quantity: demo.quantity,
        priority: demo.priority,
        purchaseOrderDate: demo.purchaseOrderDate,
        expectedDeliveryDate: '',
        initialAssigneeId: demo.initialAssigneeId,
        initialNote: '',
      },
      null,
    );

    for (let index = 0; index < demo.advanceTo.length; index += 1) {
      const stageId = stageIds.get(demo.advanceTo[index]!);
      if (!stageId) continue;
      order = await transitionOrder(
        actor,
        order.id,
        {
          version: order.version,
          toStageId: stageId,
          assigneeId: demo.assignees[index] ?? demo.initialAssigneeId,
          note: '',
          reason: '',
        },
        null,
      );
    }
  }

  logger.info({ total: demos.length }, 'Ordenes de demostracion creadas');
}

async function main(): Promise<void> {
  if (!env.hasDatabase) {
    throw new Error('DATABASE_URL no esta configurado. Define la conexion de Neon en .env.');
  }

  logger.info({ env: env.NODE_ENV }, 'Ejecutando seed de Zorzal Lirio OS');

  const stageIds = await seedStages();
  const userIds = await seedUsers(stageIds);
  await seedSettings();
  await seedDemoOrders(userIds, stageIds);

  logger.info('Seed completado.');
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('Fallo el seed:', error instanceof Error ? error.message : error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
