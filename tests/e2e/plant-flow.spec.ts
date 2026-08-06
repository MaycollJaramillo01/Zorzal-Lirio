import { expect, test } from '@playwright/test';
import { USERS, createOrder, login, logout, moveOrder, uniqueRef } from './helpers';

test.describe('Flujo planta', () => {
  test('compras ve su orden, agrega una nota y la pasa a taller', async ({ page }) => {
    const reference = uniqueRef();
    const customerName = `Cliente Planta ${reference}`;

    // Preparacion: el dueno crea la orden asignada a compras.
    await login(page, USERS.owner);
    await createOrder(page, {
      purchaseOrderNumber: `OC-E2E-${reference}`,
      customerName,
      projectName: 'Pedido para planta',
      quantity: 18,
      purchaseOrderDate: new Date().toISOString().slice(0, 10),
      assigneeName: 'Responsable de compras',
    });

    const received = page.getByRole('region', { name: 'Etapa Orden recibida' });
    const card = received.locator('article', { hasText: customerName }).first();
    const orderCode = (await card.locator('a').first().textContent())?.trim() ?? '';

    await moveOrder(page, orderCode, '2. Compra de tela', 'Responsable de compras');
    await logout(page);

    // 1 y 2. Compras inicia sesion y ve la orden asignada.
    await login(page, USERS.compras);
    await page.getByRole('link', { name: 'Mis ordenes' }).click();
    await expect(page.getByText(orderCode)).toBeVisible();

    // 3. Agrega una nota desde el detalle.
    await page.getByRole('link', { name: orderCode }).first().click();
    await page.getByRole('tab', { name: 'Notas' }).click();
    await page.getByLabel('Nueva nota').fill('Tela comprada y en camino al taller');
    await page.getByRole('button', { name: 'Agregar nota' }).click();
    await expect(page.getByText('Tela comprada y en camino al taller')).toBeVisible();

    // 4 y 5. La mueve a "En taller" eligiendo al responsable de taller.
    await page.getByRole('link', { name: 'Mis ordenes' }).click();
    await moveOrder(page, orderCode, '3. En taller', 'Responsable de taller');

    // 6. Deja de aparecer en "Mis ordenes".
    await page.goto('/orders?assignee=me');
    await expect(page.getByText(orderCode)).toBeHidden();
  });

  test('planta no ve las secciones de administracion', async ({ page }) => {
    await login(page, USERS.compras);

    await expect(page.getByRole('link', { name: 'Equipo' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'SLA' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Reportes' })).toBeHidden();

    // El backend tambien protege la ruta: la navegacion directa redirige.
    await page.goto('/team');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('planta no puede saltar etapas desde el modal', async ({ page }) => {
    const reference = uniqueRef();
    const customerName = `Cliente Restriccion ${reference}`;

    await login(page, USERS.owner);
    await createOrder(page, {
      purchaseOrderNumber: `OC-E2E-${reference}`,
      customerName,
      projectName: 'Restricciones de planta',
      quantity: 5,
      purchaseOrderDate: new Date().toISOString().slice(0, 10),
      assigneeName: 'Responsable de compras',
    });

    const received = page.getByRole('region', { name: 'Etapa Orden recibida' });
    const card = received.locator('article', { hasText: customerName }).first();
    const orderCode = (await card.locator('a').first().textContent())?.trim() ?? '';
    await logout(page);

    await login(page, USERS.compras);
    await page.goto('/orders?assignee=me');

    const plantCard = page.locator('article', { hasText: orderCode }).first();
    await plantCard.getByRole('button', { name: 'Mover' }).click();

    const options = page.getByRole('dialog').getByLabel('Etapa destino').locator('option');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toHaveText('2. Compra de tela');
  });
});
