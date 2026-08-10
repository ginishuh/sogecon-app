import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../lib/api';
import { useUploadLifecycle } from '../lib/upload-lifecycle';

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

import { deleteUpload } from '../services/uploads';

const ATTACHED = 'https://api.example.com/media/images/attached.jpg';
const STAGED = 'https://api.example.com/media/images/staged.jpg';

describe('useUploadLifecycle', () => {
  beforeEach(() => {
    vi.mocked(deleteUpload).mockReset();
    vi.mocked(deleteUpload).mockResolvedValue(undefined);
  });

  it('defers delete for attached urls until commit', async () => {
    const { result } = renderHook(() => useUploadLifecycle([ATTACHED]));

    let allowed = false;
    await act(async () => {
      const remove = await result.current.removeUpload(ATTACHED);
      allowed = remove.ok;
    });

    expect(allowed).toBe(true);
    expect(deleteUpload).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.commitPendingDeletes();
    });
    expect(deleteUpload).toHaveBeenCalledWith('attached.jpg');
  });

  it('deletes staged urls immediately and blocks remove on failure', async () => {
    const { result } = renderHook(() => useUploadLifecycle([]));

    act(() => {
      result.current.registerUpload(STAGED);
    });

    await act(async () => {
      await result.current.removeUpload(STAGED);
    });
    expect(deleteUpload).toHaveBeenCalledWith('staged.jpg');

    vi.mocked(deleteUpload).mockRejectedValueOnce(
      new ApiError(500, '삭제 실패', 'upload_delete_failed'),
    );

    act(() => {
      result.current.registerUpload(STAGED);
    });

    let removeResult: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      removeResult = await result.current.removeUpload(STAGED);
    });
    expect(removeResult.ok).toBe(false);
  });

  it('discardSession clears pending deletes without server delete', async () => {
    const { result } = renderHook(() => useUploadLifecycle([ATTACHED]));

    await act(async () => {
      await result.current.removeUpload(ATTACHED);
    });

    await act(async () => {
      await result.current.discardSession([]);
    });

    expect(deleteUpload).not.toHaveBeenCalled();
  });
});
