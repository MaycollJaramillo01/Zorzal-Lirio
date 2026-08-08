import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type {
  AuditEntry,
  DashboardSummary,
  FinancialReport,
  OrderCard,
  OrderDetail,
  OrderHistoryEntry,
  OrderNote,
  OverdueRow,
  SessionUser,
  StageDto,
  StageTimeRow,
  TeamMember,
  ThroughputReport,
  UserRef,
  WorkloadRow,
} from '@shared/types/index';
import type { OrderFilters } from '@shared/schemas/orders';
import type { ReportFilters } from '@shared/schemas/reports';
import { ApiError, apiFetch, buildQuery } from '../lib/api';

export const queryKeys = {
  session: ['session'] as const,
  stages: ['stages'] as const,
  users: ['users'] as const,
  orders: (filters: OrderFilters) => ['orders', filters] as const,
  order: (id: string) => ['order', id] as const,
  history: (id: string) => ['order', id, 'history'] as const,
  notes: (id: string) => ['order', id, 'notes'] as const,
  audit: (id: string, page: number) => ['order', id, 'audit', page] as const,
  dashboard: ['reports', 'summary'] as const,
  report: (name: string, filters: Record<string, unknown>) => ['reports', name, filters] as const,
};

/* ------------------------------------------------------------------ sesion */

export function useSession(options?: Partial<UseQueryOptions<SessionUser | null>>) {
  return useQuery<SessionUser | null>({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        return await apiFetch<SessionUser>('/auth/me');
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
    ...options,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<SessionUser>('/auth/login', { method: 'POST', json: input }),
    onSuccess: (user) => {
      client.setQueryData(queryKeys.session, user);
      void client.invalidateQueries();
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      client.setQueryData(queryKeys.session, null);
      client.clear();
    },
  });
}

export function useChangePassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      apiFetch<{ passwordChanged: boolean }>('/auth/change-password', {
        method: 'POST',
        json: input,
      }),
    onSuccess: () => {
      client.setQueryData(queryKeys.session, null);
      client.clear();
    },
  });
}

/* ------------------------------------------------------------------ etapas */

export function useStages() {
  return useQuery({
    queryKey: queryKeys.stages,
    queryFn: () => apiFetch<{ stages: StageDto[] }>('/stages').then((data) => data.stages),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateStageSla() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      stageId: string;
      isSlaEnabled: boolean;
      slaMinutes: number | null;
      warningBeforeMinutes: number | null;
    }) =>
      apiFetch<{ stages: StageDto[] }>(`/stages/${input.stageId}/sla`, {
        method: 'PATCH',
        json: {
          isSlaEnabled: input.isSlaEnabled,
          slaMinutes: input.slaMinutes,
          warningBeforeMinutes: input.warningBeforeMinutes,
        },
      }),
    onSuccess: (data) => {
      client.setQueryData(queryKeys.stages, data.stages);
      void client.invalidateQueries({ queryKey: ['orders'] });
      void client.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

/* ----------------------------------------------------------------- equipo */

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () =>
      apiFetch<{ users: TeamMember[] | UserRef[] }>('/users').then((data) => data.users),
    staleTime: 60_000,
  });
}

/** Lista plana de usuarios para mostrar (incluye desactivados). */
export function toUserRefs(data: Array<UserRef | TeamMember> | undefined): UserRef[] {
  return (data ?? []).map(({ id, name, email, role }) => ({ id, name, email, role }));
}

/**
 * Selector de responsable: solo usuarios activos. El backend rechaza asignar a
 * un usuario desactivado, asi que ofrecerlo solo provoca un error al confirmar.
 */
export function toAssignableUsers(data: Array<UserRef | TeamMember> | undefined): UserRef[] {
  return toUserRefs((data ?? []).filter((user) => !('isActive' in user) || user.isActive));
}

