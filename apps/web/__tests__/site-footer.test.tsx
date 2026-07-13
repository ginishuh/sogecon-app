import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from '../components/site-footer';

describe('SiteFooter', () => {
  it('지원 링크에 최소 44px 조작 영역을 제공한다', () => {
    render(<SiteFooter />);

    const navigation = screen.getByRole('navigation', { name: '지원 정보' });
    for (const link of within(navigation).getAllByRole('link')) {
      expect(link).toHaveClass('inline-flex', 'min-h-11', 'min-w-11');
    }
  });
});
