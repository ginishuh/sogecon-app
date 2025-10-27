import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import * as axe from 'axe-core';

import HomeQuickActions from '../components/home/quick-actions';

// NOTE:
// - 문서 타이틀은 Next App Router의 metadata/layout에서 설정되므로
//   컴포넌트 단위 JSDOM 테스트에서는 제외합니다.
// - 색 대비(color-contrast)는 폰트/OS 렌더러에 따라 변동성이 있어 제외합니다.

const axeOptions: axe.RunOptions = {
  rules: {
    'document-title': { enabled: false },
    'color-contrast': { enabled: false },
  },
};

describe('a11y: home smoke', () => {
  it('has no critical a11y violations in Home quick surface', async () => {
    const { container } = render(<HomeQuickActions />);
    const result = await axe.run(container, axeOptions);
    const violations = result.violations.map((v) => ({ id: v.id, impact: v.impact }));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
