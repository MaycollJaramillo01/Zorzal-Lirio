process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET ??= 'clave-de-pruebas-zorzal-lirio-os-32-caracteres';
process.env.CRON_SECRET ??= 'cron-secreto-de-pruebas';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.EMAIL_ENABLED ??= 'false';
process.env.LOG_LEVEL ??= 'silent';
