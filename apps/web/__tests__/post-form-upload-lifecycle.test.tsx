import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostForm } from '../components/post-form';
import { ApiError } from '../lib/api';
import type { Post } from '../services/posts';

vi.mock('../services/uploads', () => ({
  deleteUpload: vi.fn(),
  filenameFromUploadUrl: (url: string) => {
    const marker = '/media/images/';
    const index = url.indexOf(marker);
    if (index < 0) return null;
    return url.slice(index + marker.length).split('?')[0] || null;
  },
  uploadImage: vi.fn(),
}));

vi.mock('../components/multi-image-upload', () => ({
  MultiImageUpload: ({
    coverImage,
    images,
    onCoverChange,
    onImagesChange,
    onUploaded,
    onBeforeRemove,
  }: {
    coverImage: string | null;
    images: string[];
    onCoverChange: (url: string | null) => void;
    onImagesChange: (urls: string[]) => void;
    onUploaded?: (url: string) => void;
    onBeforeRemove?: (url: string) => Promise<boolean>;
  }) => {
    const current = coverImage ?? images[0] ?? null;
    return (
      <div>
        {current ? (
          <button
            type="button"
            onClick={() => {
              void (async () => {
                const allowed = onBeforeRemove ? await onBeforeRemove(current) : true;
                if (!allowed) return;
                if (coverImage === current) {
                  onCoverChange(null);
                  return;
                }
                onImagesChange(images.filter((url) => url !== current));
              })();
            }}
          >
            이미지 삭제
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const url = 'https://api.example.com/media/images/staged.jpg';
              onUploaded?.(url);
              onCoverChange(url);
            }}
          >
            이미지 업로드
          </button>
        )}
      </div>
    );
  },
}));

import { deleteUpload } from '../services/uploads';

const ATTACHED = 'https://api.example.com/media/images/attached.jpg';

function samplePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    title: '기존 글',
    content: '본문',
    published_at: '2026-08-01T00:00:00+09:00',
    pinned: false,
    cover_image: ATTACHED,
    images: [],
    category: 'notice',
    author_id: 1,
    author_name: '작성자',
    created_at: '2026-08-01T00:00:00+09:00',
    view_count: 0,
    comment_count: 0,
    ...overrides,
  };
}

describe('PostForm upload lifecycle', () => {
  beforeEach(() => {
    vi.mocked(deleteUpload).mockReset();
    vi.mocked(deleteUpload).mockResolvedValue(undefined);
  });

  it('remove then cancel does not delete attached image', async () => {
    const onCancel = vi.fn();
    render(
      <PostForm
        initialData={samplePost()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '이미지 삭제' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '이미지 삭제' })).not.toBeInTheDocument();
    });
    expect(deleteUpload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
    expect(deleteUpload).not.toHaveBeenCalled();
  });

  it('remove then failed update does not delete attached image', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('update failed'));
    render(
      <PostForm
        initialData={samplePost()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '이미지 삭제' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '이미지 삭제' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(deleteUpload).not.toHaveBeenCalled();
  });

  it('remove then successful update deletes attached image', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PostForm
        initialData={samplePost()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '이미지 삭제' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '이미지 삭제' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(deleteUpload).toHaveBeenCalledWith('attached.jpg');
    });
  });

  it('blocks staged remove when delete fails', async () => {
    vi.mocked(deleteUpload).mockRejectedValueOnce(
      new ApiError(500, '삭제 실패', 'upload_delete_failed'),
    );
    render(<PostForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '이미지 업로드' }));
    expect(screen.getByRole('button', { name: '이미지 삭제' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이미지 삭제' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('삭제 실패');
    });
    expect(screen.getByRole('button', { name: '이미지 삭제' })).toBeInTheDocument();
  });
});
