import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, type DbExecutor } from '../db/client.js';
import { orderNotes, users } from '../db/schema.js';
import type { Role } from '../../shared/constants/enums.js';

const authorUser = alias(users, 'note_author');
const hiddenByUser = alias(users, 'note_hidden_by');

export interface NoteRow {
  id: string;
  body: string;
  isHidden: boolean;
  hiddenAt: Date | null;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorRole: Role | null;
  hiddenById: string | null;
  hiddenByName: string | null;
  hiddenByEmail: string | null;
  hiddenByRole: Role | null;
}

export async function listNotes(orderId: string, exec: DbExecutor = getDb()): Promise<NoteRow[]> {
  return exec
    .select({
      id: orderNotes.id,
      body: orderNotes.body,
      isHidden: orderNotes.isHidden,
      hiddenAt: orderNotes.hiddenAt,
      createdAt: orderNotes.createdAt,
      authorId: authorUser.id,
      authorName: authorUser.name,
      authorEmail: authorUser.email,
      authorRole: authorUser.role,
      hiddenById: hiddenByUser.id,
      hiddenByName: hiddenByUser.name,
      hiddenByEmail: hiddenByUser.email,
      hiddenByRole: hiddenByUser.role,
    })
    .from(orderNotes)
    .leftJoin(authorUser, eq(authorUser.id, orderNotes.authorUserId))
    .leftJoin(hiddenByUser, eq(hiddenByUser.id, orderNotes.hiddenByUserId))
    .where(eq(orderNotes.orderId, orderId))
    .orderBy(asc(orderNotes.createdAt));
}

export async function insertNote(
  exec: DbExecutor,
  data: { orderId: string; authorUserId: string; body: string },
) {
  const [row] = await exec.insert(orderNotes).values(data).returning();
  return row!;
}

export async function findNote(noteId: string, exec: DbExecutor = getDb()) {
  const [row] = await exec.select().from(orderNotes).where(eq(orderNotes.id, noteId)).limit(1);
  return row ?? null;
}

export async function hideNote(exec: DbExecutor, noteId: string, hiddenByUserId: string) {
  const [row] = await exec
    .update(orderNotes)
    .set({ isHidden: true, hiddenByUserId, hiddenAt: new Date(), updatedAt: new Date() })
    .where(eq(orderNotes.id, noteId))
    .returning();
  return row ?? null;
}
