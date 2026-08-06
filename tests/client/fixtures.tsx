import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import type { OrderCard, StageDto, UserRef } from '@shared/types/index';
import { ToastProvider } from '@/components/ui';

export const stages: StageDto[] = [
  { id: 'stage-1', code: 'ORDER_RECEIVED', name: 'Orden recibida', position: 1, slaMinutes: 1440, warningBeforeMinutes: 1440, isSlaEnabled: true, isActive: true },
  { id: 'stage-2', code: 'FABRIC_PURCHASE', name: 'Compra de tela', position: 2, slaMinutes: 7200, warningBeforeMinutes: 1440, isSlaEnabled: true, isActive: true },
  { id: 'stage-3', code: 'WORKSHOP', name: 'En taller', position: 3, slaMinutes: 14400, warningBeforeMinutes: 1440, isSlaEnabled: true, isActive: true },
  { id: 'stage-7', code: 'CLOSED', name: 'Cerrado', position: 7, slaMinutes: null, warningBeforeMinutes: null, isSlaEnabled: false, isActive: true },
];

export const users: UserRef[] = [
  { id: 'user-1', name: 'Responsable de compras', email: 'compras@zorzallirio.local', role: 'PLANT' },
  { id: 'user-2', name: 'Responsable de taller', email: 'taller@zorzallirio.local', role: 'PLANT' },
];

export function makeOrder(overrides: Partial<OrderCard> = {}): OrderCard {
  return {
    id: 'order-1',
    orderCode: 'ZL-2026-0001',
    purchaseOrderNumber: 'OC-2026-1180',
    customerName: 'Colegio Santa Marta',
    projectName: 'Uniformes escolares',
    quantity: 320,
    priority: 'HIGH',
    purchaseOrderDate: '2026-08-01',
    expectedDeliveryDate: null,
    stage: { id: 'stage-1', code: 'ORDER_RECEIVED', name: 'Orden recibida', position: 1 },
    assignee: users[0]!,
    stageEnteredAt: '2026-08-01T12:00:00.000Z',
    sla: {
      state: 'NORMAL',
      dueAt: '2026-08-02T12:00:00.000Z',
      warningAt: '2026-08-01T12:00:00.000Z',
      minutesInStage: 60,
      minutesRemaining: 1380,
      minutesOverdue: 0,
    },
    version: 1,
    isArchived: false,
    closedAt: null,
    ...overrides,
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: Providers });
}
