"use client";

import Link from 'next/link';

import type { HeroTargetLookupItem } from '../services/hero';

type HeroTargetToggleProps = {
  value?: HeroTargetLookupItem;
  disabled?: boolean;
  isPending?: boolean;
  onToggle: (nextOn: boolean) => void;
  onTogglePinned: (nextPinned: boolean) => void;
};

function pinnedTitle(opts: { isOn: boolean; hasServerId: boolean }): string {
  if (!opts.isOn) return '홈 배너를 먼저 켜주세요';
  if (!opts.hasServerId) return '저장 중입니다. 잠시만요';
  return '홈 배너 상단 고정';
}

function isPinDisabled(canInteract: boolean, isOn: boolean, hasServerId: boolean): boolean {
  if (!canInteract) return true;
  if (!isOn) return true;
  return !hasServerId;
}

function renderSettingsLink(value?: HeroTargetLookupItem) {
  if (!value || value.hero_item_id <= 0) return null;
  return (
    <Link
      href={{ pathname: `/admin/hero/${value.hero_item_id}/edit` }}
      className="text-xs text-slate-600 underline"
    >
      설정
    </Link>
  );
}

export function HeroTargetToggle({
  value,
  disabled = false,
  isPending = false,
  onToggle,
  onTogglePinned,
}: HeroTargetToggleProps) {
  const isOn = value?.enabled ?? false;
  const canInteract = !disabled && !isPending;
  const hasServerId = (value?.hero_item_id ?? 0) > 0;
  const pinned = value?.pinned ?? false;
  const pinDisabled = isPinDisabled(canInteract, isOn, hasServerId);
  const settingsLink = renderSettingsLink(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={isOn}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          disabled={!canInteract}
          className="rounded border-slate-300"
        />
        홈 배너 노출
      </label>

      <label
        className="flex items-center gap-1 text-xs text-slate-700"
        title={pinnedTitle({ isOn, hasServerId })}
      >
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => onTogglePinned(e.currentTarget.checked)}
          disabled={pinDisabled}
          className="rounded border-slate-300"
        />
        홈 배너 상단 고정
      </label>

      {settingsLink}
    </div>
  );
}
