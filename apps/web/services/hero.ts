import { apiFetch } from '../lib/api';

export type HeroTargetType = 'post' | 'event';

export type HeroSlide = {
  id: number;
  target_type: HeroTargetType;
  target_id: number;
  title: string;
  description: string;
  image?: string | null;
  href: string;
  unpublished?: boolean;
};

export async function listHeroSlides(params: { limit?: number; include_unpublished?: boolean } = {}): Promise<HeroSlide[]> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.include_unpublished) q.set('include_unpublished', 'true');
  const qs = q.toString();
  return apiFetch<HeroSlide[]>(`/hero/${qs ? `?${qs}` : ''}`);
}

export type HeroItem = {
  id: number;
  target_type: HeroTargetType;
  target_id: number;
  enabled: boolean;
  pinned: boolean;
  title_override?: string | null;
  description_override?: string | null;
  image_override?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminHeroListResponse = {
  items: HeroItem[];
  total: number;
};

export type HeroTargetLookupItem = {
  target_id: number;
  hero_item_id: number;
  enabled: boolean;
  pinned: boolean;
};

export type HeroTargetLookupResponse = {
  items: HeroTargetLookupItem[];
};

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

export type CreateHeroItemPayload = {
  target_type: HeroTargetType;
  target_id: number;
  enabled?: boolean;
  pinned?: boolean;
  title_override?: string | null;
  description_override?: string | null;
  image_override?: string | null;
};

export async function createAdminHeroItem(payload: CreateHeroItemPayload): Promise<HeroItem> {
  return apiFetch<HeroItem>(`/admin/hero/`, { method: 'POST', body: JSON.stringify(payload) });
}

export type UpdateHeroItemPayload = Partial<CreateHeroItemPayload>;

export async function updateAdminHeroItem(id: number, payload: UpdateHeroItemPayload): Promise<HeroItem> {
  return apiFetch<HeroItem>(`/admin/hero/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteAdminHeroItem(id: number): Promise<{ ok: boolean; deleted_id: number }> {
  return apiFetch<{ ok: boolean; deleted_id: number }>(`/admin/hero/${id}`, { method: 'DELETE' });
}
