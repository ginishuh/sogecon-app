"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';

import { ImageUpload } from './image-upload';
import { Button } from './ui/button';
import { FIELD_CONTROL } from './ui/styles';
import type { CreateHeroItemPayload, HeroItem, HeroTargetType } from '../services/hero';
import {
  collectImageUrls,
  useDiscardUploadsOnLeave,
  useUploadLifecycle,
} from '../lib/upload-lifecycle';

export type HeroItemFormData = {
  target_type: HeroTargetType;
  target_id: number;
  enabled: boolean;
  pinned: boolean;
  title_override: string;
  description_override: string;
  image_override: string | null;
};

type HeroItemFormProps = {
  initialData?: HeroItem;
  submitLabel?: string;
  loadingLabel?: string;
  isPending?: boolean;
  error?: string | null;
  onSubmit: (payload: CreateHeroItemPayload) => void | Promise<void>;
  /** mutation + attached 이미지 lifecycle 완료 후 toast/navigation 등 */
  onLifecycleCommitted?: () => void | Promise<void>;
  onCancel?: () => void;
};

const DEFAULT_FORM_DATA: HeroItemFormData = {
  target_type: 'post',
  target_id: 0,
  enabled: true,
  pinned: false,
  title_override: '',
  description_override: '',
  image_override: null,
};

function toInt(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toOptionalText(value: string | null | undefined): string {
  return value ?? '';
}

function toOptionalImage(value: string | null | undefined): string | null {
  return value ?? null;
}

function formatTargetIdValue(targetId: number): string {
  if (targetId <= 0) return '';
  return String(targetId);
}

function toInitial(data?: HeroItem): HeroItemFormData {
  if (!data) return DEFAULT_FORM_DATA;
  return {
    ...DEFAULT_FORM_DATA,
    target_type: data.target_type,
    target_id: data.target_id,
    enabled: data.enabled,
    pinned: data.pinned,
    title_override: toOptionalText(data.title_override),
    description_override: toOptionalText(data.description_override),
    image_override: toOptionalImage(data.image_override),
  };
}

function toPayload(form: HeroItemFormData): CreateHeroItemPayload {
  const title = form.title_override.trim();
  const desc = form.description_override.trim();
  return {
    target_type: form.target_type,
    target_id: form.target_id,
    enabled: form.enabled,
    pinned: form.pinned,
    title_override: title ? title : null,
    description_override: desc ? desc : null,
    image_override: form.image_override ? form.image_override : null,
  };
}

type HeroSubmitContext = {
  canSubmit: boolean;
  form: HeroItemFormData;
  onSubmit: (payload: CreateHeroItemPayload) => void | Promise<void>;
  onLifecycleCommitted?: () => void | Promise<void>;
  uploadLifecycle: ReturnType<typeof useUploadLifecycle>;
  setImageError: (error: string | null) => void;
};

async function handleHeroFormSubmit(
  event: FormEvent<HTMLFormElement>,
  {
    canSubmit,
    form,
    onSubmit,
    onLifecycleCommitted,
    uploadLifecycle,
    setImageError,
  }: HeroSubmitContext,
): Promise<void> {
  event.preventDefault();
  if (!canSubmit) return;
  try {
    await Promise.resolve(onSubmit(toPayload(form)));
    const commit = await uploadLifecycle.commitPendingDeletes();
    if (!commit.ok) {
      setImageError(commit.error ?? '이미지 정리에 실패했습니다.');
      return;
    }
    uploadLifecycle.finalizeSuccessfulSubmit();
    setImageError(null);
    await Promise.resolve(onLifecycleCommitted?.());
  } catch {
    // 상위 mutation error prop으로 표시
  }
}

type HeroItemFormFieldsProps = {
  form: HeroItemFormData;
  setForm: Dispatch<SetStateAction<HeroItemFormData>>;
  isPending: boolean;
  targetIdOk: boolean;
  canSubmit: boolean;
  error: string | null;
  imageError: string | null;
  submitLabel: string;
  loadingLabel: string;
  onCancel?: () => void;
  onBeforeRemove: (url: string) => Promise<boolean>;
  onCancelClick: () => void;
  onImageUpload: (url: string) => void;
  onImageRemove: () => void;
};

function HeroItemFormFields({
  form,
  setForm,
  isPending,
  targetIdOk,
  canSubmit,
  error,
  imageError,
  submitLabel,
  loadingLabel,
  onCancel,
  onBeforeRemove,
  onCancelClick,
  onImageUpload,
  onImageRemove,
}: HeroItemFormFieldsProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-text-secondary">
          대상 종류
          <select
            className={`${FIELD_CONTROL} mt-1`}
            value={form.target_type}
            onChange={(e) => {
              const value = e.currentTarget.value as HeroTargetType;
              setForm((prev) => ({ ...prev, target_type: value }));
            }}
            disabled={isPending}
          >
            <option value="post">게시글</option>
            <option value="event">행사</option>
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          대상 ID
          <input
            className={`${FIELD_CONTROL} mt-1`}
            type="number"
            min={1}
            value={formatTargetIdValue(form.target_id)}
            onChange={(e) => {
              const value = toInt(e.currentTarget.value);
              setForm((prev) => ({ ...prev, target_id: value }));
            }}
            disabled={isPending}
            inputMode="numeric"
            placeholder="예: 123"
          />
          <p hidden={targetIdOk} className="mt-1 text-xs text-state-warning">
            대상 ID는 1 이상이어야 합니다.
          </p>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setForm((prev) => ({ ...prev, enabled: checked }));
            }}
            disabled={isPending}
            className="h-5 w-5 shrink-0 rounded border-neutral-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          />
          홈 배너 노출
        </label>

        <label className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setForm((prev) => ({ ...prev, pinned: checked }));
            }}
            disabled={isPending}
            className="h-5 w-5 shrink-0 rounded border-neutral-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          />
          홈 배너 상단 고정
        </label>
      </div>

      <label className="block text-sm text-text-secondary">
        제목(옵션)
        <input
          className={`${FIELD_CONTROL} mt-1`}
          value={form.title_override}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setForm((prev) => ({ ...prev, title_override: value }));
          }}
          disabled={isPending}
          placeholder="비워두면 대상(행사/게시글) 제목을 사용합니다."
        />
      </label>

      <label className="block text-sm text-text-secondary">
        설명(옵션)
        <textarea
          className={`${FIELD_CONTROL} mt-1 min-h-24 resize-y`}
          rows={3}
          value={form.description_override}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setForm((prev) => ({ ...prev, description_override: value }));
          }}
          disabled={isPending}
          placeholder="비워두면 대상 설명/본문을 사용합니다."
        />
      </label>

      <div className="space-y-1">
        <span className="block text-sm text-text-secondary">배너 이미지(옵션)</span>
        <ImageUpload
          value={form.image_override}
          onUpload={onImageUpload}
          onRemove={onImageRemove}
          onBeforeRemove={onBeforeRemove}
          disabled={isPending}
        />
        <p className="text-xs text-text-muted">
          행사에는 이미지 필드가 없어서, 행사 배너는 여기서 이미지를 지정해두시는 게 안전합니다.
        </p>
      </div>

      <p hidden={!(error || imageError)} role="alert" className="text-sm text-state-error">
        {error ?? imageError}
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancelClick}
          disabled={isPending}
          hidden={!onCancel}
        >
          취소
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!canSubmit}
          loading={isPending}
        >
          {isPending ? loadingLabel : submitLabel}
        </Button>
      </div>
    </>
  );
}

