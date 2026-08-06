import { asc, eq } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../db/client.js';
import { stages } from '../db/schema.js';
import type { StageCode } from '../../shared/constants/stages.js';
import type { StageDto } from '../../shared/types/index.js';

export type StageRecord = typeof stages.$inferSelect;

export async function listStages(exec: DbExecutor = getDb()): Promise<StageRecord[]> {
  return exec.select().from(stages).orderBy(asc(stages.position));
}

export async function findStageById(
  id: string,
  exec: DbExecutor = getDb(),
): Promise<StageRecord | null> {
  const [row] = await exec.select().from(stages).where(eq(stages.id, id)).limit(1);
  return row ?? null;
}

export async function findStageByCode(
  code: StageCode,
  exec: DbExecutor = getDb(),
): Promise<StageRecord | null> {
  const [row] = await exec.select().from(stages).where(eq(stages.code, code)).limit(1);
  return row ?? null;
}

export async function updateStageSla(
  id: string,
  data: { slaMinutes: number | null; warningBeforeMinutes: number | null; isSlaEnabled: boolean },
  exec: DbExecutor = getDb(),
): Promise<StageRecord | null> {
  const [row] = await exec
    .update(stages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(stages.id, id))
    .returning();
  return row ?? null;
}

export function toStageDto(stage: StageRecord): StageDto {
  return {
    id: stage.id,
    code: stage.code as StageCode,
    name: stage.name,
    position: stage.position,
    slaMinutes: stage.slaMinutes,
    warningBeforeMinutes: stage.warningBeforeMinutes,
    isSlaEnabled: stage.isSlaEnabled,
    isActive: stage.isActive,
  };
}
