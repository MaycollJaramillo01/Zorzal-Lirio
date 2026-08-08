import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { isManager } from '@shared/lib/permissions';
import { AssigneeChip, SlaBadge } from '../components/indicators';
import { BentoTile, Button, Card, EmptyState, ErrorState, Icon, Spinner, StatTile } from '../components/ui';
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
    <div className="flex min-w-0 flex-col gap-8">
      <section aria-labelledby="dashboard-title" className="bento-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <BentoTile tone="ink" className="zl-grid-pattern relative min-h-80 p-6 sm:col-span-2 sm:p-8 xl:col-span-6 xl:row-span-2">
          <span aria-hidden="true" className="absolute -right-20 -bottom-32 size-80 rounded-full border border-white/10" />
          <span aria-hidden="true" className="absolute -right-8 -bottom-20 size-56 rounded-full border border-gold-500/35" />

          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-gold-500 uppercase">
                <Icon name="spark" className="size-3.5" />
                Panorama de hoy
              </div>
              <h1 id="dashboard-title" className="mt-4 max-w-xl text-4xl leading-[0.98] font-semibold tracking-[-0.055em] text-white sm:text-5xl">
                Hola, {session.name}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/62">
                {manager
                  ? 'Una lectura clara del ritmo de producción, los riesgos y la carga del equipo.'
                  : 'Tus órdenes, prioridades y próximos movimientos en una sola vista.'}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link to="/orders">
                  <Button variant="secondary">
                    Abrir tablero
                    <Icon name="arrow" />
                  </Button>
                </Link>
                {manager ? (
                  <Link to="/orders">
                    <Button className="border-gold-500 bg-gold-500 text-brand-900 hover:bg-gold-500/85">
                      Nueva orden
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid gap-5 border-t border-white/12 pt-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-white/50">Órdenes activas</p>
                <p className="mt-1 font-display text-5xl leading-none font-semibold tracking-[-0.055em] text-white tabular-nums">
                  {data.activeOrders}
                </p>
              </div>
              <div className="sm:border-l sm:border-white/12 sm:pl-5">
                <p className="text-xs font-semibold text-white/50">Mayor acumulación</p>
                <p className="mt-1 truncate font-display text-xl font-semibold text-white">
                  {data.busiestStage ? data.busiestStage.stage.name : 'Sin datos'}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {data.busiestStage ? `${data.busiestStage.orders} órdenes en esta etapa` : 'No hay órdenes activas'}
                </p>
              </div>
            </div>
          </div>
        </BentoTile>

        <StatTile
          label="Próximas a vencer"
          value={data.warningOrders}
          detail="Requieren atención preventiva"
          tone={data.warningOrders > 0 ? 'warning' : 'neutral'}
          className="xl:col-span-3"
        />
        <StatTile
          label="Atrasadas"
          value={data.overdueOrders}
          detail="Fuera del tiempo acordado"
          tone={data.overdueOrders > 0 ? 'danger' : 'neutral'}
          className="xl:col-span-3"
        />
        <StatTile
          label="Cerradas este mes"
          value={data.closedThisMonth}
          detail="Órdenes terminadas"
          tone="success"
          className="xl:col-span-3"
        />
        <StatTile
          label="Tiempo promedio total"
          value={data.averageLeadTimeMinutes === null ? '—' : fmtDuration(data.averageLeadTimeMinutes)}
          detail="Desde recepción hasta cierre"
          className="xl:col-span-3"
        />
      </section>

      <section aria-labelledby="operacion-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.14em] text-brand-700 uppercase">Pulso operativo</p>
            <h2 id="operacion-title" className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">Dónde se concentra el trabajo</h2>
          </div>
          <p className="max-w-md text-sm text-muted">Distribución actual y carga de cada responsable.</p>
        </div>

        <div className="bento-grid grid gap-4 xl:grid-cols-12">
          <Card title="Distribución por etapa" className="xl:col-span-7">
            {data.stageDistribution.every((item) => item.orders === 0) ? (
              <EmptyState title="Sin órdenes activas" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.stageDistribution.map((item) => ({
                      etapa: item.stage.name,
                      Órdenes: item.orders,
                      Atrasadas: item.overdue,
                    }))}
                    margin={{ top: 12, right: 8, bottom: 8, left: -18 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="etapa" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={0} angle={-15} textAnchor="end" height={58} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <Tooltip cursor={{ fill: 'var(--gold-soft)', opacity: 0.45 }} />
                    <Bar dataKey="Órdenes" fill="var(--brand-700)" radius={[6, 6, 2, 2]} />
                    <Bar dataKey="Atrasadas" fill="var(--danger)" radius={[6, 6, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Carga por responsable" className="xl:col-span-5">
            {data.workload.length === 0 ? (
              <EmptyState title="Sin órdenes asignadas" />
            ) : (
              <div className="zl-scroll overflow-x-auto">
                <table className="w-full min-w-[28rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[10px] tracking-[0.1em] text-muted uppercase">
                      <th className="py-3 pr-3 font-semibold">Responsable</th>
                      <th className="py-3 pr-3 font-semibold">Activas</th>
                      <th className="py-3 pr-3 font-semibold">Por vencer</th>
                      <th className="py-3 font-semibold">Atrasadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workload.map((row) => (
                      <tr key={row.user.id} className="border-b border-line/65 last:border-0">
                        <td className="py-3 pr-3"><AssigneeChip user={row.user} /></td>
                        <td className="py-3 pr-3 font-semibold tabular-nums">{row.activeOrders}</td>
                        <td className="py-3 pr-3 font-semibold text-warning tabular-nums">{row.warningOrders}</td>
                        <td className="py-3 font-semibold text-danger tabular-nums">{row.overdueOrders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>

      <section aria-label="Riesgos y actividad" className="bento-grid grid gap-4 xl:grid-cols-2">
        <Card title="Pedidos con mayor atraso">
          {data.topOverdue.length === 0 ? (
            <EmptyState title="No hay órdenes atrasadas" description="Todo el flujo está dentro del tiempo permitido." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.topOverdue.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/75 p-3">
                  <div className="min-w-0">
                    <Link to={`/orders/${order.id}`} className="font-display text-sm font-semibold text-brand-900 hover:text-brand-700">
                      {order.orderCode}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">{order.customerName} · {order.stage.name}</p>
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
            <ul className="flex flex-col">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="relative border-l border-line py-2.5 pl-5 text-sm first:pt-0 last:pb-0">
                  <span aria-hidden="true" className="absolute top-4 -left-1.5 size-3 rounded-full border-[3px] border-surface bg-gold-500 first:top-1.5" />
                  <Link to={`/orders/${item.orderId}`} className="font-display font-semibold text-brand-900 hover:text-brand-700">
                    {item.orderCode}
                  </Link>{' '}
                  entró a <span className="font-semibold">{item.stageName}</span>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {fmtDateTime(item.enteredAt)} · Responsable: {item.assigneeName ?? 'Sin asignar'} · Movido por: {item.movedByName ?? 'Sistema'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
