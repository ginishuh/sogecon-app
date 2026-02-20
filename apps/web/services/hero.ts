import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type HeroSlide = Schema<'HeroSlide'>;
export type HeroTargetType = HeroSlide['target_type'];
export type HeroItem = Schema<'HeroItemRead'>;
export type AdminHeroListResponse = Schema<'AdminHeroListResponse'>;
export type HeroTargetLookupItem = Schema<'HeroTargetLookupItem'>;
export type HeroTargetLookupResponse = Schema<'HeroTargetLookupResponse'>;
export type UpdateHeroItemPayload = Schema<'HeroItemUpdate'>;

// enabled, pinned는 서버 기본값이 있어 클라이언트에서 생략 가능
export type CreateHeroItemPayload =
  Omit<Schema<'HeroItemCreate'>, 'enabled' | 'pinned'> & {
    enabled?: boolean;
    pinned?: boolean;
  };

export async function listHeroSlides(params: { limit?: number; include_unpublished?: boolean } = {}): Promise<HeroSlide[]> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.include_unpublished) q.set('include_unpublished', 'true');
  const qs = q.toString();
  return apiFetch<HeroSlide[]>(`/hero/${qs ? `?${qs}` : ''}`);
}

export async function listAdminHeroItems(params: { limit?: number; offset?: number } = {}): Promise<AdminHeroListResponse> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<AdminHeroListResponse>(`/admin/hero/${qs ? `?${qs}` : ''}`);
}

export async function lookupAdminHeroItems(params: { target_type: HeroTargetType; target_ids: number[] }): Promise<HeroTargetLookupResponse> {
  return apiFetch<HeroTargetLookupResponse>(`/admin/hero/lookup`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getAdminHeroItem(id: number): Promise<HeroItem> {
  return apiFetch<HeroItem>(`/admin/hero/${id}`);
}

export async function createAdminHeroItem(payload: CreateHeroItemPayload): Promise<HeroItem> {
  return apiFetch<HeroItem>(`/admin/hero/`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAdminHeroItem(id: number, payload: UpdateHeroItemPayload): Promise<HeroItem> {
  return apiFetch<HeroItem>(`/admin/hero/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteAdminHeroItem(id: number): Promise<{ ok: boolean; deleted_id: number }> {
  return apiFetch<{ ok: boolean; deleted_id: number }>(`/admin/hero/${id}`, { method: 'DELETE' });
}
