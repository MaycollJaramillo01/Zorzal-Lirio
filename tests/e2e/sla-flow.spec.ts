import { expect, test } from '@playwright/test';
import { USERS, createOrder, daysAgo, login, uniqueRef } from './helpers';

const CRON_SECRET = process.env.CRON_SECRET ?? 'zorzal-lirio-dev-cron-secret';

test.describe('Flujo SLA', () => {
  test('una orden vencida genera alerta y la revision no la duplica', async ({ page, request }) => {
    const reference = uniqueRef();
    const customerName = `Cliente SLA ${reference}`;

    // 1. Orden con fecha de recepcion antigua: nace con la etapa vencida.
    await login(page, USERS.owner);
    await createOrder(page, {
      purchaseOrderNumber: `OC-SLA-${reference}`,
      customerName,
      projectName: 'Pedido con SLA vencido',
      quantity: 30,
      purchaseOrderDate: daysAgo(20),
      assigneeName: 'Responsable de compras',
    });

    const received = page.getByRole('region', { name: 'Etapa Orden recibida' });
    const card = received.locator('article', { hasText: customerName }).first();
    await expect(card.getByText(/Atrasado por/)).toBeVisible();

    // 2 y 3. La revision de SLA crea alertas.
    const first = await request.get('/api/cron/sla', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(first.ok()).toBeTruthy();
    const firstBody = await first.json();
    expect(firstBody.success).toBe(true);
    expect(firstBody.checkedOrders).toBeGreaterThan(0);
    expect(firstBody.warningsCreated + firstBody.overdueCreated).toBeGreaterThan(0);

    // 4 y 5. Al repetir, no se crea ninguna alerta nueva.
    const second = await request.get('/api/cron/sla', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const secondBody = await second.json();
    expect(secondBody.success).toBe(true);
    expect(secondBody.warningsCreated).toBe(0);
    expect(secondBody.overdueCreated).toBe(0);
  });

  test('el endpoint del cron rechaza solicitudes sin autorizacion', async ({ request }) => {
    expect((await request.get('/api/cron/sla')).status()).toBe(401);
    expect(
      (
        await request.get('/api/cron/sla', {
          headers: { Authorization: 'Bearer secreto-incorrecto' },
        })
      ).status(),
    ).toBe(401);
  });

  test('el SLA configurado se refleja en la seccion SLA', async ({ page }) => {
    await login(page, USERS.owner);
    await page.goto('/sla');

    await expect(page.getByRole('heading', { name: 'SLA por etapa' })).toBeVisible();
    await expect(page.getByLabel('Tiempo permitido en dias para Compra de tela')).toHaveValue('5');
    await expect(page.getByLabel('Dias de advertencia para Compra de tela')).toHaveValue('1');
  });
});
