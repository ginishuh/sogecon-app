import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type Member = Schema<'MemberRead'>;

export type MemberListSort = 'recent' | 'cohort_desc' | 'cohort_asc' | 'name';

type MemberListParams = {
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
};

// 파라미터 키 매핑 (camelCase → snake_case)
const PARAM_KEYS: Array<[keyof MemberListParams, string]> = [
  ['q', 'q'],
  ['cohort', 'cohort'],
  ['major', 'major'],
  ['company', 'company'],
  ['industry', 'industry'],
  ['region', 'region'],
  ['jobTitle', 'job_title'],
  ['sort', 'sort'],
  ['limit', 'limit'],
  ['offset', 'offset'],
];

function buildQueryString(params: MemberListParams): string {
  const usp = new URLSearchParams();
  for (const [key, apiKey] of PARAM_KEYS) {
    const val = params[key];
    if (val != null && val !== '') {
      usp.set(apiKey, String(val));
    }
  }
  return usp.toString();
}

export async function listMembers(params: MemberListParams = {}): Promise<Member[]> {
  const qs = buildQueryString(params);
  return apiFetch<Member[]>(`/members/${qs ? `?${qs}` : ''}`);
}

type MemberCountParams = Omit<MemberListParams, 'sort' | 'limit' | 'offset'>;

export async function countMembers(params: MemberCountParams = {}): Promise<number> {
  const qs = buildQueryString(params);
  const res = await apiFetch<{ count: number }>(`/members/count${qs ? `?${qs}` : ''}`);
  return res.count;
}

export async function getMember(id: number): Promise<Member> {
  return apiFetch<Member>(`/members/${id}`);
}
