import 'dotenv/config';
import { closePool } from '../server/db/client.js';
import { env } from '../server/config/env.js';
import { runSlaCheck } from '../server/services/slaCheckService.js';

/**
 * Ejecucion manual de la revision de SLA.
 * Usa exactamente el mismo servicio que `GET /api/cron/sla`.
 */
async function main(): Promise<number> {
  if (!env.hasDatabase) {
    console.error('DATABASE_URL no esta configurado. Define la conexion de Neon en .env.');
    return 1;
  }

  const summary = await runSlaCheck({ trigger: 'manual' });

  console.log('');
  console.log('Revision de SLA - Zorzal Lirio OS');
  console.log('---------------------------------');
  console.log(`Ordenes revisadas.......: ${summary.checkedOrders}`);
  console.log(`Alertas warning creadas.: ${summary.warningsCreated}`);
  console.log(`Alertas overdue creadas.: ${summary.overdueCreated}`);
  console.log(`Correos enviados........: ${summary.emailsSent}`);
  console.log(`Alertas en consola......: ${summary.consoleAlerts}`);
  console.log(`Alertas fallidas........: ${summary.failedAlerts}`);
  if (summary.skipped) console.log(`Omitida.................: ${summary.reason}`);
  console.log('');

  return summary.failedAlerts > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await closePool();
    process.exit(code);
  })
  .catch(async (error: unknown) => {
    console.error('Fallo la revision de SLA:', error instanceof Error ? error.message : error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
