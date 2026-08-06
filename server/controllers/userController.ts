import type { RequestHandler } from 'express';
import {
  createUserSchema,
  resetPasswordSchema,
  stageFocusSchema,
  updateUserSchema,
} from '../../shared/schemas/users.js';
import { uuidSchema } from '../../shared/schemas/common.js';
import { parseInput } from '../utils/validate.js';
import { sendOk } from '../utils/apiResponse.js';
import { clientIp, getAuth } from '../middleware/auth.js';
import {
  createTeamUser,
  getTeamMember,
  listAssignableUsers,
  listTeam,
  resetUserPassword,
  setUserActiveState,
  updateTeamUser,
  updateUserStageFocus,
} from '../services/userService.js';
import { isManager } from '../../shared/lib/permissions.js';

/** Planta solo recibe el listado reducido para poblar selectores. */
export const getUsers: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  if (!isManager(auth.user.role)) {
    sendOk(res, { users: await listAssignableUsers() });
    return;
  }
  sendOk(res, { users: await listTeam() });
};

export const getUser: RequestHandler = async (req, res) => {
  const id = parseInput(uuidSchema, req.params.id);
  sendOk(res, await getTeamMember(id));
};

export const postUser: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const input = parseInput(createUserSchema, req.body);
  sendOk(res, { users: await createTeamUser(auth.user, input, clientIp(req)) }, 201);
};

export const patchUser: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(updateUserSchema, req.body);
  sendOk(res, { users: await updateTeamUser(auth.user, id, input, clientIp(req)) });
};

export const postResetPassword: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(resetPasswordSchema, req.body);
  sendOk(res, { users: await resetUserPassword(auth.user, id, input, clientIp(req)) });
};

export const postActivate: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  sendOk(res, { users: await setUserActiveState(auth.user, id, true, clientIp(req)) });
};

export const postDeactivate: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  sendOk(res, { users: await setUserActiveState(auth.user, id, false, clientIp(req)) });
};

export const putStageFocus: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = parseInput(uuidSchema, req.params.id);
  const input = parseInput(stageFocusSchema, req.body);
  sendOk(res, { users: await updateUserStageFocus(auth.user, id, input, clientIp(req)) });
};
