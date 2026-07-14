"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../../../../components/confirm-dialog';
import { AdminAuthState } from '../../../../../components/admin-auth-state';
import { HeroTargetToggle } from '../../../../../components/hero-target-toggle';
import { RequirePermission } from '../../../../../components/require-permission';
import { useAuth } from '../../../../../hooks/useAuth';
import { useHeroTargetControls } from '../../../../../hooks/useHeroTargetControls';
import { useToast } from '../../../../../components/toast';
import { Button } from '../../../../../components/ui/button';
import { FIELD_CONTROL } from '../../../../../components/ui/styles';
import { ApiError } from '../../../../../lib/api';
import { apiErrorToMessage } from '../../../../../lib/error-map';
import { hasPermissionSession } from '../../../../../lib/rbac';
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

function canLoadEvent(canManageEvents: boolean, eventId: number) {
  return canManageEvents && Number.isFinite(eventId);
}

export function EventForm({
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
      <label className="block text-sm text-text-secondary">
        제목
        <input
          className={`${FIELD_CONTROL} mt-1`}
          value={state.title}
          onChange={(e) => onChange({ title: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-text-secondary">
        장소
        <input
          className={`${FIELD_CONTROL} mt-1`}
          value={state.location}
          onChange={(e) => onChange({ location: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-text-secondary">
        내용
        <textarea
          className={`${FIELD_CONTROL} mt-1 min-h-32 resize-y`}
          rows={6}
          placeholder="행사 소개/공지 내용을 입력하세요."
          value={state.description}
          onChange={(e) => onChange({ description: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-text-secondary">
        정원
        <input
          className={`${FIELD_CONTROL} mt-1 sm:w-40`}
          type="number"
          value={state.capacity}
          onChange={(e) =>
            onChange({ capacity: e.currentTarget.value === '' ? '' : Number(e.currentTarget.value) })
          }
        />
      </label>

      <label className="block text-sm text-text-secondary">
        시작 일시
        <input
          className={`${FIELD_CONTROL} mt-1 sm:w-auto`}
          type="datetime-local"
          value={state.startsAt}
          onChange={(e) => onChange({ startsAt: e.currentTarget.value })}
        />
      </label>

      <label className="block text-sm text-text-secondary">
        종료 일시
        <input
          className={`${FIELD_CONTROL} mt-1 sm:w-auto`}
          type="datetime-local"
          value={state.endsAt}
          onChange={(e) => onChange({ endsAt: e.currentTarget.value })}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={disabled}
          onClick={onSave}
        >
          {saving ? '저장 중...' : '수정 저장'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onView}
        >
          공개 페이지 보기
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={onDeleteClick}
        >
          삭제
        </Button>
      </div>
    </div>
  );
}

export default function AdminEventEditPage() {
  const params = useParams<{ id: string }>();
  const eventId = Number(params?.id);
  const { status, data: session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const canManageEvents = hasPermissionSession(session, 'admin_events');
  const canManageHero = hasPermissionSession(session, 'admin_hero');
  const heroControls = useHeroTargetControls({
    targetType: 'event',
    targetIds: Number.isFinite(eventId) ? [eventId] : [],
    showToast: toast.show,
    enabled: canManageHero,
  });

  const { data, isLoading, isError } = useQuery<Event>({
    queryKey: ['admin-event', eventId],
    queryFn: () => getEvent(eventId),
    enabled: canLoadEvent(canManageEvents, eventId),
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

  if (status !== 'authorized') return <AdminAuthState status={status} />;

  if (isError) {
    return <div className="p-6 text-sm text-state-error">행사를 불러올 수 없습니다.</div>;
  }

  return (
    <RequirePermission
      permission="admin_events"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">행사 수정</h2>
            {data && (
              <p className="text-sm text-text-secondary">
                #{data.id} · {data.title}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.push('/admin/events')}
          >
            목록으로
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-text-muted">불러오는 중...</div>
        ) : (
          <>
            {canManageHero && <section className="rounded border border-neutral-border bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-text-primary">홈 배너</div>
                  <div className="text-xs text-text-muted">
                    행사 관리 목록에서도 지정할 수 있습니다.
                  </div>
                </div>
                <HeroTargetToggle
                  value={heroControls.heroById.get(eventId)}
                  isPending={heroControls.isPending}
                  onToggle={(nextOn) => heroControls.toggleHero(eventId, nextOn)}
                  onTogglePinned={(nextPinned) => heroControls.togglePinned(eventId, nextPinned)}
                />
              </div>
            </section>}

            <EventForm
              state={form}
              disabled={disabled}
              saving={updateMutation.isPending}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              onSave={() => updateMutation.mutate()}
              onView={() => router.push(`/events/${eventId}`)}
              onDeleteClick={() => setShowDelete(true)}
            />
          </>
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
    </RequirePermission>
  );
}
