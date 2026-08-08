import type {
  AlertChannel,
  AlertStatus,
  AlertType,
  AuditAction,
  Priority,
  Role,
  SlaState,
} from '../constants/enums.js';
import type { StageCode } from '../constants/stages.js';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface StageRef {
  id: string;
  code: StageCode;
  name: string;
  position: number;
}

export interface StageDto extends StageRef {
  slaMinutes: number | null;
  warningBeforeMinutes: number | null;
  isSlaEnabled: boolean;
  isActive: boolean;
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SessionUser extends UserRef {
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  stageFocus: StageRef[];
}

export interface TeamMember extends UserRef {
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isPrimaryOwner: boolean;
  stageFocus: StageRef[];
  activeOrders: number;
  overdueOrders: number;
}

export interface OrderSlaInfo {
  state: SlaState;
  dueAt: string | null;
  warningAt: string | null;
  minutesInStage: number;
  minutesRemaining: number | null;
  minutesOverdue: number | null;
}

export interface OrderCard {
  id: string;
  orderCode: string;
  purchaseOrderNumber: string;
  customerName: string;
  projectName: string;
  quantity: number;
  priority: Priority;
  purchaseOrderDate: string;
  expectedDeliveryDate: string | null;
  stage: StageRef;
  assignee: UserRef | null;
  stageEnteredAt: string;
  sla: OrderSlaInfo;
  version: number;
  isArchived: boolean;
  closedAt: string | null;
}

export interface OrderFinance {
  currency: 'HNL';
  saleAmountCents: number;
  productionCostCents: number;
  profitCents: number;
  status: 'PENDING' | 'PAID';
  paidAt: string | null;
}

export interface OrderDetail extends OrderCard {
  description: string | null;
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
  /** Solo se entrega a dueños y administradores. */
  finance: OrderFinance | null;
}

export interface OrderHistoryEntry {
  id: string;
  stage: StageRef;
  assignee: UserRef | null;
  movedBy: UserRef | null;
  enteredAt: string;
  exitedAt: string | null;
  elapsedMinutes: number | null;
  transitionNote: string | null;
}

export interface OrderNote {
  id: string;
  body: string;
  author: UserRef | null;
  isHidden: boolean;
  hiddenAt: string | null;
  hiddenBy: UserRef | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  actor: UserRef | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface AlertRecord {
  id: string;
  orderId: string;
  orderCode: string;
  alertType: AlertType;
  channel: AlertChannel;
  status: AlertStatus;
  recipientEmail: string;
  subject: string;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  activeOrders: number;
  warningOrders: number;
  overdueOrders: number;
  closedThisMonth: number;
  averageLeadTimeMinutes: number | null;
  busiestStage: { stage: StageRef; orders: number } | null;
  stageDistribution: Array<{ stage: StageRef; orders: number; overdue: number }>;
  workload: Array<{ user: UserRef; activeOrders: number; warningOrders: number; overdueOrders: number }>;
  topOverdue: OrderCard[];
  recentActivity: Array<{
    id: string;
    orderId: string;
    orderCode: string;
    stageName: string;
    assigneeName: string | null;
    movedByName: string | null;
    enteredAt: string;
  }>;
}

export interface WorkloadRow {
  user: UserRef;
  activeOrders: number;
  warningOrders: number;
  overdueOrders: number;
  byStage: Array<{ stage: StageRef; orders: number }>;
}

export interface OverdueRow {
  orderId: string;
  orderCode: string;
  customerName: string;
  projectName: string;
  stage: StageRef;
  assignee: UserRef | null;
  enteredAt: string;
  dueAt: string;
  minutesOverdue: number;
  priority: Priority;
}

export interface StageTimeRow {
  stage: StageRef;
  completedOrders: number;
  averageMinutes: number | null;
  medianMinutes: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  metSlaPercent: number | null;
  missedSlaPercent: number | null;
}

export interface ThroughputRow {
  period: string;
  closedOrders: number;
}

export interface ThroughputReport {
  openOrders: number;
  closedOrders: number;
  overdueOrders: number;
  averageLeadTimeMinutes: number | null;
  closedByPeriod: ThroughputRow[];
  slowestStage: { stage: StageRef; averageMinutes: number } | null;
  mostOverdueStage: { stage: StageRef; overdueCount: number } | null;
}

export interface FinancialReportRow {
  orderId: string;
  orderCode: string;
  customerName: string;
  projectName: string;
  saleAmountCents: number;
  productionCostCents: number;
  profitCents: number;
  paidAt: string;
}

export interface FinancialReport {
  month: string;
  currency: 'HNL';
  summary: {
    grossRevenueCents: number;
    productionCostsCents: number;
    netProfitCents: number;
    marginPercent: number | null;
    paidOrders: number;
    pendingReceivablesCents: number;
    pendingOrders: number;
  };
  rows: FinancialReportRow[];
}

export interface SlaCheckSummary {
  success: boolean;
  checkedOrders: number;
  warningsCreated: number;
  overdueCreated: number;
  emailsSent: number;
  consoleAlerts: number;
  failedAlerts: number;
  skipped?: boolean;
  reason?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp: string;
}
