import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Tabs } from '../../components/ui/tabs';

const items = [
  { id: 't1', label: '탭1', content: <div>내용1</div> },
  { id: 't2', label: '탭2', content: <div>내용2</div> },
  { id: 't3', label: '탭3', content: <div>내용3</div> },
];

describe('Tabs', () => {
  it('click switches selection and shows panel', () => {
    render(<Tabs items={items} aria-label="샘플 탭" />);
    const tab2 = screen.getByRole('tab', { name: '탭2' });
    fireEvent.click(tab2);
    expect(tab2).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('내용2');
  });

  it('keyboard navigation: ArrowRight and End', () => {
    render(<Tabs items={items} aria-label="탭 키보드" />);
    const tablist = screen.getByRole('tablist');
    const [t1, t2, t3] = screen.getAllByRole('tab');
    t1.focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(t2).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(t3).toHaveAttribute('aria-selected', 'true');
  });
});

