import { expect, type Page } from '@playwright/test';

export const USERS = {
  owner: { email: 'owner@zorzallirio.local', password: 'owner123' },
  admin: { email: 'admin@zorzallirio.local', password: 'admin123' },
  compras: { email: 'compras@zorzallirio.local', password: 'planta123' },
  taller: { email: 'taller@zorzallirio.local', password: 'planta123' },
} as const;

export function uniqueRef(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(user.email);
  await page.getByLabel('Contrasena').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cerrar sesion' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export interface NewOrder {
  purchaseOrderNumber: string;
  customerName: string;
  projectName: string;
  quantity: number;
  purchaseOrderDate: string;
  assigneeName: string;
}

export async function createOrder(page: Page, order: NewOrder): Promise<void> {
  await page.goto('/orders');
  await page.getByRole('button', { name: 'Nueva orden' }).click();

  await page.getByLabel('Numero de orden de compra').fill(order.purchaseOrderNumber);
  await page.getByLabel('Cliente').fill(order.customerName);
  await page.getByLabel('Proyecto').fill(order.projectName);
  await page.getByLabel('Cantidad').fill(String(order.quantity));
  await page.getByLabel('Fecha de recepcion de la OC').fill(order.purchaseOrderDate);
  await page.getByLabel('Responsable inicial').selectOption({ label: order.assigneeName });

  await page.getByRole('button', { name: 'Crear orden' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Mueve una orden abriendo el modal desde su tarjeta. */
export async function moveOrder(
  page: Page,
  orderCode: string,
  targetStageLabel: string,
  assigneeName: string,
  options: { note?: string; reason?: string } = {},
): Promise<void> {
  const card = page.locator('article', { hasText: orderCode }).first();
  await card.getByRole('button', { name: 'Mover' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Confirmar movimiento' })).toBeVisible();

  await dialog.getByLabel('Etapa destino').selectOption({ label: targetStageLabel });
  await dialog.getByLabel(/Nuevo responsable/).selectOption({ label: assigneeName });
  if (options.note) await dialog.getByLabel('Nota (opcional)').fill(options.note);
  if (options.reason) await dialog.getByLabel(/Razon/).fill(options.reason);

  await dialog.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await expect(dialog).toBeHidden();
}
