import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../db/client.js';
import { sessions, users } from '../db/schema.js';

export async function insertSession(
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  },
  exec: DbExecutor = getDb(),
) {
  const [row] = await exec.insert(sessions).values(data).returning();
  return row!;
}

/** Sesion vigente junto con el usuario dueno de la misma. */
export async function findActiveSession(tokenHash: string, exec: DbExecutor = getDb()) {
  const [row] = await exec
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function touchSession(id: string, exec: DbExecutor = getDb()) {
  await exec.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, id));
}

export async function deleteSession(id: string, exec: DbExecutor = getDb()) {
  await exec.delete(sessions).where(eq(sessions.id, id));
}

export async function deleteSessionsForUser(userId: string, exec: DbExecutor = getDb()) {
  await exec.delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpiredSessions(exec: DbExecutor = getDb()) {
  await exec.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
