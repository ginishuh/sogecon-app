"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { HeroItemForm } from '../../../../../components/hero-item-form';
import { RequireAdmin } from '../../../../../components/require-admin';
import { useToast } from '../../../../../components/toast';
import { ApiError } from '../../../../../lib/api';
import { apiErrorToMessage } from '../../../../../lib/error-map';
import {
  getAdminHeroItem,
  updateAdminHeroItem,
  type CreateHeroItemPayload,
} from '../../../../../services/hero';

export default function AdminHeroEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const heroItemId = Number(params.id);

  const query = useQuery({
    queryKey: ['admin-hero-item', heroItemId],
    queryFn: () => getAdminHeroItem(heroItemId),
    enabled: Number.isFinite(heroItemId),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateHeroItemPayload) =>
      updateAdminHeroItem(heroItemId, payload),
    onSuccess: () => {
      show('배너가 수정되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-hero'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-hero-item', heroItemId] });
      router.push('/admin/hero');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('수정 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  return (
    <RequireAdmin fallback={<div className="p-6 text-sm text-slate-600">관리자 전용입니다.</div>}>
      <section className="mx-auto max-w-2xl space-y-4 p-6">
        <nav className="text-sm text-slate-600">
          <Link href="/admin/hero" className="hover:underline">
            홈 배너 관리
          </Link>
          <span className="mx-2">/</span>
          <span>수정</span>
        </nav>

        <h1 className="text-xl font-semibold">배너 수정</h1>

        {query.isLoading ? <p className="text-sm text-slate-600">불러오는 중…</p> : null}
        {query.isError || !query.data ? (
          <p className="text-sm text-red-600">배너 정보를 불러오지 못했습니다.</p>
        ) : (
          <HeroItemForm
            initialData={query.data}
            submitLabel="수정"
            loadingLabel="수정 중..."
            isPending={mutation.isPending}
            error={mutation.error ? '수정 중 오류가 발생했습니다.' : null}
            onSubmit={(payload) => mutation.mutate(payload)}
            onCancel={() => router.push('/admin/hero')}
          />
        )}
      </section>
    </RequireAdmin>
  );
}

