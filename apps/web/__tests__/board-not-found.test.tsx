import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BoardPostNotFound from '../app/board/[id]/not-found';

describe('board post not found', () => {
  it('한국어 복구 문구와 게시판 링크를 제공한다', () => {
    render(<BoardPostNotFound />);

    expect(screen.getByRole('heading', { name: '게시글을 찾지 못했습니다.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '게시판으로' })).toHaveAttribute('href', '/board');
    expect(screen.queryByText('This page could not be found.')).not.toBeInTheDocument();
  });
});
