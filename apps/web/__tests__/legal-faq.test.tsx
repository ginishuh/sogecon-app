import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import FAQPage from '../app/faq/page';
import PrivacyPage from '../app/privacy/page';
import TermsPage from '../app/terms/page';

describe('FAQ & Policy static pages', () => {
  it('renders FAQ page with grouped sections and support information', () => {
    const { asFragment } = render(<FAQPage />);
    expect(screen.getByRole('heading', { level: 1, name: '자주 묻는 질문' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '계정 및 접근' })).toBeInTheDocument();
    expect(screen.getByText('문서 버전: 2025-10-08')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders privacy policy with sections and contact info', () => {
    const { asFragment } = render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: '개인정보 처리방침' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '6. 개인정보 보호를 위한 기술적·관리적 대책' })).toBeInTheDocument();
    expect(screen.getByText('김서강 회장 (office@sogang-econ-alumni.kr)')).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders terms of service with clauses and effective date', () => {
    const { asFragment } = render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: '이용약관' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제8조 (이용계약 해지 및 제한)' })).toBeInTheDocument();
    expect(screen.getByText('문서 버전: 2025-10-08 · 시행일: 2025-10-15')).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
