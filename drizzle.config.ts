import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` no necesita conexion; `migrate`/`studio` si.
// Sin variables definidas usamos un destino inexistente para que `migrate` falle
// de inmediato en lugar de apuntar a una base de datos equivocada.
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  'postgresql://sin-configurar:sin-configurar@127.0.0.1:1/sin-configurar';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
