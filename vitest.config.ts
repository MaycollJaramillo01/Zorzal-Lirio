import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const sharedRoot = fileURLToPath(new URL('./shared', import.meta.url));
const clientSrc = fileURLToPath(new URL('./client/src', import.meta.url));

export default defineConfig({
  test: {
    // Las pruebas de integracion comparten una sola base de datos Neon: en
    // paralelo se pisan el consecutivo de ordenes y las alertas del cron.
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'],
          setupFiles: ['tests/setup-env.ts'],
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: { '@shared': sharedRoot, '@': clientSrc },
        },
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['tests/client/**/*.test.tsx'],
          setupFiles: ['tests/client/setup.ts'],
        },
      },
    ],
  },
});
