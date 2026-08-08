import { env } from '../config/env.js';

const GHL_API_URL = 'https://services.leadconnectorhq.com';
const CONTACTS_API_VERSION = '2021-07-28';
const MESSAGES_API_VERSION = 'v3';
const REQUEST_TIMEOUT_MS = 12_000;

interface GhlContact {
  id: string;
  locationId?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  contactName?: string;
  dnd?: boolean;
}

interface GhlContactsResponse {
  contacts?: GhlContact[];
}

interface GhlMessageResponse {
  messageId?: string;
  conversationId?: string;
}

export interface GhlContactMatch {
  id: string;
  name: string;
  phone: string;
}

export interface GhlMessageReceipt {
  messageId: string;
  conversationId: string | null;
}

export class GhlApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'GhlApiError';
  }
}

export function normalizeWhatsappPhone(phone: string): string {
  return phone.replace(/[\s()-]/g, '');
}

export function isGhlWhatsAppEnabled(): boolean {
  return env.ghlWhatsAppEnabled && !env.isTest;
}

function requireConfiguration(): { token: string; locationId: string } {
  if (!isGhlWhatsAppEnabled()) {
    throw new GhlApiError('El canal WhatsApp de HighLevel no esta habilitado.');
  }

  return {
    token: env.GHL_PRIVATE_INTEGRATION_TOKEN!,
    locationId: env.GHL_LOCATION_ID!,
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let parsed: unknown = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const apiMessage =
      parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `HTTP ${response.status}`;
    throw new GhlApiError(`HighLevel rechazo la solicitud: ${apiMessage}`, response.status);
  }

  return (parsed ?? {}) as T;
}

/** Busca un contacto tecnico interno por telefono; nunca crea contactos. */
export async function findGhlContactByPhone(phone: string): Promise<GhlContactMatch | null> {
  const { token, locationId } = requireConfiguration();
  const normalized = normalizeWhatsappPhone(phone);
  const url = new URL(`${GHL_API_URL}/contacts/`);
  url.searchParams.set('locationId', locationId);
  url.searchParams.set('query', normalized);
  url.searchParams.set('limit', '20');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      Version: CONTACTS_API_VERSION,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await readResponse<GhlContactsResponse>(response);
  const contact = (payload.contacts ?? []).find(
    (item) =>
      item.locationId === locationId &&
      item.phone &&
      normalizeWhatsappPhone(item.phone) === normalized,
  );

  if (!contact) return null;
  if (contact.dnd) {
    throw new GhlApiError('El contacto interno tiene DND activo en HighLevel.');
  }

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  return {
    id: contact.id,
    name: contact.contactName || fullName || 'Usuario Zorzal Lirio',
    phone: normalized,
  };
}

/** Envia una alerta al contacto GHL asociado a un usuario de Zorzal Lirio OS. */
export async function sendGhlWhatsAppMessage(
  contactId: string,
  message: string,
): Promise<GhlMessageReceipt> {
  const { token } = requireConfiguration();
  const response = await fetch(`${GHL_API_URL}/conversations/messages`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Version: MESSAGES_API_VERSION,
    },
    body: JSON.stringify({
      type: 'WhatsApp',
      contactId,
      message,
      status: 'pending',
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await readResponse<GhlMessageResponse>(response);

  if (!payload.messageId) {
    throw new GhlApiError('HighLevel no devolvio el identificador del mensaje.');
  }

  return {
    messageId: payload.messageId,
    conversationId: payload.conversationId ?? null,
  };
}
