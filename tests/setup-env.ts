// Carga .env antes que nada: sin DATABASE_URL las pruebas de integracion se
// omitian en silencio y la suite reportaba verde sin haber probado la API.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET ??= 'clave-de-pruebas-zorzal-lirio-os-32-caracteres';
process.env.CRON_SECRET ??= 'cron-secreto-de-pruebas';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.EMAIL_ENABLED ??= 'false';
// Nunca permitir envios reales desde la suite aunque el .env local los habilite.
process.env.GHL_WHATSAPP_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';
