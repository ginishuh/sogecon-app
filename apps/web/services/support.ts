import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type ContactPayload = Schema<'ContactPayload'>;

export async function submitContact(payload: ContactPayload): Promise<void> {
  await apiFetch('/support/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
