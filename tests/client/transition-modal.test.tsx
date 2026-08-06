import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TransitionModal } from '@/features/kanban/TransitionModal';
import { makeOrder, renderWithProviders, stages, users } from './fixtures';

const fabricStage = stages.find((stage) => stage.code === 'FABRIC_PURCHASE')!;
const workshopStage = stages.find((stage) => stage.code === 'WORKSHOP')!;
const closedStage = stages.find((stage) => stage.code === 'CLOSED')!;

function renderModal(props: Partial<Parameters<typeof TransitionModal>[0]> = {}) {
  return renderWithProviders(
    <TransitionModal
      order={makeOrder()}
      targetStage={fabricStage}
      stages={stages}
      users={users}
      role="OWNER"
      onClose={() => undefined}
      onStageChange={() => undefined}
      {...props}
    />,
  );
}

describe('TransitionModal', () => {
  it('muestra el resumen del movimiento antes de confirmar', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Confirmar movimiento' })).toBeInTheDocument();
    expect(screen.getByText('ZL-2026-0001 · Colegio Santa Marta')).toBeInTheDocument();
    expect(screen.getAllByText('Orden recibida').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compra de tela').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Responsable de compras').length).toBeGreaterThan(0);
  });

  it('exige responsable cuando la etapa destino no es Cerrado', async () => {
    renderModal();

    await userEvent.selectOptions(screen.getByLabelText(/Nuevo responsable/), '');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debes seleccionar un responsable para la nueva etapa.',
    );
  });

  it('no exige responsable para la etapa Cerrado', () => {
    renderModal({ targetStage: closedStage });
    expect(screen.getByText('La etapa Cerrado no requiere responsable.')).toBeInTheDocument();
  });

  it('exige razon cuando el administrador salta etapas', async () => {
    renderModal({ role: 'ADMIN', targetStage: workshopStage });

    expect(screen.getByLabelText(/Razon del salto de etapa/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Debes escribir la razon');
  });

  it('no pide razon en un avance normal', () => {
    renderModal({ role: 'ADMIN', targetStage: fabricStage });
    expect(screen.queryByLabelText(/Razon/)).not.toBeInTheDocument();
  });

  it('limita las etapas destino disponibles para planta', () => {
    renderModal({ role: 'PLANT' });

    const select = screen.getByLabelText('Etapa destino') as HTMLSelectElement;
    const options = [...select.options].map((option) => option.textContent);
    expect(options).toEqual(['2. Compra de tela']);
  });

  it('cierra el dialogo al cancelar', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
