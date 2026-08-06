import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { checkDatabaseConnection } from '../db/client.js';
import { sendFail } from '../utils/apiResponse.js';
import { safeCompare } from '../utils/tokens.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../../shared/constants/errors.js';
import { runSlaCheck } from '../services/slaCheckService.js';
import type { HealthResponse } from '../../shared/types/index.js';

export const getHealth: RequestHandler = async (_req, res) => {
  const connected = env.hasDatabase ? await checkDatabaseConnection() : false;
  const body: HealthResponse = {
    status: connected ? 'ok' : 'error',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };
  res.status(connected ? 200 : 503).json(body);
};

/** Cron protegido por `Authorization: Bearer ${CRON_SECRET}`. */
export const getCronSla: RequestHandler = async (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token || !safeCompare(token, env.cronSecret)) {
    sendFail(res, 401, ERROR_CODES.UNAUTHENTICATED, ERROR_MESSAGES.UNAUTHENTICATED);
    return;
  }

  // Respuesta plana, tal como la consume el panel de Vercel Cron.
  const summary = await runSlaCheck({ trigger: 'cron' });
  res.status(200).json(summary);
};
