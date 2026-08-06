import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/appError.js';
import { sendFail } from '../utils/apiResponse.js';
import { formatZodError } from '../utils/validate.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../../shared/constants/errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendFail(res, 404, ERROR_CODES.NOT_FOUND, `Ruta no encontrada: ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error({ err: error, path: req.path }, 'Error de aplicacion');
    }
    sendFail(res, error.status, error.code, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendFail(
      res,
      422,
      ERROR_CODES.VALIDATION_ERROR,
      ERROR_MESSAGES.VALIDATION_ERROR,
      formatZodError(error),
    );
    return;
  }

  const status = typeof (error as { status?: number }).status === 'number'
    ? (error as { status: number }).status
    : 500;

  if (status === 413) {
    sendFail(res, 413, ERROR_CODES.PAYLOAD_TOO_LARGE, ERROR_MESSAGES.PAYLOAD_TOO_LARGE);
    return;
  }

  if (status === 400 && error instanceof SyntaxError) {
    sendFail(res, 400, ERROR_CODES.VALIDATION_ERROR, 'El cuerpo de la solicitud no es JSON valido.');
    return;
  }

  logger.error({ err: error, path: req.path }, 'Error no controlado');

  sendFail(
    res,
    500,
    ERROR_CODES.INTERNAL_ERROR,
    ERROR_MESSAGES.INTERNAL_ERROR,
    // Nunca se exponen stack traces en produccion.
    env.isProduction ? undefined : { message: (error as Error)?.message },
  );
};