export function HeroItemForm({
  initialData,
  submitLabel = '저장',
  loadingLabel = '저장 중...',
  isPending = false,
  error = null,
  onSubmit,
  onLifecycleCommitted,
  onCancel,
}: HeroItemFormProps) {
  const [form, setForm] = useState<HeroItemFormData>(() => toInitial(initialData));
  const [imageError, setImageError] = useState<string | null>(null);
  const hydratedIdRef = useRef<number | null>(initialData?.id ?? null);
  const initialImageUrls = useMemo(
    () => collectImageUrls(toInitial(initialData).image_override, []),
    [initialData],
  );
  const uploadLifecycle = useUploadLifecycle(initialImageUrls);
  useDiscardUploadsOnLeave(
    uploadLifecycle.discardSession,
    () => collectImageUrls(form.image_override, []),
  );

  const handleBeforeRemove = useCallback(
    async (url: string) => {
      const result = await uploadLifecycle.removeUpload(url);
      if (!result.ok) {
        setImageError(result.error ?? '이미지 삭제에 실패했습니다.');
        return false;
      }
      setImageError(null);
      return true;
    },
    [uploadLifecycle],
  );

  const handleCancel = useCallback(async () => {
    await uploadLifecycle.discardSession(
      collectImageUrls(form.image_override, []),
    );
    setImageError(null);
    onCancel?.();
  }, [form.image_override, onCancel, uploadLifecycle]);

  const handleImageUpload = useCallback(
    (url: string) => {
      uploadLifecycle.registerUpload(url);
      setForm((prev) => ({ ...prev, image_override: url }));
    },
    [uploadLifecycle],
  );

  const handleImageRemove = useCallback(() => {
    setForm((prev) => ({ ...prev, image_override: null }));
  }, []);

  useEffect(() => {
    if (!initialData) return;
    if (hydratedIdRef.current === initialData.id) return;
    hydratedIdRef.current = initialData.id;
    setForm(toInitial(initialData));
  }, [initialData]);

  const targetIdOk = form.target_id > 0;
  const canSubmit = !isPending && targetIdOk;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void handleHeroFormSubmit(event, {
          canSubmit,
          form,
          onSubmit,
          onLifecycleCommitted,
          uploadLifecycle,
          setImageError,
        });
      }}
    >
      <HeroItemFormFields
        form={form}
        setForm={setForm}
        isPending={isPending}
        targetIdOk={targetIdOk}
        canSubmit={canSubmit}
        error={error}
        imageError={imageError}
        submitLabel={submitLabel}
        loadingLabel={loadingLabel}
        onCancel={onCancel}
        onBeforeRemove={handleBeforeRemove}
        onCancelClick={() => {
          void handleCancel();
        }}
        onImageUpload={handleImageUpload}
        onImageRemove={handleImageRemove}
      />
    </form>
  );
}
