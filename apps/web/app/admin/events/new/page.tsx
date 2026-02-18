"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RequirePermission } from '../../../../components/require-permission';
import { useToast } from '../../../../components/toast';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError } from '../../../../lib/api';
import { apiErrorToMessage } from '../../../../lib/error-map';
import { createEvent } from '../../../../services/events';

function toIso(value: string) {
  return new Date(value).toISOString();
}

function isValidCapacity(value: number | ''): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export default function AdminNewEventPage() {
  const { status } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createEvent({
        title,
        location,
        capacity: isValidCapacity(capacity) ? capacity : 0,
        starts_at: toIso(startsAt),
        ends_at: toIso(endsAt),
        description: description.trim() ? description.trim() : undefined,
      }),
    onSuccess: () => {
      show('행사가 생성되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      router.push('/admin/events');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('생성 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  const canSubmit =
    !mutation.isPending &&
    title.trim().length > 0 &&
    location.trim().length > 0 &&
    isValidCapacity(capacity) &&
    startsAt.length > 0 &&
    endsAt.length > 0;

  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>;
  }

  return (
    <RequirePermission
      permission="admin_events"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <nav className="text-sm text-text-secondary">
          <Link href="/admin/events" className="hover:underline">
            행사 관리
          </Link>
          <span className="mx-2">/</span>
          <span>새 행사</span>
        </nav>

        <h2 className="text-xl font-semibold">새 행사 생성</h2>

        <div className="space-y-3">
          <label className="block text-sm text-text-secondary">
            제목
            <input
              className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </label>

          <label className="block text-sm text-text-secondary">
            장소
            <input
              className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
              value={location}
              onChange={(e) => setLocation(e.currentTarget.value)}
            />
          </label>

          <label className="block text-sm text-text-secondary">
            내용
            <textarea
              className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
              rows={6}
              placeholder="행사 소개/공지 내용을 입력하세요."
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </label>

          <label className="block text-sm text-text-secondary">
            정원
            <input
              className="mt-1 w-40 rounded border border-neutral-border px-3 py-2"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-text-secondary">
              시작 일시
              <input
                className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.currentTarget.value)}
              />
            </label>

            <label className="block text-sm text-text-secondary">
              종료 일시
              <input
                className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.currentTarget.value)}
              />
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="rounded border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
              onClick={() => router.push('/admin/events')}
              disabled={mutation.isPending}
            >
              취소
            </button>
            <button
              type="button"
              className="rounded bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => mutation.mutate()}
              disabled={!canSubmit}
              aria-busy={mutation.isPending}
            >
              {mutation.isPending ? '생성 중...' : '생성'}
            </button>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
