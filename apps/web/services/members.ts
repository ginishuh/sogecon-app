import { apiFetch } from '../lib/api';

export type Member = { id: number; email: string; name: string; cohort: number; major?: string | null; roles: string; visibility: 'all'|'cohort'|'private' };

export async function listMembers(params: { q?: string; cohort?: number; major?: string; limit?: number; offset?: number } = {}): Promise<Member[]> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (typeof params.cohort === 'number') usp.set('cohort', String(params.cohort));
  if (params.major) usp.set('major', params.major);
  if (typeof params.limit === 'number') usp.set('limit', String(params.limit));
  if (typeof params.offset === 'number') usp.set('offset', String(params.offset));
  const qs = usp.toString();
  return apiFetch<Member[]>(`/members${qs ? `?${qs}` : ''}`);
}

