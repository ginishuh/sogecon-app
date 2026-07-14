"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { HeroItemForm } from '../../../../../components/hero-item-form';
import { AdminAuthState } from '../../../../../components/admin-auth-state';
import { useToast } from '../../../../../components/toast';
import { useAuth } from '../../../../../hooks/useAuth';
import { ApiError } from '../../../../../lib/api';
import { apiErrorToMessage } from '../../../../../lib/error-map';
import { hasPermissionSession } from '../../../../../lib/rbac';
import {
  getAdminHeroItem,
  updateAdminHeroItem,
  type CreateHeroItemPayload,
} from '../../../../../services/hero';

export default function AdminHeroEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const heroItemId = Number(params.id);
  const canManageHero = auth.status === 'authorized'
    && hasPermissionSession(auth.data, 'admin_hero');

  const query = useQuery({
    queryKey: ['admin-hero-item', heroItemId],
    queryFn: () => getAdminHeroItem(heroItemId),
    enabled: canManageHero && Number.isFinite(heroItemId),
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

  if (auth.status !== 'authorized') {
    return <AdminAuthState status={auth.status} />;
  }
  if (!canManageHero) {
    return <div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>;
  }

  return (
      <section className="mx-auto max-w-2xl space-y-4 p-6">
        <nav className="flex min-h-11 items-center text-sm text-text-secondary">
          <Link
            href="/admin/hero"
            className="inline-flex min-h-11 items-center rounded-md px-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
          >
            홈 배너 관리
          </Link>
          <span className="mx-2">/</span>
          <span>수정</span>
        </nav>

        <h1 className="text-xl font-semibold">배너 수정</h1>

        {query.isLoading ? <p className="text-sm text-text-secondary">불러오는 중…</p> : null}
        {query.isError || !query.data ? (
          <p className="text-sm text-state-error">배너 정보를 불러오지 못했습니다.</p>
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
  );
}