export function useTeamMutations() {
  const client = useQueryClient();
  const onSuccess = (data: { users: TeamMember[] }) => {
    client.setQueryData(queryKeys.users, data.users);
    void client.invalidateQueries({ queryKey: ['reports'] });
  };

  const createUser = useMutation({
    mutationFn: ((input: {
      name: string;
      email: string;
      role: string;
      password: string;
      stageIds: string[];
      mustChangePassword: boolean;
    }) => apiFetch<{ users: TeamMember[] }>('/users', { method: 'POST', json: input })),
    onSuccess,
  });

  const updateUser = useMutation({
    mutationFn: ((input: { id: string; name?: string; email?: string; role?: string }) => {
      const { id, ...rest } = input;
      return apiFetch<{ users: TeamMember[] }>(`/users/${id}`, { method: 'PATCH', json: rest });
    }),
    onSuccess,
  });

  const setActive = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      apiFetch<{ users: TeamMember[] }>(
        `/users/${input.id}/${input.isActive ? 'activate' : 'deactivate'}`,
        { method: 'POST' },
      ),
    onSuccess,
  });

  const resetPassword = useMutation({
    mutationFn: (input: { id: string; newPassword: string; mustChangePassword: boolean }) =>
      apiFetch<{ users: TeamMember[] }>(`/users/${input.id}/reset-password`, {
        method: 'POST',
        json: { newPassword: input.newPassword, mustChangePassword: input.mustChangePassword },
      }),
    onSuccess,
  });

  const setStageFocus = useMutation({
    mutationFn: (input: { id: string; stageIds: string[] }) =>
      apiFetch<{ users: TeamMember[] }>(`/users/${input.id}/stage-focus`, {
        method: 'PUT',
        json: { stageIds: input.stageIds },
      }),
    onSuccess,
  });

  return { createUser, updateUser, setActive, resetPassword, setStageFocus };
}

/* ---------------------------------------------------------------- ordenes */

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: queryKeys.orders(filters),
    queryFn: () =>
      apiFetch<{ orders: OrderCard[] }>(
        `/orders${buildQuery(filters as Record<string, string | boolean | undefined>)}`,
      ).then((data) => data.orders),
    staleTime: 15_000,
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ''),
    queryFn: () => apiFetch<OrderDetail>(`/orders/${orderId}`),
    enabled: Boolean(orderId),
  });
}

export function useOrderHistory(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.history(orderId ?? ''),
    queryFn: () =>
      apiFetch<{ history: OrderHistoryEntry[] }>(`/orders/${orderId}/history`).then(
        (data) => data.history,
      ),
    enabled: Boolean(orderId),
  });
}

export function useOrderNotes(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notes(orderId ?? ''),
    queryFn: () =>
      apiFetch<{ notes: OrderNote[] }>(`/orders/${orderId}/notes`).then((data) => data.notes),
    enabled: Boolean(orderId),
  });
}

export function useOrderAudit(orderId: string | undefined, page: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.audit(orderId ?? '', page),
    queryFn: () =>
      apiFetch<{ items: AuditEntry[]; total: number; page: number; pageSize: number }>(
        `/orders/${orderId}/audit${buildQuery({ page, pageSize: 20 })}`,
      ),
    enabled: Boolean(orderId) && enabled,
  });
}

