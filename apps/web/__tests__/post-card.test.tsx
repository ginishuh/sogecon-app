import { render, screen } from '@testing-library/react';
import React from 'react';
import { PostCard } from '../components/post-card';

describe('PostCard', () => {
  it('renders category, pinned badge, and cover image', () => {
    render(
      <PostCard
        title="Notice Pinned"
        content="Body"
        category="notice"
        pinned
        cover_image="https://example.com/cover.png"
        published_at={null}
      />
    );
    expect(screen.getByLabelText('글 종류')).toHaveTextContent('공지사항');
    expect(screen.getByLabelText('중요 공지')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Notice Pinned 대표 이미지' })).toBeInTheDocument();
  });

  it('renders without optional props', () => {
    render(<PostCard title="News" content="Body" />);
    expect(screen.queryByLabelText('글 종류')).toBeNull();
    expect(screen.queryByLabelText('중요 공지')).toBeNull();
  });
});
