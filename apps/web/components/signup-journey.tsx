const STEPS = [
  '가입 정보 보내기',
  '동문회 사무국 확인',
  '비밀번호 만들기',
  '첫 로그인 완료',
] as const;

type SignupJourneyProps = {
  currentStep: 1 | 2 | 3 | 4;
};

export function SignupJourney({ currentStep }: SignupJourneyProps) {
  return (
    <ol aria-label="동문 가입 진행 단계" className="grid gap-2 sm:grid-cols-4">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const current = step === currentStep;
        const complete = step < currentStep;
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className={`rounded-lg border px-3 py-2 text-sm ${
              current
                ? 'border-brand-700 bg-brand-50 font-semibold text-brand-800'
                : complete
                  ? 'border-state-success-ring bg-state-success-subtle text-state-success'
                  : 'border-neutral-border bg-white text-text-muted'
            }`}
          >
            <span className="mr-1 text-xs">{complete ? '완료' : `${step}단계`}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

