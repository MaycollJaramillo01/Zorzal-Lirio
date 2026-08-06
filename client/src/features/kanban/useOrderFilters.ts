import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRIORITIES, SLA_STATES, type Priority, type SlaState } from '@shared/constants/enums';
import type { OrderFilters } from '@shared/schemas/orders';

export type FilterPatch = Partial<Record<keyof OrderFilters, string | boolean | undefined>>;

function readEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase() as T;
  return allowed.includes(upper) ? upper : undefined;
}

/** Filtros del tablero persistidos en la URL para poder compartirlos. */
export function useOrderFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<OrderFilters>(() => {
    const assignee = params.get('assignee') ?? undefined;
    return {
      search: params.get('search') ?? undefined,
      stageId: params.get('stageId') ?? undefined,
      assignee: assignee as OrderFilters['assignee'],
      priority: readEnum<Priority>(params.get('priority'), PRIORITIES),
      sla: readEnum<SlaState>(params.get('sla'), SLA_STATES),
      customer: params.get('customer') ?? undefined,
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      onlyMine: params.get('onlyMine') === 'true' || assignee === 'me',
      includeClosed: params.get('includeClosed') !== 'false',
      includeArchived: params.get('includeArchived') === 'true',
    };
  }, [params]);

  const setFilter = useCallback(
    (patch: FilterPatch) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '' || value === false) next.delete(key);
        else next.set(key, String(value));
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of ['search', 'stageId', 'assignee', 'priority', 'sla', 'customer', 'from', 'to']) {
      if (params.get(key)) count += 1;
    }
    if (params.get('includeClosed') === 'false') count += 1;
    if (params.get('includeArchived') === 'true') count += 1;
    return count;
  }, [params]);

  return { filters, setFilter, reset, activeCount };
}
