import { ERROR_CODES, ERROR_MESSAGES, type ErrorCode } from '../../shared/constants/errors.js';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, status: number, message?: string, details?: unknown) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const httpErrors = {
  validation: (details?: unknown, message?: string) =>
    new AppError(ERROR_CODES.VALIDATION_ERROR, 422, message, details),
  unauthenticated: (message?: string) => new AppError(ERROR_CODES.UNAUTHENTICATED, 401, message),
  invalidCredentials: () => new AppError(ERROR_CODES.INVALID_CREDENTIALS, 401),
  userInactive: () => new AppError(ERROR_CODES.USER_INACTIVE, 403),
  forbidden: (message?: string) => new AppError(ERROR_CODES.FORBIDDEN, 403, message),
  notFound: (message?: string) => new AppError(ERROR_CODES.NOT_FOUND, 404, message),
  conflict: (message?: string, details?: unknown) =>
    new AppError(ERROR_CODES.CONFLICT, 409, message, details),
  versionConflict: (details?: unknown) =>
    new AppError(ERROR_CODES.ORDER_VERSION_CONFLICT, 409, undefined, details),
  invalidTransition: (message?: string) =>
    new AppError(ERROR_CODES.INVALID_TRANSITION, 422, message),
  assigneeRequired: () => new AppError(ERROR_CODES.ASSIGNEE_REQUIRED, 422),
  reasonRequired: () => new AppError(ERROR_CODES.REASON_REQUIRED, 422),
  orderArchived: () => new AppError(ERROR_CODES.ORDER_ARCHIVED, 409),
  emailTaken: () => new AppError(ERROR_CODES.EMAIL_TAKEN, 409),
  passwordChangeRequired: () => new AppError(ERROR_CODES.PASSWORD_CHANGE_REQUIRED, 403),
  protectedOwner: (message?: string) => new AppError(ERROR_CODES.PROTECTED_OWNER, 403, message),
  cronLocked: () => new AppError(ERROR_CODES.CRON_LOCKED, 409),
  internal: (message?: string) => new AppError(ERROR_CODES.INTERNAL_ERROR, 500, message),
};
