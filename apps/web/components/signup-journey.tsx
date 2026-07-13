import { IdentificationCard, LockKey, UserCheck } from '@phosphor-icons/react';

const STEPS = [
  {
    label: '가입 정보 보내기',
    shortLabel: '정보 보내기',
    description: '동문 확인에 필요한 기본 정보를 보내주세요.',
    icon: IdentificationCard,
  },
  {
    label: '동문회 사무국 확인',
    shortLabel: '사무국 확인',
    description: '동문회 사무국에서 가입 정보를 확인합니다.',
    icon: UserCheck,
  },
  {
    label: '비밀번호 만들기',
    shortLabel: '비밀번호 만들기',
    description: '확인 후 비밀번호 만들기 링크를 보내드려요.',
    icon: LockKey,
  },
] as const;

type SignupJourneyProps = {
  currentStep: 1 | 2 | 3 | 4;
};

export function SignupJourney({ currentStep }: SignupJourneyProps) {
  const activeStep = Math.min(currentStep, 3);
  return (
    <section className="rounded-2xl border border-brand-100 bg-brand-surface px-4 py-4 md:px-7 md:py-6">
      <h2 className="font-heading text-lg font-semibold text-brand-800 md:text-xl">가입 신청은 이렇게 진행돼요</h2>
      <ol aria-label="동문 가입 진행 단계" className="mt-4 grid grid-cols-3 gap-2 md:mt-5 md:gap-5">
      {STEPS.map(({ label, shortLabel, description, icon: Icon }, index) => {
        const step = index + 1;
        const current = step === activeStep && currentStep < 4;
        const complete = step < activeStep || currentStep === 4;
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className="relative min-w-0 text-center"
          >
            <span
              className={`mx-auto inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                current
                  ? 'bg-brand-700 text-white'
                  : complete
                    ? 'bg-state-success text-white'
                    : 'border border-neutral-border bg-white text-text-muted'
              }`}
            >
              {complete ? <span className="text-xs">완료</span> : step}
            </span>
            <Icon
              aria-hidden="true"
              className={`mx-auto mt-2 size-6 md:mt-3 md:size-7 ${current || complete ? 'text-brand-700' : 'text-text-muted'}`}
              weight="regular"
            />
            <span className="mt-2 block break-keep text-xs font-semibold leading-5 text-text-primary md:text-sm">
              {label === shortLabel ? (
                shortLabel
              ) : (
                <>
                  <span className="sr-only">{label}</span>
                  <span aria-hidden="true">{shortLabel}</span>
                </>
              )}
            </span>
            <span className="mt-1 hidden text-xs leading-5 text-text-muted md:block">{description}</span>
          </li>
        );
      })}
      </ol>
      {currentStep === 4 ? <p className="sr-only">첫 로그인 완료</p> : null}
    </section>
  );
}
