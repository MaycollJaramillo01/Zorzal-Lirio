import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['OWNER', 'ADMIN', 'PLANT']);
export const priorityEnum = pgEnum('priority', ['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const alertTypeEnum = pgEnum('alert_type', ['SLA_WARNING', 'SLA_OVERDUE']);
export const alertChannelEnum = pgEnum('alert_channel', ['EMAIL', 'CONSOLE']);
export const alertStatusEnum = pgEnum('alert_status', ['PENDING', 'SENT', 'FAILED']);

const createdAt = timestamp('created_at', { withTimezone: true, mode: 'date' })
  .notNull()
  .defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true, mode: 'date' })
  .notNull()
  .defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 160 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('PLANT'),
    isActive: boolean('is_active').notNull().default(true),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    /** Dueno principal creado por el seed: no puede ser degradado ni desactivado. */
    isPrimaryOwner: boolean('is_primary_owner').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_role_idx').on(table.role),
    index('users_is_active_idx').on(table.isActive),
  ],
);

export const stages = pgTable(
  'stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    position: integer('position').notNull(),
    slaMinutes: integer('sla_minutes'),
    warningBeforeMinutes: integer('warning_before_minutes'),
    isSlaEnabled: boolean('is_sla_enabled').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('stages_code_unique').on(table.code),
    uniqueIndex('stages_position_unique').on(table.position),
  ],
);

export const userStageFocus = pgTable(
  'user_stage_focus',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => stages.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.stageId] }),
    index('user_stage_focus_stage_idx').on(table.stageId),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderCode: varchar('order_code', { length: 24 }).notNull(),
    purchaseOrderNumber: varchar('purchase_order_number', { length: 80 }).notNull(),
    customerName: varchar('customer_name', { length: 160 }).notNull(),
    projectName: varchar('project_name', { length: 160 }).notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull(),
    priority: priorityEnum('priority').notNull().default('NORMAL'),
    purchaseOrderDate: date('purchase_order_date', { mode: 'string' }).notNull(),
    expectedDeliveryDate: date('expected_delivery_date', { mode: 'string' }),
    currentStageId: uuid('current_stage_id')
      .notNull()
      .references(() => stages.id),
    currentAssigneeId: uuid('current_assignee_id').references(() => users.id),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    version: integer('version').notNull().default(1),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt,
    updatedAt,
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('orders_order_code_unique').on(table.orderCode),
    index('orders_current_stage_idx').on(table.currentStageId),
    index('orders_current_assignee_idx').on(table.currentAssigneeId),
    index('orders_purchase_order_date_idx').on(table.purchaseOrderDate),
    index('orders_created_at_idx').on(table.createdAt),
    index('orders_is_archived_idx').on(table.isArchived),
    index('orders_priority_idx').on(table.priority),
    index('orders_customer_idx').on(table.customerName),
  ],
);

export const orderStageHistory = pgTable(
  'order_stage_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => stages.id),
    assigneeId: uuid('assignee_id').references(() => users.id),
    enteredAt: timestamp('entered_at', { withTimezone: true, mode: 'date' }).notNull(),
    exitedAt: timestamp('exited_at', { withTimezone: true, mode: 'date' }),
    elapsedMinutes: integer('elapsed_minutes'),
    movedByUserId: uuid('moved_by_user_id').references(() => users.id),
    transitionNote: text('transition_note'),
    createdAt,
  },
  (table) => [
    // Garantiza un unico tramo abierto por orden.
    uniqueIndex('order_stage_history_open_unique')
      .on(table.orderId)
      .where(sql`${table.exitedAt} is null`),
    index('order_stage_history_order_idx').on(table.orderId),
    index('order_stage_history_stage_idx').on(table.stageId),
    index('order_stage_history_assignee_idx').on(table.assigneeId),
    index('order_stage_history_entered_at_idx').on(table.enteredAt),
  ],
);

