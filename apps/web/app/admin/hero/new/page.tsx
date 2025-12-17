"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { HeroItemForm } from '../../../../components/hero-item-form';
import { RequireAdmin } from '../../../../components/require-admin';
import { useToast } from '../../../../components/toast';
import { ApiError } from '../../../../lib/api';
import { apiErrorToMessage } from '../../../../lib/error-map';
import { createAdminHeroItem, type CreateHeroItemPayload } from '../../../../services/hero';

export default function AdminHeroNewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const mutation = useMutation({
    mutationFn: (payload: CreateHeroItemPayload) => createAdminHeroItem(payload),
    onSuccess: () => {
      show('배너가 생성되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-hero'] });
      router.push('/admin/hero');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('생성 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  return (
    <RequireAdmin fallback={<div className="p-6 text-sm text-text-secondary">관리자 전용입니다.</div>}>
      <section className="mx-auto max-w-2xl space-y-4 p-6">
        <nav className="text-sm text-text-secondary">
          <Link href="/admin/hero" className="hover:underline">
            홈 배너 관리
          </Link>
          <span className="mx-2">/</span>
          <span>새 배너</span>
        </nav>

        <h1 className="text-xl font-semibold">새 배너 추가</h1>
        <p className="text-sm text-text-secondary">
          히어로는 “추천 슬롯”입니다. 행사/게시글을 선택해서 홈 배너에 노출합니다.
        </p>

        <HeroItemForm
          submitLabel="생성"
          loadingLabel="생성 중..."
          isPending={mutation.isPending}
          error={mutation.error ? '생성 중 오류가 발생했습니다.' : null}
          onSubmit={(payload) => mutation.mutate(payload)}
          onCancel={() => router.push('/admin/hero')}
        />
      </section>
    </RequireAdmin>
  );
}

