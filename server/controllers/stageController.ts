import type { RequestHandler } from 'express';
import { updateStageSlaSchema } from '../../shared/schemas/stages.js';
import { uuidSchema } from '../../shared/schemas/common.js';
import { parseInput } from '../utils/validate.js';
import { sendOk } from '../utils/apiResponse.js';
import { clientIp, getAuth } from '../middleware/auth.js';
import { getStages, updateStageSlaConfig } from '../services/stageService.js';

export const getStagesHandler: RequestHandler = async (_req, res) => {
  sendOk(res, { stages: await getStages() });
};

export const patchStageSla: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(updateStageSlaSchema, req.body);
  sendOk(res, { stages: await updateStageSlaConfig(auth.user, id, input, clientIp(req)) });
};
