import { getDb } from '../db/client.js';
import { httpErrors } from '../utils/appError.js';
import { canModifyUser } from '../../shared/lib/permissions.js';
import type {
  CreateUserInput,
  ResetPasswordInput,
  StageFocusInput,
  UpdateUserInput,
} from '../../shared/schemas/users.js';
import type { SessionUser, TeamMember, UserRef } from '../../shared/types/index.js';
import type { AuthUser } from '../types/auth.js';
import {
  findUserById,
  getStageFocusByUsers,
  insertUser,
  isEmailTaken,
  listUsers,
  replaceStageFocus,
  updateUserPassword,
  updateUserRow,
} from '../repositories/userRepository.js';
import { deleteSessionsForUser } from '../repositories/sessionRepository.js';
import { hashPassword } from './authService.js';
import { recordAudit } from './auditService.js';
import { loadActiveOrderCards } from './orderService.js';
import {
  findGhlContactByPhone,
  GhlApiError,
  isGhlWhatsAppEnabled,
} from './ghlWhatsAppService.js';

interface WhatsappSetupInput {
  whatsappPhone?: string | null;
  whatsappNotificationsEnabled?: boolean;
}

interface WhatsappSetupCurrent {
  whatsappPhone: string | null;
  ghlContactId: string | null;
  whatsappNotificationsEnabled: boolean;
}

type WhatsappSetupPatch = Partial<WhatsappSetupCurrent>;

async function resolveWhatsappSetup(
  input: WhatsappSetupInput,
  current?: WhatsappSetupCurrent,
): Promise<WhatsappSetupPatch> {
  const hasWhatsappChange =
    input.whatsappPhone !== undefined || input.whatsappNotificationsEnabled !== undefined;
  if (!hasWhatsappChange) return {};

  const phone = input.whatsappPhone !== undefined ? input.whatsappPhone : current?.whatsappPhone ?? null;
  const enabled =
    input.whatsappNotificationsEnabled ?? current?.whatsappNotificationsEnabled ?? false;

  if (!phone) {
    if (enabled) {
      throw httpErrors.validation(undefined, 'Escribe el WhatsApp del usuario antes de activarlo.');
    }
    return {
      whatsappPhone: null,
      ghlContactId: null,
      whatsappNotificationsEnabled: false,
    };
  }

  if (!enabled) {
    return {
      whatsappPhone: phone,
      whatsappNotificationsEnabled: false,
      ...(phone !== current?.whatsappPhone ? { ghlContactId: null } : {}),
    };
  }

  if (!isGhlWhatsAppEnabled()) {
    throw httpErrors.validation(undefined, 'La integracion de WhatsApp no esta habilitada.');
  }

  try {
    const contact = await findGhlContactByPhone(phone);
    if (!contact) {
      throw httpErrors.validation(
        undefined,
        `No existe un contacto interno en HighLevel con el numero ${phone}.`,
      );
    }
    return {
      whatsappPhone: contact.phone,
      ghlContactId: contact.id,
      whatsappNotificationsEnabled: true,
    };
  } catch (error) {
    if (error instanceof GhlApiError) {
      throw httpErrors.validation(undefined, error.message);
    }
    throw error;
  }
}

export async function toSessionUser(user: AuthUser): Promise<SessionUser> {
  const focusMap = await getStageFocusByUsers([user.id]);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    stageFocus: focusMap.get(user.id) ?? [],
  };
}

export async function listTeam(): Promise<TeamMember[]> {
  const [users, orders] = await Promise.all([listUsers(), loadActiveOrderCards()]);
  const focusMap = await getStageFocusByUsers(users.map((user) => user.id));

  const active = new Map<string, number>();
  const overdue = new Map<string, number>();
  for (const order of orders) {
    if (!order.assignee) continue;
    active.set(order.assignee.id, (active.get(order.assignee.id) ?? 0) + 1);
    if (order.sla.state === 'OVERDUE') {
      overdue.set(order.assignee.id, (overdue.get(order.assignee.id) ?? 0) + 1);
    }
  }

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    isPrimaryOwner: user.isPrimaryOwner,
    whatsappPhone: user.whatsappPhone,
    whatsappNotificationsEnabled: user.whatsappNotificationsEnabled,
    stageFocus: focusMap.get(user.id) ?? [],
    activeOrders: active.get(user.id) ?? 0,
    overdueOrders: overdue.get(user.id) ?? 0,
  }));
}

/** Listado reducido para selectores de responsable. */
export async function listAssignableUsers(): Promise<UserRef[]> {
  const users = await listUsers({ onlyActive: true });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }));
}

async function requireTarget(id: string) {
  const target = await findUserById(id);
  if (!target) throw httpErrors.notFound('El usuario no existe.');
  return target;
}

function assertCanModify(actor: AuthUser, target: { id: string; role: 'OWNER' | 'ADMIN' | 'PLANT'; isPrimaryOwner: boolean }) {
  if (!canModifyUser(actor.role, actor.id, target.role, target.id, target.isPrimaryOwner)) {
    throw httpErrors.protectedOwner(
      target.isPrimaryOwner
        ? 'El dueno principal no puede ser modificado por otro usuario.'
        : 'No puedes modificar a un usuario con rol superior.',
    );
  }
}

