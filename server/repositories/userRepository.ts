import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../db/client.js';
import { stages, userStageFocus, users } from '../db/schema.js';
import type { Role } from '../../shared/constants/enums.js';
import type { StageRef } from '../../shared/types/index.js';
import type { StageCode } from '../../shared/constants/stages.js';

export async function findUserByEmail(email: string) {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return row ?? null;
}

export async function findUserById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function isEmailTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const db = getDb();
  const condition = exceptUserId
    ? and(eq(users.email, email.toLowerCase()), ne(users.id, exceptUserId))
    : eq(users.email, email.toLowerCase());
  const [row] = await db.select({ id: users.id }).from(users).where(condition).limit(1);
  return Boolean(row);
}

export async function listUsers(options: { onlyActive?: boolean } = {}) {
  const db = getDb();
  const query = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      isPrimaryOwner: users.isPrimaryOwner,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));

  const rows = options.onlyActive ? await query.where(eq(users.isActive, true)) : await query;
  return rows;
}

export async function listActiveUsersByRoles(roles: Role[]) {
  const db = getDb();
  if (roles.length === 0) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.isActive, true), inArray(users.role, roles)));
}

export async function getStageFocusIds(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ stageId: userStageFocus.stageId })
    .from(userStageFocus)
    .where(eq(userStageFocus.userId, userId));
  return rows.map((row) => row.stageId);
}

export async function getStageFocusByUsers(
  userIds: string[],
): Promise<Map<string, StageRef[]>> {
  const result = new Map<string, StageRef[]>();
  if (userIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      userId: userStageFocus.userId,
      id: stages.id,
      code: stages.code,
      name: stages.name,
      position: stages.position,
    })
    .from(userStageFocus)
    .innerJoin(stages, eq(stages.id, userStageFocus.stageId))
    .where(inArray(userStageFocus.userId, userIds))
    .orderBy(asc(stages.position));

  for (const row of rows) {
    const list = result.get(row.userId) ?? [];
    list.push({ id: row.id, code: row.code as StageCode, name: row.name, position: row.position });
    result.set(row.userId, list);
  }
  return result;
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  mustChangePassword: boolean;
  isPrimaryOwner?: boolean;
}

export async function insertUser(data: CreateUserData, exec: DbExecutor = getDb()) {
  const [row] = await exec
    .insert(users)
    .values({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role,
      mustChangePassword: data.mustChangePassword,
      isPrimaryOwner: data.isPrimaryOwner ?? false,
    })
    .returning();
  return row!;
}

export async function updateUserRow(
  id: string,
  data: Partial<{ name: string; email: string; role: Role; isActive: boolean }>,
  exec: DbExecutor = getDb(),
) {
  const [row] = await exec
    .update(users)
    .set({
      ...data,
      ...(data.email ? { email: data.email.toLowerCase() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  return row ?? null;
}

export async function updateUserPassword(
  id: string,
  passwordHash: string,
  mustChangePassword: boolean,
  exec: DbExecutor = getDb(),
) {
  const [row] = await exec
    .update(users)
    .set({ passwordHash, mustChangePassword, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row ?? null;
}

export async function touchLastLogin(id: string) {
  await getDb()
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function replaceStageFocus(
  userId: string,
  stageIds: string[],
  exec: DbExecutor = getDb(),
) {
  await exec.delete(userStageFocus).where(eq(userStageFocus.userId, userId));
  if (stageIds.length > 0) {
    await exec
      .insert(userStageFocus)
      .values(stageIds.map((stageId) => ({ userId, stageId })))
      .onConflictDoNothing();
  }
}

/** Usuarios cuyo enfoque incluye la etapa indicada. */
export async function listUserIdsFocusedOnStage(stageId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: userStageFocus.userId })
    .from(userStageFocus)
    .where(eq(userStageFocus.stageId, stageId));
  return rows.map((row) => row.userId);
}

export async function countUsers(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(users);
  return row?.total ?? 0;
}
