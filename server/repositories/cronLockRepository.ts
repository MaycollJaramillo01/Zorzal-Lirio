import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { cronLocks } from '../db/schema.js';

/**
 * Lock con expiracion en PostgreSQL. Se prefiere a un advisory lock porque
 * sobrevive al modelo de conexiones efimeras de Vercel y se auto-libera si un
 * proceso muere a mitad de ejecucion.
 * ponytail: si se necesita exclusion sub-segundo, cambiar a pg_try_advisory_lock.
 */
export async function acquireCronLock(
  name: string,
  ttlMs: number,
  lockedBy: string,
): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const acquired = await db
    .insert(cronLocks)
    .values({ name, lockedAt: now, expiresAt, lockedBy })
    .onConflictDoUpdate({
      target: cronLocks.name,
      set: { lockedAt: now, expiresAt, lockedBy },
      // Solo se toma el lock si el anterior ya expiro.
      setWhere: lt(cronLocks.expiresAt, now),
    })
    .returning({ name: cronLocks.name });

  return acquired.length > 0;
}

/**
 * Solo libera si el lock sigue siendo de quien lo tomo: una ejecucion lenta que
 * termina despues de expirar no debe soltar el lock de la ejecucion siguiente.
 */
export async function releaseCronLock(
  name: string,
  lockedBy: string,
  summary: unknown,
): Promise<void> {
  const db = getDb();
  await db
    .update(cronLocks)
    .set({ expiresAt: new Date(0), lastRunAt: new Date(), lastSummary: summary ?? null })
    .where(and(eq(cronLocks.name, name), eq(cronLocks.lockedBy, lockedBy)));
}

export async function getCronLock(name: string) {
  const db = getDb();
  const [row] = await db.select().from(cronLocks).where(eq(cronLocks.name, name)).limit(1);
  return row ?? null;
}