export async function createTeamUser(
  actor: AuthUser,
  input: CreateUserInput,
  ipAddress: string | null,
): Promise<TeamMember[]> {
  if (actor.role === 'ADMIN' && input.role === 'OWNER') {
    throw httpErrors.forbidden('Un administrador no puede crear usuarios con rol Dueno.');
  }
  if (await isEmailTaken(input.email)) throw httpErrors.emailTaken();

  const passwordHash = await hashPassword(input.password);
  const whatsappSetup = await resolveWhatsappSetup(input);

  await getDb().transaction(async (tx) => {
    const user = await insertUser(
      {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        mustChangePassword: input.mustChangePassword,
        ...whatsappSetup,
      },
      tx,
    );
    if (input.stageIds.length > 0) {
      await replaceStageFocus(user.id, input.stageIds, tx);
    }
    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'USER_CREATED',
        entityType: 'user',
        entityId: user.id,
        afterData: {
          name: user.name,
          email: user.email,
          role: user.role,
          whatsappPhone: user.whatsappPhone,
          whatsappNotificationsEnabled: user.whatsappNotificationsEnabled,
        },
        ipAddress,
      },
      tx,
    );
  });

  return listTeam();
}

export async function updateTeamUser(
  actor: AuthUser,
  userId: string,
  input: UpdateUserInput,
  ipAddress: string | null,
): Promise<TeamMember[]> {
  const target = await requireTarget(userId);
  assertCanModify(actor, target);

  if (input.role && target.isPrimaryOwner && input.role !== 'OWNER') {
    throw httpErrors.protectedOwner('No se puede cambiar el rol del dueno principal.');
  }
  if (actor.role === 'ADMIN' && input.role === 'OWNER') {
    throw httpErrors.forbidden('Un administrador no puede otorgar el rol Dueno.');
  }
  if (input.email && (await isEmailTaken(input.email, userId))) throw httpErrors.emailTaken();
  const whatsappSetup = await resolveWhatsappSetup(input, target);

  await getDb().transaction(async (tx) => {
    const updated = await updateUserRow(userId, { ...input, ...whatsappSetup }, tx);
    if (!updated) throw httpErrors.notFound('El usuario no existe.');
    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'USER_UPDATED',
        entityType: 'user',
        entityId: userId,
        beforeData: {
          name: target.name,
          email: target.email,
          role: target.role,
          whatsappPhone: target.whatsappPhone,
          whatsappNotificationsEnabled: target.whatsappNotificationsEnabled,
        },
        afterData: { ...input, ...whatsappSetup },
        ipAddress,
      },
      tx,
    );
  });

  return listTeam();
}

export async function setUserActiveState(
  actor: AuthUser,
  userId: string,
  isActive: boolean,
  ipAddress: string | null,
): Promise<TeamMember[]> {
  const target = await requireTarget(userId);
  assertCanModify(actor, target);

  if (target.isPrimaryOwner && !isActive) {
    throw httpErrors.protectedOwner('El dueno principal no puede desactivarse.');
  }
  if (actor.id === userId && !isActive) {
    throw httpErrors.forbidden('No puedes desactivar tu propio usuario.');
  }

  await getDb().transaction(async (tx) => {
    await updateUserRow(userId, { isActive }, tx);
    if (!isActive) {
      // Un usuario desactivado pierde inmediatamente sus sesiones abiertas.
      await deleteSessionsForUser(userId, tx);
    }
    await recordAudit(
      {
        actorUserId: actor.id,
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'user',
        entityId: userId,
        beforeData: { isActive: target.isActive },
        afterData: { isActive },
        ipAddress,
      },
      tx,
    );
  });

  return listTeam();
}

export async function resetUserPassword(
  actor: AuthUser,
  userId: string,
  input: ResetPasswordInput,
  ipAddress: string | null,
): Promise<TeamMember[]> {
  const target = await requireTarget(userId);
  assertCanModify(actor, target);

  const passwordHash = await hashPassword(input.newPassword);

  await getDb().transaction(async (tx) => {
    await updateUserPassword(userId, passwordHash, input.mustChangePassword, tx);
    await deleteSessionsForUser(userId, tx);
    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'USER_PASSWORD_RESET',
        entityType: 'user',
        entityId: userId,
        metadata: { mustChangePassword: input.mustChangePassword },
        ipAddress,
      },
      tx,
    );
  });

  return listTeam();
}

export async function updateUserStageFocus(
  actor: AuthUser,
  userId: string,
  input: StageFocusInput,
  ipAddress: string | null,
): Promise<TeamMember[]> {
  const target = await requireTarget(userId);
  assertCanModify(actor, target);

  await getDb().transaction(async (tx) => {
    await replaceStageFocus(userId, input.stageIds, tx);
    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'USER_STAGE_FOCUS_UPDATED',
        entityType: 'user',
        entityId: userId,
        afterData: { stageIds: input.stageIds },
        ipAddress,
      },
      tx,
    );
  });

  return listTeam();
}

export async function getTeamMember(userId: string): Promise<TeamMember> {
  const team = await listTeam();
  const member = team.find((item) => item.id === userId);
  if (!member) throw httpErrors.notFound('El usuario no existe.');
  return member;
}
