import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OrderSlaInfo } from '@shared/types/index';
import { PriorityBadge, SlaBadge } from '@/components/indicators';

function sla(overrides: Partial<OrderSlaInfo>): OrderSlaInfo {
  return {
    state: 'NORMAL',
    dueAt: '2026-08-10T12:00:00.000Z',
    warningAt: '2026-08-09T12:00:00.000Z',
    minutesInStage: 120,
    minutesRemaining: 2880,
    minutesOverdue: 0,
    ...overrides,
  };
}

describe('SlaBadge', () => {
  it('muestra texto ademas del color para el estado normal', () => {
    render(<SlaBadge sla={sla({})} />);
    // Texto visible + texto exclusivo para lectores de pantalla.
    expect(screen.getAllByText(/Restan/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estado de SLA: En tiempo/)).toBeInTheDocument();
  });

  it('anuncia las ordenes proximas a vencer', () => {
    render(<SlaBadge sla={sla({ state: 'WARNING', minutesRemaining: 720 })} />);
    expect(screen.getAllByText(/Vence en/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estado de SLA: Proximo a vencer/)).toBeInTheDocument();
  });

  it('indica cuanto tiempo lleva atrasada una orden', () => {
    render(
      <SlaBadge sla={sla({ state: 'OVERDUE', minutesRemaining: -2880, minutesOverdue: 2880 })} />,
    );
    expect(screen.getAllByText(/Atrasado por 2 d/).length).toBeGreaterThan(0);
  });

  it('muestra Sin SLA cuando la etapa no tiene tiempo configurado', () => {
    render(
      <SlaBadge
        sla={sla({ state: 'NO_SLA', dueAt: null, warningAt: null, minutesRemaining: null, minutesOverdue: null })}
      />,
    );
    expect(screen.getByText('Etapa sin tiempo configurado')).toBeInTheDocument();
  });
});

describe('PriorityBadge', () => {
  it('traduce las prioridades al espanol', () => {
    render(<PriorityBadge priority="URGENT" />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();
  });
});
