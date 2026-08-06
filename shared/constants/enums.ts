export const ROLES = ['OWNER', 'ADMIN', 'PLANT'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Dueno',
  ADMIN: 'Administrador',
  PLANT: 'Planta',
};

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEFAULT_PRIORITY: Priority = 'NORMAL';

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baja',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

/** Orden de severidad, usado para ordenar listados. */
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export const SLA_STATES = ['NORMAL', 'WARNING', 'OVERDUE', 'NO_SLA'] as const;
export type SlaState = (typeof SLA_STATES)[number];

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  NORMAL: 'En tiempo',
  WARNING: 'Proximo a vencer',
  OVERDUE: 'Atrasado',
  NO_SLA: 'Sin SLA',
};

export const ALERT_TYPES = ['SLA_WARNING', 'SLA_OVERDUE'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  SLA_WARNING: 'Proximo a vencer',
  SLA_OVERDUE: 'Atrasado',
};

export const ALERT_CHANNELS = ['EMAIL', 'CONSOLE'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const ALERT_STATUSES = ['PENDING', 'SENT', 'FAILED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const AUDIT_ACTIONS = [
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'ORDER_TRANSITIONED',
  'ORDER_REASSIGNED',
  'ORDER_ARCHIVED',
  'ORDER_RESTORED',
  'NOTE_CREATED',
  'NOTE_HIDDEN',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'USER_PASSWORD_RESET',
  'USER_STAGE_FOCUS_UPDATED',
  'STAGE_SLA_UPDATED',
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'AUTH_PASSWORD_CHANGED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  ORDER_CREATED: 'Orden creada',
  ORDER_UPDATED: 'Orden editada',
  ORDER_TRANSITIONED: 'Cambio de etapa',
  ORDER_REASSIGNED: 'Cambio de responsable',
  ORDER_ARCHIVED: 'Orden archivada',
  ORDER_RESTORED: 'Orden restaurada',
  NOTE_CREATED: 'Nota creada',
  NOTE_HIDDEN: 'Nota oculta',
  USER_CREATED: 'Usuario creado',
  USER_UPDATED: 'Usuario editado',
  USER_ACTIVATED: 'Usuario activado',
  USER_DEACTIVATED: 'Usuario desactivado',
  USER_PASSWORD_RESET: 'Contrasena restablecida',
  USER_STAGE_FOCUS_UPDATED: 'Etapas de enfoque actualizadas',
  STAGE_SLA_UPDATED: 'SLA de etapa actualizado',
  AUTH_LOGIN: 'Inicio de sesion',
  AUTH_LOGOUT: 'Cierre de sesion',
  AUTH_PASSWORD_CHANGED: 'Cambio de contrasena',
};
