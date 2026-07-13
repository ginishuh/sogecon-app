import { ArrowLeft, ChatCircleDots } from '@phosphor-icons/react/dist/ssr';

import ButtonLink from '../../../components/ui/button-link';

export default function PostNotFound() {
  return (
    <section
      className="mx-auto max-w-3xl rounded-2xl border border-neutral-border bg-surface-raised px-5 py-10 text-center sm:px-8"
      aria-labelledby="post-not-found-title"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-neutral-border">
        <ChatCircleDots size={29} aria-hidden="true" />
      </span>
      <h1 id="post-not-found-title" className="mt-5 font-heading text-2xl font-semibold text-text-primary sm:text-3xl">
        소식을 찾지 못했습니다.
      </h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-muted">
        게시가 종료되었거나 더 이상 공개되지 않는 소식일 수 있어요. 현재 확인할 수 있는 공지와 소식으로 돌아가 주세요.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/posts" className="gap-2">
          <ArrowLeft size={18} aria-hidden="true" />
          공지와 소식으로
        </ButtonLink>
      </div>
    </section>
  );
}
