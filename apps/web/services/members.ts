import type { components } from 'schemas';
import { apiFetch } from '../lib/api';

export type Member = components['schemas']['MemberRead'];

export type MemberListSort = 'recent' | 'cohort_desc' | 'cohort_asc' | 'name';

export async function listMembers(params: {
  q?: string;
  cohort?: number;
  major?: string;
  company?: string;
  industry?: string;
  region?: string;
  jobTitle?: string;
  sort?: MemberListSort;
  limit?: number;
  offset?: number;
} = {}): Promise<Member[]> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (typeof params.cohort === 'number') usp.set('cohort', String(params.cohort));
  if (params.major) usp.set('major', params.major);
  if (params.company) usp.set('company', params.company);
  if (params.industry) usp.set('industry', params.industry);
  if (params.region) usp.set('region', params.region);
  if (params.jobTitle) usp.set('job_title', params.jobTitle);
  if (params.sort) usp.set('sort', params.sort);
  if (typeof params.limit === 'number') usp.set('limit', String(params.limit));
  if (typeof params.offset === 'number') usp.set('offset', String(params.offset));
  const qs = usp.toString();
  return apiFetch<Member[]>(`/members${qs ? `?${qs}` : ''}`);
}

export async function countMembers(params: {
  q?: string;
  cohort?: number;
  major?: string;
  company?: string;
  industry?: string;
  region?: string;
  jobTitle?: string;
} = {}): Promise<number> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (typeof params.cohort === 'number') usp.set('cohort', String(params.cohort));
  if (params.major) usp.set('major', params.major);
  if (params.company) usp.set('company', params.company);
  if (params.industry) usp.set('industry', params.industry);
  if (params.region) usp.set('region', params.region);
  if (params.jobTitle) usp.set('job_title', params.jobTitle);
  const qs = usp.toString();
  const res = await apiFetch<{ count: number }>(`/members/count${qs ? `?${qs}` : ''}`);
  return res.count;
}
