import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { httpErrors } from '../utils/appError.js';
import { createSessionToken, hashSessionToken } from '../utils/tokens.js';
import {
  deleteSession,
  deleteSessionsForUser,
  findActiveSession,
  insertSession,
  touchSession,
} from '../repositories/sessionRepository.js';
import {
  findUserByEmail,
  findUserById,
  getStageFocusIds,
  touchLastLogin,
  updateUserPassword,
} from '../repositories/userRepository.js';
import { recordAudit } from './auditService.js';
import type { AuthContext, AuthUser } from '../types/auth.js';
import type { UserRow } from '../db/schema.js';

export const SESSION_COOKIE_NAME = 'zl_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BCRYPT_ROUNDS = env.isTest ? 8 : 12;

let dummyHash: string | null = null;
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync('zorzal-lirio-usuario-inexistente', 8);
  return dummyHash;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function toAuthUser(user: UserRow): Promise<AuthUser> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    isPrimaryOwner: user.isPrimaryOwner,
    lastLoginAt: user.lastLoginAt,
    stageFocusIds: await getStageFocusIds(user.id),
  };
}

export interface LoginContext {
  email: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export async function login(context: LoginContext): Promise<{ token: string; user: AuthUser }> {
  const user = await findUserByEmail(context.email);

  if (!user) {
    // Comparacion falsa para no revelar por tiempo si el correo existe.
    await bcrypt.compare(context.password, getDummyHash());
    throw httpErrors.invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(context.password, user.passwordHash);
  if (!passwordMatches) throw httpErrors.invalidCredentials();
  if (!user.isActive) throw httpErrors.userInactive();

  const token = createSessionToken();
  await insertSession({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    ipAddress: context.ipAddress,
    userAgent: context.userAgent ? context.userAgent.slice(0, 400) : null,
  });

  await touchLastLogin(user.id);
  await recordAudit({
    actorUserId: user.id,
    action: 'AUTH_LOGIN',
    entityType: 'user',
    entityId: user.id,
    ipAddress: context.ipAddress,
  });

  return { token, user: await toAuthUser({ ...user, lastLoginAt: new Date() }) };
}

export async function resolveSession(token: string): Promise<AuthContext | null> {
  const record = await findActiveSession(hashSessionToken(token));
  if (!record) return null;

  if (!record.user.isActive) {
    await deleteSessionsForUser(record.user.id);
    return null;
  }

  await touchSession(record.sessionId);
  return { user: await toAuthUser(record.user), sessionId: record.sessionId };
}

export async function logout(auth: AuthContext, ipAddress: string | null): Promise<void> {
  await deleteSession(auth.sessionId);
  await recordAudit({
    actorUserId: auth.user.id,
    action: 'AUTH_LOGOUT',
    entityType: 'user',
    entityId: auth.user.id,
    ipAddress,
  });
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress: string | null,
): Promise<void> {
  const user = await findUserById(userId);
  if (!user) throw httpErrors.notFound('Usuario no encontrado.');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw httpErrors.invalidCredentials();

  await updateUserPassword(userId, await hashPassword(newPassword), false);
  // Al cambiar la contrasena se revocan todas las sesiones abiertas.
  await deleteSessionsForUser(userId);
  await recordAudit({
    actorUserId: userId,
    action: 'AUTH_PASSWORD_CHANGED',
    entityType: 'user',
    entityId: userId,
    ipAddress,
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}
