import { render } from '@testing-library/react';
import React from 'react';
import { Button } from '../../components/ui/button';

describe('Button', () => {
  it('renders the default control with a 44px minimum target and focus contract', () => {
    const { container } = render(<Button>확인</Button>);
    expect(container.firstElementChild).toHaveClass('min-h-11', 'min-w-11', 'focus-visible:ring-2');
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
    expect(getByText('Small')).toHaveClass('min-h-11', 'min-w-11');
  });
});
