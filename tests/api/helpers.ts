import { describe } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

/**
 * Las pruebas de integracion necesitan una base de datos Neon real.
 * Sin `DATABASE_URL` se omiten en lugar de fallar.
 */
export const hasDatabase = Boolean(process.env.DATABASE_URL);
export const describeWithDb = hasDatabase ? describe : describe.skip;

export const SEED_USERS = {
  owner: { email: 'owner@zorzallirio.local', password: 'owner123' },
  admin: { email: 'admin@zorzallirio.local', password: 'ZL-Admin!HN_2026#K7v9@Q2x' },
  compras: { email: 'compras@zorzallirio.local', password: 'planta123' },
  taller: { email: 'taller@zorzallirio.local', password: 'planta123' },
  envio: { email: 'envio@zorzallirio.local', password: 'planta123' },
} as const;

export async function buildApp(): Promise<Express> {
  const { createApp, finalizeApp } = await import('../../server/app.js');
  return finalizeApp(createApp());
}

export type Agent = ReturnType<typeof request.agent>;

export async function loginAs(
  app: Express,
  credentials: { email: string; password: string },
): Promise<Agent> {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send(credentials);
  if (response.status !== 200) {
    throw new Error(
      `No se pudo iniciar sesion como ${credentials.email}: ${response.status} ${response.text}`,
    );
  }
  return agent;
}

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}
