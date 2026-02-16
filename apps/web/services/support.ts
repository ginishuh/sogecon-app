import { apiFetch } from '../lib/api';

export type ContactPayload = {
  subject: string;
  body: string;
  contact?: string;
};

export async function submitContact(payload: ContactPayload): Promise<void> {
  await apiFetch('/support/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
