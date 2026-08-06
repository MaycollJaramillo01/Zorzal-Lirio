import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contrasena.').max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contrasena actual.').max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Repite la nueva contrasena.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contrasenas no coinciden.',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'La nueva contrasena debe ser distinta de la actual.',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
