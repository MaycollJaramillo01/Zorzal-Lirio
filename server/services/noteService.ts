import { getDb } from '../db/client.js';
import { httpErrors } from '../utils/appError.js';
import { isManager } from '../../shared/lib/permissions.js';
import type { CreateNoteInput } from '../../shared/schemas/orders.js';
import type { OrderNote } from '../../shared/types/index.js';
import type { AuthUser } from '../types/auth.js';
import { findNote, hideNote, insertNote, listNotes, type NoteRow } from '../repositories/noteRepository.js';
import { recordAudit } from './auditService.js';
import { requireVisibleOrder } from './orderService.js';

function toNoteDto(row: NoteRow): OrderNote {
  return {
    id: row.id,
    body: row.body,
    author:
      row.authorId && row.authorName && row.authorEmail && row.authorRole
        ? { id: row.authorId, name: row.authorName, email: row.authorEmail, role: row.authorRole }
        : null,
    isHidden: row.isHidden,
    hiddenAt: row.hiddenAt ? row.hiddenAt.toISOString() : null,
    hiddenBy:
      row.hiddenById && row.hiddenByName && row.hiddenByEmail && row.hiddenByRole
        ? {
            id: row.hiddenById,
            name: row.hiddenByName,
            email: row.hiddenByEmail,
            role: row.hiddenByRole,
          }
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listOrderNotes(viewer: AuthUser, orderId: string): Promise<OrderNote[]> {
  await requireVisibleOrder(viewer, orderId);
  const rows = await listNotes(orderId);
  const visible = isManager(viewer.role) ? rows : rows.filter((row) => !row.isHidden);
  return visible.map(toNoteDto);
}

export async function addOrderNote(
  actor: AuthUser,
  orderId: string,
  input: CreateNoteInput,
  ipAddress: string | null,
): Promise<OrderNote[]> {
  await requireVisibleOrder(actor, orderId);

  await getDb().transaction(async (tx) => {
    const note = await insertNote(tx, { orderId, authorUserId: actor.id, body: input.body });
    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'NOTE_CREATED',
        entityType: 'order',
        entityId: orderId,
        afterData: { noteId: note.id },
        ipAddress,
      },
      tx,
    );
  });

  return listOrderNotes(actor, orderId);
}

export async function hideOrderNote(
  actor: AuthUser,
  orderId: string,
  noteId: string,
  ipAddress: string | null,
): Promise<OrderNote[]> {
  if (!isManager(actor.role)) throw httpErrors.forbidden();

  const note = await findNote(noteId);
  if (!note || note.orderId !== orderId) throw httpErrors.notFound('La nota no existe.');
  if (note.isHidden) return listOrderNotes(actor, orderId);

  await getDb().transaction(async (tx) => {
    await hideNote(tx, noteId, actor.id);
    await recordAudit(
      {
        actorUserId: actor.id,
        action: 'NOTE_HIDDEN',
        entityType: 'order',
        entityId: orderId,
        beforeData: { noteId, isHidden: false },
        afterData: { noteId, isHidden: true },
        ipAddress,
      },
      tx,
    );
  });

  return listOrderNotes(actor, orderId);
}
