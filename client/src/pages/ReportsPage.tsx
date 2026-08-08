import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PRIORITIES, PRIORITY_LABELS, SLA_STATES, SLA_STATE_LABELS } from '@shared/constants/enums';
import { REPORT_EXPORTS, REPORT_EXPORT_LABELS, type ReportFilters } from '@shared/schemas/reports';
import type { TeamMember, UserRef } from '@shared/types/index';
import { Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Select, Spinner, StatTile } from '../components/ui';
import { fmtDateTime, fmtDuration } from '../lib/format';
import {
  reportExportUrl,
  useOverdueReport,
  useStageTimesReport,
  useStages,
  useThroughputReport,
  useUsers,
  useWorkloadReport,
} from '../services/queries';

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const usersQuery = useUsers();
  const stagesQuery = useStages();

  const workload = useWorkloadReport(filters);
  const overdue = useOverdueReport(filters);
  const stageTimes = useStageTimesReport(filters);
  const throughput = useThroughputReport(filters);

  const users: UserRef[] = ((usersQuery.data ?? []) as Array<UserRef | TeamMember>).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }));

  const update = (patch: Partial<ReportFilters>) =>
    setFilters((current) => {
      const next = { ...current, ...patch };
      for (const key of Object.keys(next) as Array<keyof ReportFilters>) {
        if (!next[key]) delete next[key];
      }
      return next;
    });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Reportes"
        description="Datos reales de produccion. Las exportaciones respetan los filtros activos."
        actions={
          <div className="flex flex-wrap gap-2">
            {REPORT_EXPORTS.map((report) => (
              <a key={report} href={reportExportUrl(report, filters)} download>
                <Button variant="secondary" size="sm">
                  CSV: {REPORT_EXPORT_LABELS[report]}
                </Button>
              </a>
            ))}
          </div>
        }
      />

      <section
        aria-label="Filtros de reportes"
        className="grid gap-4 rounded-[1.5rem] border border-line bg-surface p-5 shadow-[var(--shadow-tile)] sm:grid-cols-2 xl:grid-cols-6"
      >
        <Field label="Desde" htmlFor="rep-desde">
          <Input id="rep-desde" type="date" value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value })} />
        </Field>
        <Field label="Hasta" htmlFor="rep-hasta">
          <Input id="rep-hasta" type="date" value={filters.to ?? ''} onChange={(e) => update({ to: e.target.value })} />
        </Field>
        <Field label="Cliente" htmlFor="rep-cliente">
          <Input
            id="rep-cliente"
            value={filters.customer ?? ''}
            onChange={(e) => update({ customer: e.target.value })}
          />
        </Field>
        <Field label="Responsable" htmlFor="rep-responsable">
          <Select
            id="rep-responsable"
            value={filters.assigneeId ?? ''}
            onChange={(e) => update({ assigneeId: e.target.value })}
          >
            <option value="">Todos</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Etapa" htmlFor="rep-etapa">
          <Select id="rep-etapa" value={filters.stageId ?? ''} onChange={(e) => update({ stageId: e.target.value })}>
            <option value="">Todas</option>
            {(stagesQuery.data ?? []).map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Prioridad" htmlFor="rep-prioridad">
            <Select
              id="rep-prioridad"
              value={filters.priority ?? ''}
              onChange={(e) => update({ priority: e.target.value as ReportFilters['priority'] })}
            >
              <option value="">Todas</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="SLA" htmlFor="rep-sla">
            <Select
              id="rep-sla"
              value={filters.sla ?? ''}
              onChange={(e) => update({ sla: e.target.value as ReportFilters['sla'] })}
            >
              <option value="">Todos</option>
              {SLA_STATES.map((state) => (
                <option key={state} value={state}>
                  {SLA_STATE_LABELS[state]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {throughput.isPending ? (
        <Spinner label="Cargando rendimiento" />
      ) : throughput.isError ? (
        <ErrorState message="No se pudo cargar el rendimiento general." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Ordenes abiertas" value={throughput.data.openOrders} />
            <StatTile label="Ordenes cerradas" value={throughput.data.closedOrders} tone="success" />
            <StatTile
              label="Ordenes atrasadas"
              value={throughput.data.overdueOrders}
              tone={throughput.data.overdueOrders > 0 ? 'danger' : 'neutral'}
            />
            <StatTile
              label="Tiempo promedio total"
              value={
                throughput.data.averageLeadTimeMinutes === null
                  ? '—'
                  : fmtDuration(throughput.data.averageLeadTimeMinutes)
              }
            />
            <StatTile
              label="Etapa mas lenta"
              value={throughput.data.slowestStage?.stage.name ?? '—'}
              detail={
                throughput.data.slowestStage
                  ? fmtDuration(throughput.data.slowestStage.averageMinutes)
                  : undefined
              }
            />
          </div>

          <Card title="Ordenes cerradas por mes">
            {throughput.data.closedByPeriod.length === 0 ? (
              <EmptyState title="Aun no hay ordenes cerradas" />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={throughput.data.closedByPeriod.map((row) => ({
                      periodo: row.period,
                      Cerradas: row.closedOrders,
                    }))}
                    margin={{ top: 8, right: 8, bottom: 8, left: -18 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Cerradas" stroke="var(--brand-700)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      )}

      <Card title="Carga por persona">
        {workload.isPending ? (
          <Spinner />
        ) : workload.isError ? (
          <ErrorState message="No se pudo cargar la carga por persona." />
        ) : workload.data.rows.length === 0 ? (
          <EmptyState title="Sin ordenes activas asignadas" />
        ) : (
          <div className="zl-scroll overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Activas</th>
                  <th className="py-2 pr-3">Por vencer</th>
                  <th className="py-2 pr-3">Atrasadas</th>
                  <th className="py-2">Distribucion por etapa</th>
                </tr>
              </thead>
              <tbody>
                {workload.data.rows.map((row) => (
                  <tr key={row.user.id} className="border-b border-line/60">
                    <td className="py-2 pr-3">{row.user.name}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.activeOrders}</td>
                    <td className="py-2 pr-3 tabular-nums text-warning">{row.warningOrders}</td>
                    <td className="py-2 pr-3 tabular-nums text-danger">{row.overdueOrders}</td>
                    <td className="py-2 text-xs text-muted">
                      {row.byStage.map((item) => `${item.stage.name}: ${item.orders}`).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Ordenes atrasadas">
        {overdue.isPending ? (
          <Spinner />
        ) : overdue.isError ? (
          <ErrorState message="No se pudo cargar el reporte de atrasos." />
        ) : overdue.data.rows.length === 0 ? (
          <EmptyState title="No hay ordenes atrasadas" />
        ) : (
          <div className="zl-scroll overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <th className="py-2 pr-3">Codigo</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Etapa</th>
                  <th className="py-2 pr-3">Responsable</th>
                  <th className="py-2 pr-3">Entrada</th>
                  <th className="py-2 pr-3">Limite</th>
                  <th className="py-2 pr-3">Atraso</th>
                  <th className="py-2">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {overdue.data.rows.map((row) => (
                  <tr key={row.orderId} className="border-b border-line/60">
                    <td className="py-2 pr-3">
                      <Link to={`/orders/${row.orderId}`} className="font-medium text-brand-900 hover:underline">
                        {row.orderCode}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{row.customerName}</td>
                    <td className="py-2 pr-3">{row.stage.name}</td>
                    <td className="py-2 pr-3">{row.assignee?.name ?? 'Sin asignar'}</td>
                    <td className="py-2 pr-3 text-xs text-muted">{fmtDateTime(row.enteredAt)}</td>
                    <td className="py-2 pr-3 text-xs text-muted">{fmtDateTime(row.dueAt)}</td>
                    <td className="py-2 pr-3 font-medium text-danger">{fmtDuration(row.minutesOverdue)}</td>
                    <td className="py-2">{PRIORITY_LABELS[row.priority]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Tiempos promedio por etapa">
        {stageTimes.isPending ? (
          <Spinner />
        ) : stageTimes.isError ? (
          <ErrorState message="No se pudieron cargar los tiempos por etapa." />
        ) : stageTimes.data.rows.length === 0 ? (
          <EmptyState title="Aun no hay tramos cerrados" description="Los tiempos se calculan al salir de cada etapa." />
        ) : (
          <>
            <div className="mb-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stageTimes.data.rows.map((row) => ({
                    etapa: row.stage.name,
                    Horas: row.averageMinutes ? Math.round((row.averageMinutes / 60) * 10) / 10 : 0,
                  }))}
                  margin={{ top: 8, right: 8, bottom: 8, left: -18 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="etapa" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={54} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Horas" fill="var(--gold-700)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="zl-scroll overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                    <th className="py-2 pr-3">Etapa</th>
                    <th className="py-2 pr-3">Completadas</th>
                    <th className="py-2 pr-3">Promedio</th>
                    <th className="py-2 pr-3">Mediana</th>
                    <th className="py-2 pr-3">Minimo</th>
                    <th className="py-2 pr-3">Maximo</th>
                    <th className="py-2 pr-3">Cumplio</th>
                    <th className="py-2">Incumplio</th>
                  </tr>
                </thead>
                <tbody>
                  {stageTimes.data.rows.map((row) => (
                    <tr key={row.stage.id} className="border-b border-line/60">
                      <td className="py-2 pr-3">{row.stage.name}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.completedOrders}</td>
                      <td className="py-2 pr-3">{row.averageMinutes === null ? '—' : fmtDuration(row.averageMinutes)}</td>
                      <td className="py-2 pr-3">{row.medianMinutes === null ? '—' : fmtDuration(row.medianMinutes)}</td>
                      <td className="py-2 pr-3">{row.minMinutes === null ? '—' : fmtDuration(row.minMinutes)}</td>
                      <td className="py-2 pr-3">{row.maxMinutes === null ? '—' : fmtDuration(row.maxMinutes)}</td>
                      <td className="py-2 pr-3 text-success">
                        {row.metSlaPercent === null ? '—' : `${row.metSlaPercent}%`}
                      </td>
                      <td className="py-2 text-danger">
                        {row.missedSlaPercent === null ? '—' : `${row.missedSlaPercent}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
