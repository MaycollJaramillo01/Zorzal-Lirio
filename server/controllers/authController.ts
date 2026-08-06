import type { RequestHandler } from 'express';
import { changePasswordSchema, loginSchema } from '../../shared/schemas/auth.js';
import { parseInput } from '../utils/validate.js';
import { sendOk } from '../utils/apiResponse.js';
import { clientIp, getAuth, userAgent } from '../middleware/auth.js';
import {
  SESSION_COOKIE_NAME,
  changeOwnPassword,
  login,
  logout,
  sessionCookieOptions,
} from '../services/authService.js';
import { toSessionUser } from '../services/userService.js';

export const postLogin: RequestHandler = async (req, res) => {
  const input = parseInput(loginSchema, req.body);
  const { token, user } = await login({
    email: input.email,
    password: input.password,
    ipAddress: clientIp(req),
    userAgent: userAgent(req),
  });

  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  sendOk(res, await toSessionUser(user));
};

export const postLogout: RequestHandler = async (req, res) => {
  if (req.auth) {
    await logout(req.auth, clientIp(req));
  }
  res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOptions(), maxAge: undefined });
  sendOk(res, { loggedOut: true });
};

export const getMe: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  sendOk(res, await toSessionUser(auth.user));
};

export const postChangePassword: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const input = parseInput(changePasswordSchema, req.body);

  await changeOwnPassword(auth.user.id, input.currentPassword, input.newPassword, clientIp(req));

  // La sesion actual tambien queda revocada: el usuario vuelve a iniciar sesion.
  res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOptions(), maxAge: undefined });
  sendOk(res, { passwordChanged: true });
};
