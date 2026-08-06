import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { httpErrors } from '../utils/appError.js';
import { SESSION_COOKIE_NAME, resolveSession } from '../services/authService.js';
import type { AuthContext } from '../types/auth.js';
import type { Role } from '../../shared/constants/enums.js';

/** Lee la cookie de sesion y adjunta el usuario al request cuando es valida. */
export const attachAuth: RequestHandler = async (req, _res, next) => {
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[
    SESSION_COOKIE_NAME
  ];
  if (token) {
    req.auth = (await resolveSession(token)) ?? undefined;
  }
  next();
};

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw httpErrors.unauthenticated();
  return req.auth;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(httpErrors.unauthenticated());
    return;
  }
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(httpErrors.unauthenticated());
      return;
    }
    if (!roles.includes(req.auth.user.role)) {
      next(httpErrors.forbidden());
      return;
    }
    next();
  };
}

export const requireManager = requireRole('OWNER', 'ADMIN');

/**
 * Bloquea el resto de la API mientras el usuario tenga `must_change_password`.
 * Las rutas de sesion y cambio de contrasena se registran antes de este guard.
 */
export const requirePasswordUpToDate: RequestHandler = (req, _res, next) => {
  if (req.auth?.user.mustChangePassword) {
    next(httpErrors.passwordChangeRequired());
    return;
  }
  next();
};

export function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim().slice(0, 64);
  }
  return req.ip ? req.ip.slice(0, 64) : null;
}

export function userAgent(req: Request): string | null {
  const value = req.headers['user-agent'];
  return typeof value === 'string' ? value.slice(0, 400) : null;
}
