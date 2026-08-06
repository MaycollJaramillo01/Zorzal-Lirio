import { getDb } from '../db/client.js';
import { httpErrors } from '../utils/appError.js';
import type { UpdateStageSlaInput } from '../../shared/schemas/stages.js';
import type { StageDto } from '../../shared/types/index.js';
import type { AuthUser } from '../types/auth.js';
import {
  findStageById,
  listStages,
  toStageDto,
  updateStageSla,
} from '../repositories/stageRepository.js';
import { recordAudit } from './auditService.js';

export async function getStages(): Promise<StageDto[]> {
  const stages = await listStages();
  return stages.map(toStageDto);
}

export async function updateStageSlaConfig(
  actor: AuthUser,
  stageId: string,
  input: UpdateStageSlaInput,
  ipAddress: string | null,
): Promise<StageDto[]> {
  const stage = await findStageById(stageId);
  if (!stage) throw httpErrors.notFound('La etapa no existe.');

  await getDb().transaction(async (tx) => {
    const updated = await updateStageSla(
      stageId,
      {
        slaMinutes: input.isSlaEnabled ? input.slaMinutes : null,
        warningBeforeMinutes: input.isSlaEnabled ? input.warningBeforeMinutes : null,
        isSlaEnabled: input.isSlaEnabled,
      },
      tx,
    );
    if (!updated) throw httpErrors.notFound('La etapa no existe.');

    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'STAGE_SLA_UPDATED',
        entityType: 'stage',
        entityId: stageId,
        beforeData: {
          slaMinutes: stage.slaMinutes,
          warningBeforeMinutes: stage.warningBeforeMinutes,
          isSlaEnabled: stage.isSlaEnabled,
        },
        afterData: {
          slaMinutes: updated.slaMinutes,
          warningBeforeMinutes: updated.warningBeforeMinutes,
          isSlaEnabled: updated.isSlaEnabled,
        },
        ipAddress,
      },
      tx,
    );
  });

  return getStages();
}
