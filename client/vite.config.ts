import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const clientRoot = fileURLToPath(new URL('.', import.meta.url));
const sharedRoot = fileURLToPath(new URL('../shared', import.meta.url));
const distRoot = fileURLToPath(new URL('./dist', import.meta.url));

export default defineConfig({
  root: clientRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': sharedRoot,
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: distRoot,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separa las librerias grandes para que el cache del navegador aguante
        // entre despliegues.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
