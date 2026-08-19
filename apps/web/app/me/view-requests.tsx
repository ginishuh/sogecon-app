"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EnvelopeSimple } from '@phosphor-icons/react';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import Button from '../../components/ui/button';
import {
  acceptViewRequest,
  declineViewRequest,
  listIncomingViewRequests,
  type DirectoryViewRequestRead,
} from '../../services/me';

function statusLabel(status: DirectoryViewRequestRead['status']): string {
  if (status === 'pending') return '대기';
  if (status === 'accepted') return '허용함';
  return '거절함';
}

export function ViewRequestInbox() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['me', 'view-requests'],
    queryFn: listIncomingViewRequests,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['me', 'view-requests'] });
  };

  const accept = useMutation({
    mutationFn: acceptViewRequest,
    onSuccess: () => {
      toast.show('해당 동문에게 정보를 공개했어요.', { type: 'success' });
      invalidate();
    },
    onError: (error: unknown) => {
      toast.show(
        error instanceof ApiError
          ? memberApiErrorToMessage(error.code, error.message)
          : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        { type: 'error' },
      );
    },
  });

  const decline = useMutation({
    mutationFn: declineViewRequest,
    onSuccess: () => {
      toast.show('보기 요청을 거절했어요.', { type: 'success' });
      invalidate();
    },
    onError: (error: unknown) => {
      toast.show(
        error instanceof ApiError
          ? memberApiErrorToMessage(error.code, error.message)
          : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        { type: 'error' },
      );
    },
  });

  const items = query.data ?? [];
  const pending = items.filter((item) => item.status === 'pending');

  return (
    <section aria-labelledby="view-request-inbox-title" className="space-y-3 border-t border-neutral-border pt-6 sm:pt-8">
      <div className="flex items-center gap-2">
        <EnvelopeSimple size={22} aria-hidden="true" className="text-brand-700" />
        <h2 id="view-request-inbox-title" className="text-lg font-semibold text-text-primary sm:text-xl">
          동문 수첩 보기 요청
        </h2>
      </div>
      <p className="text-sm leading-6 text-text-muted">
        다른 동문이 회원님의 연락처나 소속을 보고 싶어 하면 여기에 표시됩니다. 허용하면 그 동문에게만 공개됩니다.
      </p>
      {query.isPending ? (
        <p className="text-sm text-text-muted">불러오는 중…</p>
      ) : query.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-state-error">보기 요청을 불러오지 못했습니다.</p>
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>다시 불러오기</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted">아직 받은 요청이 없어요.</p>
      ) : (
        <ul className="divide-y divide-neutral-border rounded-xl border border-neutral-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-text-primary">
                  {item.requester_name} · {item.requester_cohort}기
                </p>
                <p className="mt-1 text-sm text-text-muted">{statusLabel(item.status)}</p>
              </div>
              {item.status === 'pending' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => accept.mutate(item.id)}
                    disabled={accept.isPending || decline.isPending}
                  >
                    허용하기
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => decline.mutate(item.id)}
                    disabled={accept.isPending || decline.isPending}
                  >
                    거절하기
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 ? (
        <p className="sr-only" role="status">대기 중인 보기 요청 {pending.length}건</p>
      ) : null}
    </section>
  );
}
