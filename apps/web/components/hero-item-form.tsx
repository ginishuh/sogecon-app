"use client";

import { useEffect, useRef, useState } from 'react';

import { ImageUpload } from './image-upload';
import type { CreateHeroItemPayload, HeroItem, HeroTargetType } from '../services/hero';

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
  onSubmit: (payload: CreateHeroItemPayload) => void;
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

export function HeroItemForm({
  initialData,
  submitLabel = '저장',
  loadingLabel = '저장 중...',
  isPending = false,
  error = null,
  onSubmit,
  onCancel,
}: HeroItemFormProps) {
  const [form, setForm] = useState<HeroItemFormData>(() => toInitial(initialData));
  const hydratedIdRef = useRef<number | null>(initialData?.id ?? null);

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
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(toPayload(form));
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-text-secondary">
          대상 종류
          <select
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.target_type}
            onChange={(e) => setForm((prev) => ({ ...prev, target_type: e.currentTarget.value as HeroTargetType }))}
            disabled={isPending}
          >
            <option value="post">게시글</option>
            <option value="event">행사</option>
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          대상 ID
          <input
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            type="number"
            min={1}
            value={formatTargetIdValue(form.target_id)}
            onChange={(e) => setForm((prev) => ({ ...prev, target_id: toInt(e.currentTarget.value) }))}
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
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.currentTarget.checked }))}
            disabled={isPending}
            className="rounded border-neutral-border"
          />
          홈 배너 노출
        </label>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => setForm((prev) => ({ ...prev, pinned: e.currentTarget.checked }))}
            disabled={isPending}
            className="rounded border-neutral-border"
          />
          홈 배너 상단 고정
        </label>
      </div>

      <label className="block text-sm text-text-secondary">
        제목(옵션)
        <input
          className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
          value={form.title_override}
          onChange={(e) => setForm((prev) => ({ ...prev, title_override: e.currentTarget.value }))}
          disabled={isPending}
          placeholder="비워두면 대상(행사/게시글) 제목을 사용합니다."
        />
      </label>

      <label className="block text-sm text-text-secondary">
        설명(옵션)
        <textarea
          className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
          rows={3}
          value={form.description_override}
          onChange={(e) => setForm((prev) => ({ ...prev, description_override: e.currentTarget.value }))}
          disabled={isPending}
          placeholder="비워두면 대상 설명/본문을 사용합니다."
        />
      </label>

      <div className="space-y-1">
        <span className="block text-sm text-text-secondary">배너 이미지(옵션)</span>
        <ImageUpload
          value={form.image_override}
          onUpload={(url) => setForm((prev) => ({ ...prev, image_override: url }))}
          onRemove={() => setForm((prev) => ({ ...prev, image_override: null }))}
          disabled={isPending}
        />
        <p className="text-xs text-text-muted">
          행사에는 이미지 필드가 없어서, 행사 배너는 여기서 이미지를 지정해두시는 게 안전합니다.
        </p>
      </div>

      <p hidden={!error} role="alert" className="text-sm text-state-error">
        {error}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
          onClick={() => onCancel?.()}
          disabled={isPending}
          hidden={!onCancel}
        >
          취소
        </button>
        <button
          type="submit"
          className="rounded bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!canSubmit}
          aria-busy={isPending}
        >
          {isPending ? loadingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
