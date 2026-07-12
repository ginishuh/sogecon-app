import { render } from '@testing-library/react';
import * as axe from 'axe-core';
import React from 'react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Tabs } from '../../components/ui/tabs';
import { TextArea } from '../../components/ui/textarea';

describe('design system accessibility contract', () => {
  it('has no critical axe violations across the core primitives', async () => {
    const { container } = render(
      <main>
        <Card id="profile" heading="동문 정보" meta={<Badge variant="success">공개</Badge>}>
          <div className="space-y-4">
            <Input id="name" label="이름" helperText="동문 수첩에 표시됩니다" />
            <Select id="cohort" label="기수"><option>61기</option></Select>
            <TextArea id="intro" label="소개" errorText="소개를 입력해 주세요" />
            <Button>저장하기</Button>
          </div>
        </Card>
        <Tabs aria-label="동문 정보" items={[{ id: 'basic', label: '기본 정보', content: <p>기본 정보 내용</p> }, { id: 'privacy', label: '공개 범위', content: <p>공개 범위 내용</p> }]} />
      </main>,
    );

    const result = await axe.run(container, {
      rules: { 'document-title': { enabled: false }, 'color-contrast': { enabled: false } },
    });
    expect(result.violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
  });
});
