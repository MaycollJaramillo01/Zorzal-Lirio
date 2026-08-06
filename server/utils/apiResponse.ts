import type { Response } from 'express';
import type { ApiFailure, ApiSuccess } from '../../shared/types/index.js';

export function sendOk<T>(res: Response, data: T, status = 200): Response {
  const body: ApiSuccess<T> = { success: true, data, error: null };
  return res.status(status).json(body);
}

export function sendFail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiFailure = {
    success: false,
    data: null,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return res.status(status).json(body);
}
