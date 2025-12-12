"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../../../../components/confirm-dialog';
import { RequireAdmin } from '../../../../../components/require-admin';
import { useAuth } from '../../../../../hooks/useAuth';
import { useToast } from '../../../../../components/toast';
import { ApiError } from '../../../../../lib/api';
import { apiErrorToMessage } from '../../../../../lib/error-map';
import {
  getEvent,
  updateAdminEvent,
  deleteAdminEvent,
  type Event,
} from '../../../../../services/events';

function toLocalInput(dt: string) {
  return new Date(dt).toISOString().slice(0, 16);
}

function fromLocalInput(v: string) {
  return new Date(v).toISOString();
}

type FormState = {
  title: string;
  location: string;
  description: string;
  capacity: number | '';
  startsAt: string;
  endsAt: string;
};

function isFormDisabled(form: FormState, isSaving: boolean, isDeleting: boolean): boolean {
  if (isSaving || isDeleting) return true;
  if (!form.title.trim() || !form.location.trim()) return true;
  if (typeof form.capacity !== 'number') return true;
  if (!form.startsAt || !form.endsAt) return true;
  return false;
}

function EventForm({
  state,
  disabled,
  onChange,
  onSave,
  onView,
  onDeleteClick,
  saving,
}: {
  state: FormState;
  disabled: boolean;
  saving: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onView: () => void;
  onDeleteClick: () => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm text-slate-700">
        제목
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          value={state.title}
          onChange={(e) => onChange({ title: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        장소
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          value={state.location}
          onChange={(e) => onChange({ location: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        내용
        <textarea
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          rows={6}
          placeholder="행사 소개/공지 내용을 입력하세요."
          value={state.description}
          onChange={(e) => onChange({ description: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        정원
        <input
          className="mt-1 w-40 rounded border border-slate-300 px-3 py-2"
          type="number"
          value={state.capacity}
          onChange={(e) =>
            onChange({ capacity: e.currentTarget.value === '' ? '' : Number(e.currentTarget.value) })
          }
        />
      </label>

      <label className="block text-sm text-slate-700">
        시작 일시
        <input
          className="mt-1 rounded border border-slate-300 px-3 py-2"
          type="datetime-local"
          value={state.startsAt}
          onChange={(e) => onChange({ startsAt: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        종료 일시
        <input
          className="mt-1 rounded border border-slate-300 px-3 py-2"
          type="datetime-local"
          value={state.endsAt}
          onChange={(e) => onChange({ endsAt: e.currentTarget.value })}
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={disabled}
          onClick={onSave}
        >
          {saving ? '저장 중...' : '수정 저장'}
        </button>
        <button
          type="button"
          className="rounded border px-4 py-2 text-sm text-slate-700"
          onClick={onView}
        >
          공개 페이지 보기
        </button>
        <button
          type="button"
          className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          onClick={onDeleteClick}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

export default function AdminEventEditPage() {
  const params = useParams<{ id: string }>();
  const eventId = Number(params?.id);
  const { status } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery<Event>({
    queryKey: ['admin-event', eventId],
    queryFn: () => getEvent(eventId),
    enabled: Number.isFinite(eventId),
  });

  const [form, setForm] = useState<FormState>({
    title: '',
    location: '',
    description: '',
    capacity: '',
    startsAt: '',
    endsAt: '',
  });
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        title: data.title,
        location: data.location,
        description: data.description ?? '',
        capacity: data.capacity,
        startsAt: toLocalInput(data.starts_at),
        endsAt: toLocalInput(data.ends_at),
      });
    }
  }, [data]);

  const updateMutation = useMutation<Event, unknown, void>({
    mutationFn: async () => {
      await updateAdminEvent(eventId, {
        title: form.title,
        location: form.location,
        description: form.description.trim() ? form.description.trim() : null,
        capacity: typeof form.capacity === 'number' ? form.capacity : undefined,
        starts_at: form.startsAt ? fromLocalInput(form.startsAt) : undefined,
        ends_at: form.endsAt ? fromLocalInput(form.endsAt) : undefined,
      });
      return getEvent(eventId);
    },
    onSuccess: () => {
      toast.show('행사가 수정되었습니다.', { type: 'success' });
      router.push('/admin/events');
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof ApiError ? apiErrorToMessage(e.code, e.message) : '수정 중 오류가 발생했습니다.';
      toast.show(msg, { type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminEvent(eventId),
    onSuccess: () => {
      toast.show('행사가 삭제되었습니다.', { type: 'success' });
      router.push('/admin/events');
    },
    onError: () => {
      toast.show('삭제 중 오류가 발생했습니다.', { type: 'error' });
    },
  });

  const disabled =
    isFormDisabled(form, updateMutation.isPending, deleteMutation.isPending);

  if (!Number.isFinite(eventId)) {
    return notFound();
  }

  if (status === 'unauthorized') {
    return <div className="p-6 text-sm text-slate-600">관리자 로그인이 필요합니다.</div>;
  }

  if (isError) {
    return <div className="p-6 text-sm text-red-600">행사를 불러올 수 없습니다.</div>;
  }

  return (
    <RequireAdmin fallback={<div className="p-6 text-sm text-slate-600">관리자 전용입니다.</div>}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">행사 수정</h2>
            {data && (
              <p className="text-sm text-slate-600">
                #{data.id} · {data.title}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm text-slate-700"
            onClick={() => router.push('/admin/events')}
          >
            목록으로
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-slate-500">불러오는 중...</div>
        ) : (
          <EventForm
            state={form}
            disabled={disabled}
            saving={updateMutation.isPending}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onSave={() => updateMutation.mutate()}
            onView={() => router.push(`/events/${eventId}`)}
            onDeleteClick={() => setShowDelete(true)}
          />
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title="행사 삭제"
        description="이 행사를 삭제하시겠습니까? 관련 참여 신청 기록도 함께 삭제됩니다."
        confirmLabel="삭제"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
      />
    </RequireAdmin>
  );
}
