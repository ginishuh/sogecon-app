import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from '../components/site-footer';
import { officeMailto, siteConfig } from '../lib/site';

describe('SiteFooter', () => {
  it('지원 링크에 최소 44px 조작 영역을 제공한다', () => {
    render(<SiteFooter />);

    const navigation = screen.getByRole('navigation', { name: '지원 정보' });
    for (const link of within(navigation).getAllByRole('link')) {
      expect(link).toHaveClass('inline-flex', 'min-h-11', 'min-w-11');
    }
  });

  it('사무국 메일을 홈 하단에서 바로 열 수 있다', () => {
    render(<SiteFooter />);
    const mail = screen.getByRole('link', { name: siteConfig.officeEmail });
    expect(mail).toHaveAttribute('href', officeMailto);
  });
});
