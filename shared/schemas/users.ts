import { z } from 'zod';
import { ROLES } from '../constants/enums.js';
import { emailSchema, passwordSchema, uuidSchema } from './common.js';

const nameSchema = z.string().trim().min(2, 'El nombre es muy corto.').max(120);

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.enum(ROLES),
  password: passwordSchema,
  stageIds: z.array(uuidSchema).max(20).default([]),
  mustChangePassword: z.boolean().default(true),
});

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    role: z.enum(ROLES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No hay cambios que guardar.',
  });

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
  mustChangePassword: z.boolean().default(true),
});

export const stageFocusSchema = z.object({
  stageIds: z.array(uuidSchema).max(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type StageFocusInput = z.infer<typeof stageFocusSchema>;
