import 'dotenv/config';
import { z } from 'zod';

const envBool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') return fallback;
      return value === 'true' || value === '1';
    });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

    DATABASE_URL: z.string().trim().min(1).optional(),
    DATABASE_URL_UNPOOLED: z.string().trim().min(1).optional(),

    APP_URL: z.string().trim().url().default('http://localhost:3000'),
    APP_TIMEZONE: z.string().trim().min(1).default('America/Managua'),

    SESSION_SECRET: z.string().trim().min(1).optional(),
    CRON_SECRET: z.string().trim().min(1).optional(),

    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: envBool(false),
    SMTP_USER: z.string().trim().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().trim().default('Zorzal Lirio OS <notificaciones@example.com>'),

    EMAIL_ENABLED: envBool(false),
    SEED_DEFAULT_USERS: envBool(true),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    const required: Array<[string, unknown]> = [
      ['DATABASE_URL', value.DATABASE_URL],
      ['SESSION_SECRET', value.SESSION_SECRET],
      ['CRON_SECRET', value.CRON_SECRET],
      ['APP_URL', value.APP_URL],
    ];

    for (const [name, provided] of required) {
      if (!provided) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [name],
          message: `${name} es obligatorio en produccion.`,
        });
      }
    }

    if (value.SESSION_SECRET && value.SESSION_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET debe tener al menos 32 caracteres en produccion.',
      });
    }

    if (value.CRON_SECRET && value.CRON_SECRET.length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CRON_SECRET'],
        message: 'CRON_SECRET debe tener al menos 16 caracteres en produccion.',
      });
    }

    if (value.EMAIL_ENABLED && !value.SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST es obligatorio cuando EMAIL_ENABLED=true.',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables de entorno invalidas:\n${details}`);
}

const value = parsed.data;

const DEV_SESSION_SECRET = 'zorzal-lirio-dev-session-secret-no-usar-en-produccion';
const DEV_CRON_SECRET = 'zorzal-lirio-dev-cron-secret';

export const env = {
  ...value,
  sessionSecret: value.SESSION_SECRET ?? DEV_SESSION_SECRET,
  cronSecret: value.CRON_SECRET ?? DEV_CRON_SECRET,
  isProduction: value.NODE_ENV === 'production',
  isTest: value.NODE_ENV === 'test',
  databaseUrl: value.DATABASE_URL ?? '',
  migrationDatabaseUrl: value.DATABASE_URL_UNPOOLED ?? value.DATABASE_URL ?? '',
  hasDatabase: Boolean(value.DATABASE_URL),
  smtpEnabled: value.EMAIL_ENABLED && Boolean(value.SMTP_HOST),
} as const;

export type Env = typeof env;
