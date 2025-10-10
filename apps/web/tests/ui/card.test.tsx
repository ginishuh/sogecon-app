import { render } from '@testing-library/react';
import React from 'react';
import { Card } from '../../components/ui/card';

describe('Card', () => {
  it('renders with title/meta and elevation md (snapshot)', () => {
    const { container } = render(
      <Card id="c1" heading="카드 제목" meta={<span>메타</span>} elevation="md">
        본문 내용
      </Card>,
    );
    expect(container.firstElementChild).toMatchInlineSnapshot(`
      <section
        aria-labelledby="c1-title"
        class="rounded-lg border border-neutral-border bg-surface p-4 md:p-6 shadow-md"
        id="c1"
      >
        <header
          class="mb-2 flex items-start justify-between gap-2"
        >
          <h3
            class="font-heading text-lg text-text-primary md:text-xl"
            id="c1-title"
          >
            카드 제목
          </h3>
          <div
            class="text-sm text-text-muted"
          >
            <span>
              메타
            </span>
          </div>
        </header>
        <div
          class="text-text-primary"
        >
          본문 내용
        </div>
      </section>
    `);
  });

  it('renders elevation sm', () => {
    const { container } = render(<Card elevation="sm">x</Card>);
    expect(container.firstElementChild).toHaveClass('shadow-sm');
  });
});
