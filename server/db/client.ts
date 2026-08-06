import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import * as schema from './schema.js';

// El driver WebSocket de Neon habilita transacciones interactivas reales,
// necesarias para las transiciones de etapa.
neonConfig.webSocketConstructor = ws;

export type Database = NeonDatabase<typeof schema>;
export type TransactionClient = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbExecutor = Database | TransactionClient;

let pool: Pool | null = null;
let database: Database | null = null;

function requireDatabaseUrl(): string {
  if (!env.databaseUrl) {
    throw new Error(
      'DATABASE_URL no esta configurado. Copia .env.example a .env y define la cadena de conexion de Neon.',
    );
  }
  return env.databaseUrl;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: requireDatabaseUrl() });
    pool.on('error', (error: Error) => {
      logger.error({ err: error }, 'Error en el pool de PostgreSQL');
    });
  }
  return pool;
}

export function getDb(): Database {
  if (!database) {
    database = drizzle(getPool(), { schema, logger: false });
  }
  return database;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      await client.query('select 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error({ err: error }, 'No se pudo conectar a PostgreSQL');
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    database = null;
  }
}

export { schema };
