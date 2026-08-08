import { PRIORITIES, PRIORITY_LABELS, SLA_STATES, SLA_STATE_LABELS } from '@shared/constants/enums';
import type { StageDto, UserRef } from '@shared/types/index';
import { Button, Checkbox, Field, Input, Select } from '../../components/ui';
import type { FilterPatch } from './useOrderFilters';
import type { OrderFilters } from '@shared/schemas/orders';

export interface FiltersBarProps {
  filters: OrderFilters;
  stages: StageDto[];
  users: UserRef[];
  activeCount: number;
  onChange: (patch: FilterPatch) => void;
  onReset: () => void;
}

export function FiltersBar({ filters, stages, users, activeCount, onChange, onReset }: FiltersBarProps) {
  return (
    <section
      aria-label="Filtros del tablero"
      className="grid gap-4 rounded-[1.5rem] border border-line bg-surface p-5 shadow-[var(--shadow-tile)] sm:grid-cols-2 xl:grid-cols-4"
    >
      <Field label="Buscar" htmlFor="filtro-busqueda" hint="Codigo, orden de compra, cliente o proyecto">
        <Input
          id="filtro-busqueda"
          type="search"
          placeholder="ZL-2026-0001, OC-1180, Colegio..."
          defaultValue={filters.search ?? ''}
          onChange={(event) => onChange({ search: event.target.value.trim() })}
        />
      </Field>

      <Field label="Responsable" htmlFor="filtro-responsable">
        <Select
          id="filtro-responsable"
          value={filters.assignee ?? ''}
          onChange={(event) => onChange({ assignee: event.target.value })}
        >
          <option value="">Todos</option>
          <option value="me">Solo mis ordenes</option>
          <option value="unassigned">Sin asignar</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Prioridad" htmlFor="filtro-prioridad">
        <Select
          id="filtro-prioridad"
          value={filters.priority ?? ''}
          onChange={(event) => onChange({ priority: event.target.value })}
        >
          <option value="">Todas</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Estado SLA" htmlFor="filtro-sla">
        <Select
          id="filtro-sla"
          value={filters.sla ?? ''}
          onChange={(event) => onChange({ sla: event.target.value })}
        >
          <option value="">Todos</option>
          {SLA_STATES.map((state) => (
            <option key={state} value={state}>
              {SLA_STATE_LABELS[state]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Etapa" htmlFor="filtro-etapa">
        <Select
          id="filtro-etapa"
          value={filters.stageId ?? ''}
          onChange={(event) => onChange({ stageId: event.target.value })}
        >
          <option value="">Todas</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="OC desde" htmlFor="filtro-desde">
        <Input
          id="filtro-desde"
          type="date"
          value={filters.from ?? ''}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </Field>

      <Field label="OC hasta" htmlFor="filtro-hasta">
        <Input
          id="filtro-hasta"
          type="date"
          value={filters.to ?? ''}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </Field>

      <div className="flex flex-col justify-end gap-2">
        <Checkbox
          label="Ocultar ordenes cerradas"
          checked={filters.includeClosed === false}
          onChange={(event) => onChange({ includeClosed: event.target.checked ? 'false' : undefined })}
        />
        <Checkbox
          label="Mostrar archivadas"
          checked={filters.includeArchived === true}
          onChange={(event) => onChange({ includeArchived: event.target.checked ? 'true' : undefined })}
        />
        <Button variant="secondary" size="sm" onClick={onReset} disabled={activeCount === 0}>
          Limpiar filtros ({activeCount})
        </Button>
      </div>
    </section>
  );
}
