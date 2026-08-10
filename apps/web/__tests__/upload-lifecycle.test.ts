import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../lib/api';
import { useDiscardUploadsOnLeave, useUploadLifecycle } from '../lib/upload-lifecycle';

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

function useLifecycleWithLeave(initialUrls: readonly string[], currentUrls: readonly string[]) {
  const lifecycle = useUploadLifecycle(initialUrls);
  useDiscardUploadsOnLeave(lifecycle.discardSession, () => currentUrls);
  return lifecycle;
}

describe('useUploadLifecycle', () => {
  beforeEach(() => {
    vi.mocked(deleteUpload).mockReset();
    vi.mocked(deleteUpload).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('commitPendingDeletes reports failure without clearing remaining urls', async () => {
    const { result } = renderHook(() => useUploadLifecycle([ATTACHED]));

    await act(async () => {
      await result.current.removeUpload(ATTACHED);
    });

    vi.mocked(deleteUpload).mockRejectedValueOnce(
      new ApiError(500, '삭제 실패', 'upload_delete_failed'),
    );

    let commit: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      commit = await result.current.commitPendingDeletes();
    });

    expect(commit.ok).toBe(false);
    expect(commit.error).toBe('삭제 실패');

    vi.mocked(deleteUpload).mockResolvedValueOnce(undefined);
    await act(async () => {
      commit = await result.current.commitPendingDeletes();
    });
    expect(commit.ok).toBe(true);
    expect(deleteUpload).toHaveBeenCalledTimes(2);
  });

  it('discards staged urls after real unmount', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useLifecycleWithLeave([], [STAGED]));

    act(() => {
      result.current.registerUpload(STAGED);
    });

    unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(deleteUpload).toHaveBeenCalledWith('staged.jpg');
  });

  it('does not discard staged urls on strict-mode remount', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(
      () => useLifecycleWithLeave([], [STAGED]),
      { wrapper: StrictMode },
    );

    act(() => {
      result.current.registerUpload(STAGED);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(deleteUpload).not.toHaveBeenCalled();

    unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(deleteUpload).toHaveBeenCalledWith('staged.jpg');
  });

  it('discards staged urls on pagehide', async () => {
    const { result } = renderHook(() => useLifecycleWithLeave([], [STAGED]));

    act(() => {
      result.current.registerUpload(STAGED);
    });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(deleteUpload).toHaveBeenCalledWith('staged.jpg');
  });
});
