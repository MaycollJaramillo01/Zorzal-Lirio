import type { Role } from '../constants/enums.js';

export const MANAGER_ROLES: readonly Role[] = ['OWNER', 'ADMIN'];

export function isManager(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export interface Capabilities {
  viewAllOrders: boolean;
  createOrder: boolean;
  editOrder: boolean;
  archiveOrder: boolean;
  reassignAnyOrder: boolean;
  moveBackwardOrSkip: boolean;
  manageUsers: boolean;
  configureSla: boolean;
  viewReports: boolean;
  viewAudit: boolean;
  hideNotes: boolean;
}

export function capabilitiesFor(role: Role): Capabilities {
  const manager = isManager(role);
  return {
    viewAllOrders: manager,
    createOrder: manager,
    editOrder: manager,
    archiveOrder: manager,
    reassignAnyOrder: manager,
    moveBackwardOrSkip: manager,
    manageUsers: manager,
    configureSla: manager,
    viewReports: manager,
    viewAudit: manager,
    hideNotes: manager,
  };
}

/**
 * Un administrador no puede degradar, desactivar ni renombrar al dueno principal
 * (el primer OWNER creado por el seed).
 */
export function canModifyUser(
  actorRole: Role,
  actorId: string,
  targetRole: Role,
  targetId: string,
  targetIsPrimaryOwner: boolean,
): boolean {
  if (!isManager(actorRole)) return actorId === targetId;
  if (targetIsPrimaryOwner && actorId !== targetId) return false;
  if (actorRole === 'ADMIN' && targetRole === 'OWNER' && actorId !== targetId) return false;
  return true;
}
