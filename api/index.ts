import { createApp, finalizeApp } from '../server/app.js';

/**
 * Punto de entrada de la funcion serverless de Vercel.
 * Vercel detecta la aplicacion Express exportada por defecto: no se necesita
 * ningun adaptador adicional.
 */
const app = finalizeApp(createApp());

export default app;