export function useOrderMutations() {
  const client = useQueryClient();

  const refresh = (order?: OrderDetail) => {
    if (order) client.setQueryData(queryKeys.order(order.id), order);
    void client.invalidateQueries({ queryKey: ['orders'] });
    void client.invalidateQueries({ queryKey: ['order'] });
    void client.invalidateQueries({ queryKey: ['reports'] });
    void client.invalidateQueries({ queryKey: queryKeys.users });
  };

  /**
   * Ante un conflicto de version (409) hay que recargar de verdad: la version
   * que tiene la pantalla ya quedo vieja y cualquier reintento fallaria igual.
   */
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) refresh();
  };

  const createOrder = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch<OrderDetail>('/orders', { method: 'POST', json: input }),
    onSuccess: refresh,
  });

  const updateOrder = useMutation({
    mutationFn: (input: { id: string } & Record<string, unknown>) => {
      const { id, ...rest } = input;
      return apiFetch<OrderDetail>(`/orders/${id}`, { method: 'PATCH', json: rest });
    },
    onSuccess: refresh,
    onError,
  });

  const transitionOrder = useMutation({
    mutationFn: (input: {
      id: string;
      version: number;
      toStageId: string;
      assigneeId: string | null;
      note?: string;
      reason?: string;
    }) => {
      const { id, ...rest } = input;
      return apiFetch<OrderDetail>(`/orders/${id}/transition`, { method: 'POST', json: rest });
    },
    onSuccess: refresh,
    onError,
  });

  const updateFinance = useMutation({
    mutationFn: (input: {
      id: string;
      version: number;
      saleAmountCents: number;
      productionCostCents: number;
      paidAt: string | null;
    }) => {
      const { id, ...rest } = input;
      return apiFetch<OrderDetail>(`/orders/${id}/finance`, { method: 'PATCH', json: rest });
    },
    onSuccess: refresh,
    onError,
  });

  const reassignOrder = useMutation({
    mutationFn: (input: { id: string; version: number; assigneeId: string; note?: string }) => {
      const { id, ...rest } = input;
      return apiFetch<OrderDetail>(`/orders/${id}/reassign`, { method: 'POST', json: rest });
    },
    onSuccess: refresh,
    onError,
  });

  const archiveOrder = useMutation({
    mutationFn: (input: { id: string; version: number; archived: boolean; reason?: string }) =>
      apiFetch<OrderDetail>(`/orders/${input.id}/${input.archived ? 'archive' : 'restore'}`, {
        method: 'POST',
        json: { version: input.version, reason: input.reason },
      }),
    onSuccess: refresh,
    onError,
  });

  const addNote = useMutation({
    mutationFn: (input: { id: string; body: string }) =>
      apiFetch<{ notes: OrderNote[] }>(`/orders/${input.id}/notes`, {
        method: 'POST',
        json: { body: input.body },
      }),
    onSuccess: (data, variables) => {
      client.setQueryData(queryKeys.notes(variables.id), data.notes);
    },
  });

  const hideNote = useMutation({
    mutationFn: (input: { orderId: string; noteId: string }) =>
      apiFetch<{ notes: OrderNote[] }>(`/orders/${input.orderId}/notes/${input.noteId}/hide`, {
        method: 'POST',
      }),
    onSuccess: (data, variables) => {
      client.setQueryData(queryKeys.notes(variables.orderId), data.notes);
    },
  });

  return {
    createOrder,
    updateOrder,
    transitionOrder,
    updateFinance,
    reassignOrder,
    archiveOrder,
    addNote,
    hideNote,
  };
}

/* --------------------------------------------------------------- reportes */

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiFetch<DashboardSummary>('/reports/summary'),
    staleTime: 30_000,
  });
}

function reportPath(path: string, filters: Record<string, string | undefined>): string {
  return `${path}${buildQuery(filters as Record<string, string | undefined>)}`;
}

export function useWorkloadReport(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.report('workload', filters),
    queryFn: () => apiFetch<{ rows: WorkloadRow[] }>(reportPath('/reports/workload', filters)),
    enabled,
    staleTime: 30_000,
  });
}

export function useOverdueReport(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.report('overdue', filters),
    queryFn: () => apiFetch<{ rows: OverdueRow[] }>(reportPath('/reports/overdue', filters)),
    enabled,
    staleTime: 30_000,
  });
}

export function useStageTimesReport(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.report('stage-times', filters),
    queryFn: () => apiFetch<{ rows: StageTimeRow[] }>(reportPath('/reports/stage-times', filters)),
    enabled,
    staleTime: 30_000,
  });
}

export function useThroughputReport(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.report('throughput', filters),
    queryFn: () => apiFetch<ThroughputReport>(reportPath('/reports/throughput', filters)),
    enabled,
    staleTime: 30_000,
  });
}

export function useFinancialReport(month: string) {
  return useQuery({
    queryKey: queryKeys.report('financial', { month }),
    queryFn: () => apiFetch<FinancialReport>(reportPath('/reports/financial', { month })),
    staleTime: 30_000,
  });
}

export function reportExportUrl(report: string, filters: ReportFilters): string {
  return `/api/reports/export${buildQuery({
    ...(filters as Record<string, string | undefined>),
    report,
  })}`;
}
