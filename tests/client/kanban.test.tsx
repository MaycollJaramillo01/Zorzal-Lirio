import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KanbanBoard } from '@/features/kanban/KanbanBoard';
import { FiltersBar } from '@/features/kanban/FiltersBar';
import { makeOrder, renderWithProviders, stages, users } from './fixtures';

describe('KanbanBoard', () => {
  it('dibuja una columna por etapa con su conteo', () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: 'order-2',
        orderCode: 'ZL-2026-0002',
        stage: { id: 'stage-2', code: 'FABRIC_PURCHASE', name: 'Compra de tela', position: 2 },
      }),
    ];

    renderWithProviders(
      <KanbanBoard stages={stages} orders={orders} canDrag onRequestMove={() => undefined} />,
    );

    const received = screen.getByRole('region', { name: 'Etapa Orden recibida' });
    expect(within(received).getByText('ZL-2026-0001')).toBeInTheDocument();
    expect(within(received).getByText('1 orden')).toBeInTheDocument();

    const fabric = screen.getByRole('region', { name: 'Etapa Compra de tela' });
    expect(within(fabric).getByText('ZL-2026-0002')).toBeInTheDocument();
  });

  it('avisa cuando una etapa no tiene ordenes', () => {
    renderWithProviders(
      <KanbanBoard stages={stages} orders={[]} canDrag onRequestMove={() => undefined} />,
    );
    expect(screen.getAllByText('Sin ordenes en esta etapa').length).toBeGreaterThan(0);
  });

  it('ofrece el boton Mover como alternativa al arrastre', async () => {
    const onRequestMove = vi.fn();
    renderWithProviders(
      <KanbanBoard stages={stages} orders={[makeOrder()]} canDrag onRequestMove={onRequestMove} />,
    );

    const received = screen.getByRole('region', { name: 'Etapa Orden recibida' });
    await userEvent.click(within(received).getByRole('button', { name: 'Mover' }));

    // Propone la etapa siguiente, no la actual.
    expect(onRequestMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }), 'stage-2');
  });

  it('oculta los controles de movimiento en modo solo lectura', () => {
    renderWithProviders(
      <KanbanBoard
        stages={stages}
        orders={[makeOrder()]}
        canDrag={false}
        onRequestMove={() => undefined}
      />,
    );

    const received = screen.getByRole('region', { name: 'Etapa Orden recibida' });
    expect(within(received).queryByRole('button', { name: 'Mover' })).not.toBeInTheDocument();
    expect(within(received).getByText('Solo lectura')).toBeInTheDocument();
  });

  it('muestra el indicador de SLA en la tarjeta', () => {
    renderWithProviders(
      <KanbanBoard
        stages={stages}
        orders={[
          makeOrder({
            sla: {
              state: 'OVERDUE',
              dueAt: '2026-08-02T12:00:00.000Z',
              warningAt: '2026-08-01T12:00:00.000Z',
              minutesInStage: 5000,
              minutesRemaining: -2880,
              minutesOverdue: 2880,
            },
          }),
        ]}
        canDrag
        onRequestMove={() => undefined}
      />,
    );

    const received = screen.getByRole('region', { name: 'Etapa Orden recibida' });
    expect(within(received).getByText('Atrasado por 2 d')).toBeInTheDocument();
  });
});

describe('FiltersBar', () => {
  const baseFilters = { includeClosed: true, includeArchived: false, onlyMine: false };

  it('propaga el filtro de responsable', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FiltersBar
        filters={baseFilters}
        stages={stages}
        users={users}
        activeCount={0}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Responsable'), 'me');
    expect(onChange).toHaveBeenCalledWith({ assignee: 'me' });
  });

  it('propaga el filtro de estado SLA', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FiltersBar
        filters={baseFilters}
        stages={stages}
        users={users}
        activeCount={0}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Estado SLA'), 'OVERDUE');
    expect(onChange).toHaveBeenCalledWith({ sla: 'OVERDUE' });
  });

  it('permite ocultar las ordenes cerradas', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FiltersBar
        filters={baseFilters}
        stages={stages}
        users={users}
        activeCount={0}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );

    await userEvent.click(screen.getByLabelText('Ocultar ordenes cerradas'));
    expect(onChange).toHaveBeenCalledWith({ includeClosed: 'false' });
  });
});
