import { apiFetch } from '../lib/api';

export type Member = { id: number; email: string; name: string; cohort: number; major?: string | null; roles: string; visibility: 'all'|'cohort'|'private' };

export async function listMembers(params: { q?: string; cohort?: number; major?: string; company?: string; industry?: string; region?: string; limit?: number; offset?: number } = {}): Promise<Member[]> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (typeof params.cohort === 'number') usp.set('cohort', String(params.cohort));
  if (params.major) usp.set('major', params.major);
  if (params.company) usp.set('company', params.company);
  if (params.industry) usp.set('industry', params.industry);
  if (params.region) usp.set('region', params.region);
  if (typeof params.limit === 'number') usp.set('limit', String(params.limit));
  if (typeof params.offset === 'number') usp.set('offset', String(params.offset));
  const qs = usp.toString();
  return apiFetch<Member[]>(`/members${qs ? `?${qs}` : ''}`);
}

export async function countMembers(params: { q?: string; cohort?: number; major?: string; company?: string; industry?: string; region?: string } = {}): Promise<number> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (typeof params.cohort === 'number') usp.set('cohort', String(params.cohort));
  if (params.major) usp.set('major', params.major);
  if (params.company) usp.set('company', params.company);
  if (params.industry) usp.set('industry', params.industry);
  if (params.region) usp.set('region', params.region);
  const qs = usp.toString();
  const res = await apiFetch<{ count: number }>(`/members/count${qs ? `?${qs}` : ''}`);
  return res.count;
}
