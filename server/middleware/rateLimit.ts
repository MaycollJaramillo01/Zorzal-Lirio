import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../../shared/constants/errors.js';

const failureBody = {
  success: false,
  data: null,
  error: { code: ERROR_CODES.RATE_LIMITED, message: ERROR_MESSAGES.RATE_LIMITED },
};

/** Limite estricto para el login: protege contra fuerza bruta. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: failureBody,
});

/** Limite general de la API, mas holgado. */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 100_000 : 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: failureBody,
});
