import { render } from '@testing-library/react';
import React from 'react';
import { Button } from '../../components/ui/button';

describe('Button', () => {
  it('renders primary/md (default) and matches snapshot', () => {
    const { container } = render(<Button>확인</Button>);
    expect(container.firstElementChild).toMatchInlineSnapshot(`
      <button
        class="inline-flex items-center justify-center rounded-md font-medium transition-colors select-none focus-visible:outline-none ring-offset-2 ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 bg-brand-700 text-text-inverse hover:bg-brand-800 active:bg-brand-900 focus-visible:ring-brand-400 h-10 px-4 text-sm"
      >
        확인
      </button>
    `);
  });

  it('renders variants and sizes', () => {
    const { getByText } = render(
      <div>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger" size="lg">
          Danger
        </Button>
        <Button size="sm" disabled>
          Small
        </Button>
      </div>,
    );
    expect(getByText('Secondary')).toBeInTheDocument();
    expect(getByText('Ghost')).toBeInTheDocument();
    expect(getByText('Danger')).toBeInTheDocument();
    expect(getByText('Small')).toBeDisabled();
  });
});