export const orderNotes = pgTable(
  'order_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => users.id),
    body: text('body').notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    hiddenByUserId: uuid('hidden_by_user_id').references(() => users.id),
    hiddenAt: timestamp('hidden_at', { withTimezone: true, mode: 'date' }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('order_notes_order_idx').on(table.orderId),
    index('order_notes_created_at_idx').on(table.createdAt),
  ],
);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    stageHistoryId: uuid('stage_history_id')
      .notNull()
      .references(() => orderStageHistory.id, { onDelete: 'cascade' }),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    alertType: alertTypeEnum('alert_type').notNull(),
    channel: alertChannelEnum('channel').notNull().default('CONSOLE'),
    status: alertStatusEnum('status').notNull().default('PENDING'),
    /** order_id + stage_history_id + alert_type + recipient_user_id */
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 240 }).notNull(),
    message: text('message').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message'),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex('alerts_dedupe_key_unique').on(table.dedupeKey),
    index('alerts_status_idx').on(table.status),
    index('alerts_alert_type_idx').on(table.alertType),
    index('alerts_order_idx').on(table.orderId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt,
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 400 }),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 60 }).notNull(),
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    entityId: uuid('entity_id'),
    beforeData: jsonb('before_data'),
    afterData: jsonb('after_data'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt,
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_actor_idx').on(table.actorUserId),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
  updatedAt,
});

/** Contador transaccional por ano para generar `ZL-2026-0001`. */
export const orderSequences = pgTable('order_sequences', {
  year: integer('year').primaryKey(),
  lastNumber: integer('last_number').notNull().default(0),
  updatedAt,
});

/** Lock con expiracion para evitar ejecuciones concurrentes del cron. */
export const cronLocks = pgTable('cron_locks', {
  name: varchar('name', { length: 60 }).primaryKey(),
  lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  lockedBy: varchar('locked_by', { length: 120 }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true, mode: 'date' }),
  lastSummary: jsonb('last_summary'),
});

export const usersRelations = relations(users, ({ many }) => ({
  stageFocus: many(userStageFocus),
  sessions: many(sessions),
}));

export const stagesRelations = relations(stages, ({ many }) => ({
  focusedBy: many(userStageFocus),
  orders: many(orders),
}));

export const userStageFocusRelations = relations(userStageFocus, ({ one }) => ({
  user: one(users, { fields: [userStageFocus.userId], references: [users.id] }),
  stage: one(stages, { fields: [userStageFocus.stageId], references: [stages.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  currentStage: one(stages, { fields: [orders.currentStageId], references: [stages.id] }),
  currentAssignee: one(users, { fields: [orders.currentAssigneeId], references: [users.id] }),
  createdBy: one(users, { fields: [orders.createdByUserId], references: [users.id] }),
  history: many(orderStageHistory),
  notes: many(orderNotes),
}));

export const orderStageHistoryRelations = relations(orderStageHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStageHistory.orderId], references: [orders.id] }),
  stage: one(stages, { fields: [orderStageHistory.stageId], references: [stages.id] }),
  assignee: one(users, { fields: [orderStageHistory.assigneeId], references: [users.id] }),
  movedBy: one(users, { fields: [orderStageHistory.movedByUserId], references: [users.id] }),
}));

export const orderNotesRelations = relations(orderNotes, ({ one }) => ({
  order: one(orders, { fields: [orderNotes.orderId], references: [orders.id] }),
  author: one(users, { fields: [orderNotes.authorUserId], references: [users.id] }),
  hiddenBy: one(users, { fields: [orderNotes.hiddenByUserId], references: [users.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  order: one(orders, { fields: [alerts.orderId], references: [orders.id] }),
  recipient: one(users, { fields: [alerts.recipientUserId], references: [users.id] }),
  stageHistory: one(orderStageHistory, {
    fields: [alerts.stageHistoryId],
    references: [orderStageHistory.id],
  }),
}));

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type StageRow = typeof stages.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;
export type OrderStageHistoryRow = typeof orderStageHistory.$inferSelect;
export type OrderNoteRow = typeof orderNotes.$inferSelect;
export type AlertRow = typeof alerts.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
