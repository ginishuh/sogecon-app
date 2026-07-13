import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { SignupJourney } from '../components/signup-journey';

describe('동문 가입 진행 단계', () => {
  it('현재 단계와 완료 단계를 구분한다', () => {
    render(<SignupJourney currentStep={3} />);

    expect(screen.getByRole('list', { name: '동문 가입 진행 단계' })).toBeInTheDocument();
    expect(screen.getByText('비밀번호 만들기').closest('li')).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByText('가입 정보 보내기').closest('li')).toHaveTextContent('완료');
    expect(screen.getByRole('list', { name: '동문 가입 진행 단계' }).querySelectorAll('li')).toHaveLength(3);
  });

  it('첫 로그인 완료 상태에서는 세 단계를 모두 완료로 표시한다', () => {
    render(<SignupJourney currentStep={4} />);

    expect(screen.getByText('첫 로그인 완료')).toBeInTheDocument();
    expect(screen.getAllByText('완료')).toHaveLength(3);
  });
});
