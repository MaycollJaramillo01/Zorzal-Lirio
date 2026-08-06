import type { Role } from '../../shared/constants/enums.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  isPrimaryOwner: boolean;
  lastLoginAt: Date | null;
  stageFocusIds: string[];
}

export interface AuthContext {
  user: AuthUser;
  sessionId: string;
}
