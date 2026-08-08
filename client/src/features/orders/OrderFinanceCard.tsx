import { useEffect, useState } from 'react';
import type { OrderDetail } from '@shared/types/index';
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { calendarDateValue, cn, fmtDate, fmtHnl, todayCalendarDate } from '../../lib/format';
import { useOrderMutations } from '../../services/queries';

function inputAmount(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : '';
}

function amountToCents(value: string): number | null {
  if (!value.trim()) return 0;
  const amount = Number(value.replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function OrderFinanceCard({ order }: { order: OrderDetail }) {
  const finance = order.finance;
  const [open, setOpen] = useState(false);

  if (!finance) return null;

  const paid = finance.status === 'PAID';
  const hasAmounts = finance.saleAmountCents > 0 || finance.productionCostCents > 0;
  const inCollection = order.stage.code === 'COLLECTION';

  return (
    <>
      <Card
        title="Cobro y rentabilidad"
        actions={
          <Button onClick={() => setOpen(true)}>
            {paid ? 'Editar cobro' : hasAmounts ? 'Confirmar cobro' : 'Registrar cobro'}
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceMetric label="Venta" value={fmtHnl(finance.saleAmountCents)} />
          <FinanceMetric label="Costo de producción" value={fmtHnl(finance.productionCostCents)} />
          <FinanceMetric
            label="Utilidad"
            value={fmtHnl(finance.profitCents)}
            tone={finance.profitCents < 0 ? 'danger' : 'success'}
          />
          <div
            className={cn(
              'rounded-2xl border p-4',
              paid
                ? 'border-success/30 bg-success-soft'
                : 'border-warning/30 bg-warning-soft',
            )}
          >
            <p className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
            <p className={cn('mt-2 text-lg font-semibold', paid ? 'text-success' : 'text-warning')}>
              {paid ? 'Cobrado' : 'Pendiente'}
            </p>
            <p className="mt-1 text-xs text-muted">
              {paid && finance.paidAt ? fmtDate(finance.paidAt) : 'Sin fecha de cobro'}
            </p>
          </div>
        </div>

        {inCollection && !paid ? (
          <p className="mt-4 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-ink">
            Esta orden está en Cobro. Registra la venta, el costo y la fecha de pago para que
            aparezca en el balance mensual.
          </p>
        ) : null}
      </Card>

      <FinanceModal order={order} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function FinanceMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-muted p-4">
      <p className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{label}</p>
      <p
        className={cn(
          'mt-2 font-display text-2xl font-semibold tracking-[-0.04em] tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
          tone === 'neutral' && 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FinanceModal({
  order,
  open,
  onClose,
}: {
  order: OrderDetail;
  open: boolean;
  onClose: () => void;
}) {
  const finance = order.finance;
  const { updateFinance } = useOrderMutations();
  const { notify } = useToast();
  const [saleAmount, setSaleAmount] = useState('');
  const [productionCost, setProductionCost] = useState('');
  const [paid, setPaid] = useState(false);
  const [paidAt, setPaidAt] = useState(todayCalendarDate());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !finance) return;
    setSaleAmount(inputAmount(finance.saleAmountCents));
    setProductionCost(inputAmount(finance.productionCostCents));
    setPaid(finance.status === 'PAID');
    setPaidAt(finance.paidAt ? calendarDateValue(finance.paidAt) : todayCalendarDate());
    setError(null);
  }, [finance, open]);

  if (!finance) return null;

  const saleCents = amountToCents(saleAmount);
  const costCents = amountToCents(productionCost);
  const projectedProfit = (saleCents ?? 0) - (costCents ?? 0);

  const submit = async () => {
    setError(null);
    if (saleCents === null || saleCents <= 0) {
      setError('Ingresa un monto de venta válido mayor que cero.');
      return;
    }
    if (costCents === null) {
      setError('Ingresa un costo de producción válido.');
      return;
    }
    if (paid && !paidAt) {
      setError('Selecciona la fecha en que se recibió el pago.');
      return;
    }

    try {
      await updateFinance.mutateAsync({
        id: order.id,
        version: order.version,
        saleAmountCents: saleCents,
        productionCostCents: costCents,
        paidAt: paid ? paidAt : null,
      });
      notify(paid ? 'Cobro registrado en el balance mensual.' : 'Montos guardados como pendientes.');
      onClose();
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : 'No se pudo guardar la información de cobro.';
      setError(message);
      notify(message, 'error');
    }
  };

  return (
    <Modal
      open={open}
      title="Registrar cobro"
      description={`${order.orderCode} · Valores en lempiras hondureños (HNL)`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={updateFinance.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={updateFinance.isPending}>
            {updateFinance.isPending ? 'Guardando...' : 'Guardar cobro'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="rounded-xl border border-danger/35 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto de venta (L)" htmlFor="finance-sale" required>
            <Input
              id="finance-sale"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={saleAmount}
              onChange={(event) => setSaleAmount(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Costo de producción (L)" htmlFor="finance-cost" required>
            <Input
              id="finance-cost"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={productionCost}
              onChange={(event) => setProductionCost(event.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-line bg-surface-muted p-4">
          <p className="text-xs font-semibold text-muted">Utilidad de la orden</p>
          <p className={cn('mt-1 text-2xl font-semibold tabular-nums', projectedProfit < 0 ? 'text-danger' : 'text-success')}>
            {fmtHnl(projectedProfit)}
          </p>
        </div>

        <Checkbox
          label="El pago ya fue recibido"
          checked={paid}
          onChange={(event) => setPaid(event.target.checked)}
        />

        {paid ? (
          <Field label="Fecha de cobro" htmlFor="finance-paid-at" required>
            <Input
              id="finance-paid-at"
              type="date"
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </Field>
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            Guardaremos los montos como cuenta por cobrar. No sumarán a las ganancias hasta
            confirmar el pago.
          </p>
        )}
      </div>
    </Modal>
  );
}
