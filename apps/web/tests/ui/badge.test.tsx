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
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-state-success-subtle text-state-success ring-1 ring-inset ring-state-success-ring"
        >
          Success
        </span>
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-state-warning-subtle text-state-warning ring-1 ring-inset ring-state-warning-ring"
        >
          Warning
        </span>
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-state-error-subtle text-state-error ring-1 ring-inset ring-state-error-ring"
        >
          Error
        </span>
      </div>
    `);
  });
});
