import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type ContactPayload = Schema<'ContactPayload'>;
export type SupportTicketRead = Schema<'TicketRead'>;

export async function submitContact(payload: ContactPayload): Promise<void> {
  await apiFetch('/support/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listAdminSupportTickets(limit = 50): Promise<SupportTicketRead[]> {
  const q = new URLSearchParams();
  q.set('limit', String(limit));
  return apiFetch<SupportTicketRead[]>(`/support/admin/tickets?${q.toString()}`);
}
