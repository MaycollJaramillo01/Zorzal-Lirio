import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, ErrorState, Field, Input, PageHeader, Spinner, StatTile } from '../components/ui';
import { cn, fmtDate, fmtHnl, todayCalendarDate } from '../lib/format';
import { useFinancialReport } from '../services/queries';

const currentMonth = () => todayCalendarDate().slice(0, 7);

function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat('es-HN', { month: 'long', year: 'numeric' }).format(
    new Date(`${month}-15T12:00:00.000Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function BalancePage() {
  const [month, setMonth] = useState(currentMonth);
  const query = useFinancialReport(month);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title="Balance mensual"
        description="Ingresos cobrados, costos de producción y ganancia real de la empresa en lempiras."
      />

      <Card title="Periodo del balance">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Field label="Mes" htmlFor="balance-month" hint="La fecha efectiva de cobro define el mes.">
            <Input
              id="balance-month"
              type="month"
              value={month}
              max={currentMonth()}
              onChange={(event) => setMonth(event.target.value || currentMonth())}
              className="w-56"
            />
          </Field>
          <div className="rounded-2xl border border-gold-500/35 bg-gold-500/15 px-4 py-3 text-right">
            <p className="text-[10px] font-bold tracking-[0.12em] text-brand-700 uppercase">Moneda oficial</p>
            <p className="mt-1 text-sm font-semibold text-ink">Lempira hondureño · HNL</p>
          </div>
        </div>
      </Card>

      {query.isPending ? <Spinner label="Calculando balance" /> : null}
      {query.isError ? (
        <ErrorState message="No se pudo calcular el balance del mes." onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? <BalanceContent report={query.data} /> : null}
    </div>
  );
}

function BalanceContent({ report }: { report: NonNullable<ReturnType<typeof useFinancialReport>['data']> }) {
  const { summary } = report;
  const profitTone = summary.netProfitCents < 0 ? 'danger' : 'success';

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="INGRESOS COBRADOS"
          value={fmtHnl(summary.grossRevenueCents)}
          detail={`${summary.paidOrders} ${summary.paidOrders === 1 ? 'orden cobrada' : 'órdenes cobradas'}`}
          tone="ink"
        />
        <StatTile
          label="COSTOS DE PRODUCCIÓN"
          value={fmtHnl(summary.productionCostsCents)}
          detail={`Costos asociados a ${monthLabel(report.month)}`}
        />
        <StatTile
          label="GANANCIA NETA"
          value={fmtHnl(summary.netProfitCents)}
          detail="Ingresos menos costos"
          tone={profitTone}
        />
        <StatTile
          label="MARGEN"
          value={summary.marginPercent === null ? '—' : `${summary.marginPercent}%`}
          detail="Porcentaje de utilidad sobre ventas"
          tone="gold"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]">
        <Card title={`Cobros de ${monthLabel(report.month)}`}>
          {report.rows.length === 0 ? (
            <EmptyState
              title="Aún no hay cobros registrados"
              description="Confirma el pago desde el detalle de una orden y aparecerá automáticamente en este balance."
            />
          ) : (
            <div className="zl-scroll overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] tracking-[0.08em] text-muted uppercase">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Orden</th>
                    <th className="py-3 pr-4">Cliente</th>
                    <th className="py-3 pr-4 text-right">Venta</th>
                    <th className="py-3 pr-4 text-right">Costo</th>
                    <th className="py-3 text-right">Utilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.orderId} className="border-b border-line/60 last:border-0">
                      <td className="py-3 pr-4 text-xs text-muted">{fmtDate(row.paidAt)}</td>
                      <td className="py-3 pr-4">
                        <Link to={`/orders/${row.orderId}`} className="font-semibold text-brand-700 hover:underline">
                          {row.orderCode}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-ink">{row.customerName}</p>
                        <p className="mt-0.5 text-xs text-muted">{row.projectName}</p>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{fmtHnl(row.saleAmountCents)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted">{fmtHnl(row.productionCostCents)}</td>
                      <td className={cn('py-3 text-right font-semibold tabular-nums', row.profitCents < 0 ? 'text-danger' : 'text-success')}>
                        {fmtHnl(row.profitCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Cuentas por cobrar" className="xl:self-start">
          <p className="font-display text-4xl font-semibold tracking-[-0.05em] text-ink tabular-nums">
            {fmtHnl(summary.pendingReceivablesCents)}
          </p>
          <p className="mt-2 text-sm text-muted">
            {summary.pendingOrders} {summary.pendingOrders === 1 ? 'orden tiene' : 'órdenes tienen'} monto registrado y pago pendiente.
          </p>
          <div className="mt-5 rounded-2xl border border-line bg-surface-muted p-4 text-xs leading-relaxed text-muted">
            Las cuentas pendientes no se consideran ingreso ni ganancia hasta registrar la fecha de cobro.
          </div>
        </Card>
      </div>
    </>
  );
}
