import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/** Token opaco de sesion entregado al navegador (nunca se guarda en claro). */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash del token con el secreto de la aplicacion, para almacenar en PostgreSQL. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(`${env.sessionSecret}:${token}`).digest('hex');
}

/** Comparacion en tiempo constante para secretos cortos (cron). */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
