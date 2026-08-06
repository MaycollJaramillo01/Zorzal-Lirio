import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { isManager } from '@shared/lib/permissions';
import { AssigneeChip, SlaBadge } from '../components/indicators';
import { Button, Card, EmptyState, ErrorState, PageHeader, Spinner, StatTile } from '../components/ui';
import { fmtDateTime, fmtDuration } from '../lib/format';
import { useDashboard, useSession } from '../services/queries';

export function DashboardPage() {
  const { data: session } = useSession();
  const query = useDashboard();

  if (!session) return null;
  if (query.isPending) return <Spinner label="Cargando indicadores" />;
  if (query.isError || !query.data) {
    return <ErrorState message="No se pudo cargar el dashboard." onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const manager = isManager(session.role);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={`Hola, ${session.name}`}
        description={
          manager
            ? 'Resumen operativo de la produccion de uniformes.'
            : 'Resumen de las ordenes bajo tu responsabilidad.'
        }
        actions={
          <>
            <Link to="/orders">
              <Button variant="secondary">Ir al tablero</Button>
            </Link>
            {manager ? (
              <Link to="/orders">
                <Button>Crear orden</Button>
              </Link>
            ) : null}
          </>
        }
      />

      {/* Grid bento: celdas de color solido (ink, dorado) marcan el ritmo entre las celdas blancas. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Ordenes activas"
          value={data.activeOrders}
          detail="En produccion ahora mismo"
          tone="ink"
          className="sm:col-span-2 lg:col-span-2"
        />
        <StatTile
          label="Proximas a vencer"
          value={data.warningOrders}
          tone={data.warningOrders > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Atrasadas"
          value={data.overdueOrders}
          tone={data.overdueOrders > 0 ? 'danger' : 'neutral'}
        />
        <StatTile label="Cerradas este mes" value={data.closedThisMonth} tone="success" />
        <StatTile
          label="Tiempo promedio total"
          value={data.averageLeadTimeMinutes === null ? '—' : fmtDuration(data.averageLeadTimeMinutes)}
          detail="Desde recepcion hasta cierre"
        />
        <StatTile
          label="Mayor acumulacion"
          value={data.busiestStage ? data.busiestStage.stage.name : '—'}
          detail={data.busiestStage ? `${data.busiestStage.orders} ordenes` : undefined}
          tone="gold"
          className="sm:col-span-2 lg:col-span-2"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Distribucion por etapa">
          {data.stageDistribution.every((item) => item.orders === 0) ? (
            <EmptyState title="Sin ordenes activas" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.stageDistribution.map((item) => ({
                    etapa: item.stage.name,
                    Ordenes: item.orders,
                    Atrasadas: item.overdue,
                  }))}
                  margin={{ top: 8, right: 8, bottom: 8, left: -18 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="etapa" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={54} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Ordenes" fill="var(--brand-500)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Atrasadas" fill="var(--danger)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Carga por responsable">
          {data.workload.length === 0 ? (
            <EmptyState title="Sin ordenes asignadas" />
          ) : (
            <div className="zl-scroll overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                    <th className="py-2 pr-3">Responsable</th>
                    <th className="py-2 pr-3">Activas</th>
                    <th className="py-2 pr-3">Por vencer</th>
                    <th className="py-2">Atrasadas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workload.map((row) => (
                    <tr key={row.user.id} className="border-b border-line/60">
                      <td className="py-2 pr-3">
                        <AssigneeChip user={row.user} />
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{row.activeOrders}</td>
                      <td className="py-2 pr-3 tabular-nums text-warning">{row.warningOrders}</td>
                      <td className="py-2 tabular-nums text-danger">{row.overdueOrders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Pedidos con mayor atraso">
          {data.topOverdue.length === 0 ? (
            <EmptyState title="No hay ordenes atrasadas" description="Todo el flujo esta dentro del tiempo permitido." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.topOverdue.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-line p-2">
                  <div className="min-w-0">
                    <Link to={`/orders/${order.id}`} className="text-sm font-semibold text-brand-900 hover:underline">
                      {order.orderCode}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {order.customerName} · {order.stage.name}
                    </p>
                  </div>
                  <SlaBadge sla={order.sla} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Actividad reciente">
          {data.recentActivity.length === 0 ? (
            <EmptyState title="Sin movimientos recientes" />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="rounded border border-line p-2 text-sm">
                  <Link to={`/orders/${item.orderId}`} className="font-semibold text-brand-900 hover:underline">
                    {item.orderCode}
                  </Link>{' '}
                  entro a <span className="font-medium">{item.stageName}</span>
                  <p className="text-xs text-muted">
                    {fmtDateTime(item.enteredAt)} · Responsable: {item.assigneeName ?? 'Sin asignar'} ·
                    Movido por: {item.movedByName ?? 'Sistema'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
