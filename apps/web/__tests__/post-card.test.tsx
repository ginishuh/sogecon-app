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
    expect(screen.getByLabelText('category')).toHaveTextContent('notice');
    expect(screen.getByLabelText('pinned')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'cover' })).toBeInTheDocument();
  });

  it('renders without optional props', () => {
    render(<PostCard title="News" content="Body" />);
    expect(screen.queryByLabelText('category')).toBeNull();
    expect(screen.queryByLabelText('pinned')).toBeNull();
  });
});

