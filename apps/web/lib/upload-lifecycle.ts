import { useCallback, useEffect, useRef } from 'react';

import { ApiError } from './api';
import { deleteUpload, filenameFromUploadUrl } from '../services/uploads';

export type UploadRemoveResult = {
  ok: boolean;
  error?: string;
};

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message || '이미지 삭제에 실패했습니다.';
  }
  return '이미지 삭제에 실패했습니다.';
}

async function deleteUploadUrl(url: string): Promise<void> {
  const filename = filenameFromUploadUrl(url);
  if (!filename) {
    return;
  }
  await deleteUpload(filename);
}

/** 폼 세션 동안 업로드 URL의 서버 삭제 시점을 관리한다. */
export function useUploadLifecycle(initialUrls: readonly string[]) {
  const initialRef = useRef<Set<string>>(new Set(initialUrls));
  const stagedRef = useRef<Set<string>>(new Set<string>());
  const pendingDeleteRef = useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    initialRef.current = new Set(initialUrls);
    stagedRef.current = new Set<string>(
      Array.from(stagedRef.current).filter((url) => !initialRef.current.has(url)),
    );
    pendingDeleteRef.current = new Set<string>(
      Array.from(pendingDeleteRef.current).filter((url) =>
        initialRef.current.has(url),
      ),
    );
  }, [initialUrls]);

  const registerUpload = useCallback((url: string) => {
    if (!initialRef.current.has(url)) {
      stagedRef.current.add(url);
    }
  }, []);

  const removeUpload = useCallback(async (url: string): Promise<UploadRemoveResult> => {
    const isAttached = initialRef.current.has(url) && !stagedRef.current.has(url);
    if (isAttached) {
      pendingDeleteRef.current.add(url);
      return { ok: true };
    }

    try {
      await deleteUploadUrl(url);
    } catch (err) {
      return { ok: false, error: toErrorMessage(err) };
    }

    stagedRef.current.delete(url);
    pendingDeleteRef.current.delete(url);
    return { ok: true };
  }, []);

  const commitPendingDeletes = useCallback(async (): Promise<UploadRemoveResult> => {
    pendingDeleteRef.current.clear();
    return { ok: true };
  }, []);

  const discardSession = useCallback(async (currentUrls: readonly string[]) => {
    const current = new Set(currentUrls);
    pendingDeleteRef.current.clear();

    const staged = Array.from(stagedRef.current);
    await Promise.all(
      staged
        .filter((url) => current.has(url))
        .map(async (url) => {
          try {
            await deleteUploadUrl(url);
          } catch {
            // cancel cleanup is best-effort
          }
        }),
    );
    stagedRef.current.clear();
  }, []);

  const finalizeSuccessfulSubmit = useCallback(() => {
    stagedRef.current.clear();
    pendingDeleteRef.current.clear();
  }, []);

  return {
    registerUpload,
    removeUpload,
    commitPendingDeletes,
    discardSession,
    finalizeSuccessfulSubmit,
  };
}

/** SPA 이탈·새로고침 시 staged 업로드를 best-effort로 정리한다. */
export function useDiscardUploadsOnLeave(
  discardSession: (currentUrls: readonly string[]) => Promise<void>,
  getCurrentUrls: () => readonly string[],
): void {
  const discardRef = useRef(discardSession);
  const getUrlsRef = useRef(getCurrentUrls);
  discardRef.current = discardSession;
  getUrlsRef.current = getCurrentUrls;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const runDiscard = () => {
      void discardRef.current(getUrlsRef.current());
    };

    const onPageHide = () => {
      runDiscard();
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      timerRef.current = setTimeout(runDiscard, 0);
    };
  }, []);
}

export function collectImageUrls(
  coverImage: string | null,
  images: readonly string[],
): string[] {
  const urls = new Set<string>(images);
  if (coverImage) {
    urls.add(coverImage);
  }
  return Array.from(urls);
}
