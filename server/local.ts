import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp, finalizeApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closePool } from './db/client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/server/local.js -> raiz del proyecto; server/local.ts -> raiz del proyecto
const projectRoot = path.resolve(here, here.includes(`${path.sep}dist${path.sep}`) ? '../..' : '..');
const clientDist = path.join(projectRoot, 'client', 'dist');

const app = createApp();

if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  // Fallback de SPA: cualquier ruta que no sea /api devuelve index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  logger.warn(
    { clientDist },
    'No se encontro el build del frontend. Ejecuta "npm run build:client" o usa "npm run dev".',
  );
}

finalizeApp(app);

const server = app.listen(env.PORT, () => {
  logger.info(`Zorzal Lirio OS escuchando en http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Cerrando servidor');
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
