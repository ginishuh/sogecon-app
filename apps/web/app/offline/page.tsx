import type { Metadata } from 'next';

import { OfflineActionButtons } from './reload-actions';

export const metadata: Metadata = {
  title: '오프라인 모드 안내'
};

export default function OfflinePage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-text-primary" aria-labelledby="offline-heading">
      <div className="flex flex-col gap-3 text-center">
        <h2 id="offline-heading" className="text-3xl font-semibold text-brand-primary">
          오프라인 상태예요
        </h2>
        <p className="text-base leading-relaxed" aria-live="polite">
          현재 네트워크 연결이 없어 데이터를 불러올 수 없습니다. 연결이 복구되면 아래 버튼으로 새로 고치거나 홈으로 이동할 수 있어요.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-neutral-border bg-surface-raised p-6 text-left">
        <h3 className="mb-3 text-lg font-semibold text-text-secondary">다음 단계를 시도해 보세요</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
          <li>와이파이 또는 모바일 데이터 연결을 확인합니다.</li>
          <li>브라우저 오프라인 모드가 켜져 있다면 해제합니다.</li>
          <li>VPN이나 프록시가 연결을 차단하고 있는지 점검합니다.</li>
        </ul>
      </div>
      <OfflineActionButtons />
      <p className="text-xs text-text-muted">
        이 페이지는 홈과 동문 수첩 화면의 최소 오프라인 스켈레톤으로 제공되며, 연결이 복구되면 자동으로 최신 데이터로 갱신됩니다.
      </p>
    </section>
  );
}
