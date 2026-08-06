import { expect, test } from '@playwright/test';
import { USERS, createOrder, login, moveOrder, uniqueRef } from './helpers';

test.describe('Flujo administrador', () => {
  test('crea una orden, la mueve y registra el movimiento en el historial', async ({ page }) => {
    const reference = uniqueRef();
    const order = {
      purchaseOrderNumber: `OC-E2E-${reference}`,
      customerName: `Cliente E2E ${reference}`,
      projectName: 'Uniformes de prueba automatizada',
      quantity: 40,
      purchaseOrderDate: new Date().toISOString().slice(0, 10),
      assigneeName: 'Responsable de compras',
    };

    await login(page, USERS.owner);
    await createOrder(page, order);

    // 3. La orden aparece en la columna "Orden recibida".
    const received = page.getByRole('region', { name: 'Etapa Orden recibida' });
    await expect(received.getByText(order.customerName)).toBeVisible();

    const card = received.locator('article', { hasText: order.customerName }).first();
    const orderCode = (await card.locator('a').first().textContent())?.trim() ?? '';
    expect(orderCode).toMatch(/^ZL-\d{4}-\d{4}$/);

    // 4 y 5. Se mueve a "Compra de tela" asignando responsable.
    await moveOrder(page, orderCode, '2. Compra de tela', 'Responsable de compras', {
      note: 'Cotizacion enviada al proveedor',
    });

    const fabric = page.getByRole('region', { name: 'Etapa Compra de tela' });
    await expect(fabric.getByText(orderCode)).toBeVisible();

    // 6 y 7. El historial registra la entrada y la salida.
    await page.getByRole('link', { name: orderCode }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(orderCode);

    await page.getByRole('tab', { name: 'Historial' }).click();
    await expect(page.getByText('Orden recibida')).toBeVisible();
    await expect(page.getByText('Cotizacion enviada al proveedor')).toBeVisible();
    await expect(page.getByText('Etapa actual')).toBeVisible();
  });

  test('el cambio de etapa persiste despues de recargar la pagina', async ({ page }) => {
    const reference = uniqueRef();
    const customerName = `Cliente Persistencia ${reference}`;

    await login(page, USERS.admin);
    await createOrder(page, {
      purchaseOrderNumber: `OC-E2E-${reference}`,
      customerName,
      projectName: 'Prueba de persistencia',
      quantity: 12,
      purchaseOrderDate: new Date().toISOString().slice(0, 10),
      assigneeName: 'Responsable de compras',
    });

    const received = page.getByRole('region', { name: 'Etapa Orden recibida' });
    const card = received.locator('article', { hasText: customerName }).first();
    const orderCode = (await card.locator('a').first().textContent())?.trim() ?? '';

    await moveOrder(page, orderCode, '2. Compra de tela', 'Responsable de compras');

    await page.reload();
    const fabric = page.getByRole('region', { name: 'Etapa Compra de tela' });
    await expect(fabric.getByText(orderCode)).toBeVisible();
  });

  test('la pagina no genera scroll horizontal global', async ({ page }) => {
    await login(page, USERS.owner);
    await page.goto('/orders');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
