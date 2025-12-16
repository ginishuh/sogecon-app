"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ApiError } from '../lib/api';
import { apiErrorToMessage } from '../lib/error-map';
import {
  createAdminHeroItem,
  lookupAdminHeroItems,
  updateAdminHeroItem,
  type HeroTargetLookupItem,
  type HeroTargetType,
} from '../services/hero';

type ToastFn = (msg: string, opts: { type: 'success' | 'error' }) => void;

function buildHeroMap(items: HeroTargetLookupItem[]): Map<number, HeroTargetLookupItem> {
  return new Map(items.map((item) => [item.target_id, item]));
}

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return apiErrorToMessage(err.code, err.message);
  return '저장 중 오류가 발생했습니다.';
}

export function useHeroTargetControls(params: {
  targetType: HeroTargetType;
  targetIds: number[];
  showToast: ToastFn;
}) {
  const { targetType, targetIds, showToast } = params;
  const queryClient = useQueryClient();

  const lookup = useQuery({
    queryKey: ['admin-hero-lookup', targetType, targetIds],
    queryFn: () => lookupAdminHeroItems({ target_type: targetType, target_ids: targetIds }),
    enabled: targetIds.length > 0,
    staleTime: 15_000,
  });

  const heroById = useMemo(() => buildHeroMap(lookup.data?.items ?? []), [lookup.data]);

  const invalidateHero = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-hero-lookup', targetType] });
    void queryClient.invalidateQueries({ queryKey: ['admin-hero'] });
    void queryClient.invalidateQueries({ queryKey: ['hero'] });
  };

  const createMutation = useMutation({
    mutationFn: (targetId: number) =>
      createAdminHeroItem({ target_type: targetType, target_id: targetId, enabled: true }),
    onSuccess: () => {
      showToast('배너에 등록했습니다.', { type: 'success' });
      invalidateHero();
    },
    onError: (err: unknown) => {
      showToast(toErrorMessage(err), { type: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; enabled?: boolean; pinned?: boolean }) =>
      updateAdminHeroItem(payload.id, { enabled: payload.enabled, pinned: payload.pinned }),
    onSuccess: () => invalidateHero(),
    onError: (err: unknown) => {
      showToast(toErrorMessage(err), { type: 'error' });
    },
  });

  const toggleHero = (targetId: number, nextOn: boolean) => {
    const current = heroById.get(targetId);
    if (!current) {
      if (nextOn) createMutation.mutate(targetId);
      return;
    }

    if (current.enabled === nextOn) return;
    updateMutation.mutate({ id: current.hero_item_id, enabled: nextOn });
  };

  const togglePinned = (targetId: number, nextPinned: boolean) => {
    const current = heroById.get(targetId);
    if (!current) return;
    if (current.pinned === nextPinned) return;
    updateMutation.mutate({ id: current.hero_item_id, pinned: nextPinned });
  };

  const isPending = lookup.isFetching || createMutation.isPending || updateMutation.isPending;

  return {
    heroById,
    isPending,
    toggleHero,
    togglePinned,
  };
}

