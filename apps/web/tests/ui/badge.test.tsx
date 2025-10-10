import { render } from '@testing-library/react';
import React from 'react';
import { Badge } from '../../components/ui/badge';

describe('Badge', () => {
  it('renders variants and matches snapshot', () => {
    const { container } = render(
      <div>
        <Badge variant="primary">Primary</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="error">Error</Badge>
      </div>,
    );
    expect(container.firstElementChild).toMatchInlineSnapshot(`
      <div>
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-200"
        >
          Primary
        </span>
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200"
        >
          Success
        </span>
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200"
        >
          Warning
        </span>
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 ring-1 ring-inset ring-red-200"
        >
          Error
        </span>
      </div>
    `);
  });
});
