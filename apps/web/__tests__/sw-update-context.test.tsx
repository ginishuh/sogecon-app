import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  SwUpdateProvider,
  useSwUpdate,
  setWaitingWorker
} from '../app/contexts/sw-update-context';

describe('SwUpdateContext', () => {
  beforeEach(() => {
    setWaitingWorker(null);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SwUpdateProvider>{children}</SwUpdateProvider>
  );

  it('Provider 없이 useSwUpdate 호출 시 에러 발생', () => {
    // 에러 로그 억제
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useSwUpdate());
    }).toThrow('useSwUpdate must be used within SwUpdateProvider');

    consoleSpy.mockRestore();
  });

  it('초기 상태: updateAvailable=false, bannerDismissed=false', () => {
    const { result } = renderHook(() => useSwUpdate(), { wrapper });

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.bannerDismissed).toBe(false);
  });

  it('setUpdateAvailable로 업데이트 상태 변경', () => {
    const { result } = renderHook(() => useSwUpdate(), { wrapper });

    act(() => {
      result.current.setUpdateAvailable(true);
    });

    expect(result.current.updateAvailable).toBe(true);
  });

  it('dismissBanner로 배너 닫힘 상태 변경', () => {
    const { result } = renderHook(() => useSwUpdate(), { wrapper });

    act(() => {
      result.current.dismissBanner();
    });

    expect(result.current.bannerDismissed).toBe(true);
  });

  it('applyUpdate: waitingWorker가 있으면 SKIP_WAITING 메시지 전송', () => {
    const mockPostMessage = vi.fn();
    const mockWorker = { postMessage: mockPostMessage } as unknown as ServiceWorker;
    setWaitingWorker(mockWorker);

    const { result } = renderHook(() => useSwUpdate(), { wrapper });

    act(() => {
      result.current.applyUpdate();
    });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('applyUpdate: waitingWorker가 없으면 아무 동작 안 함', () => {
    setWaitingWorker(null);

    const { result } = renderHook(() => useSwUpdate(), { wrapper });

    // 에러 없이 호출 가능
    expect(() => {
      act(() => {
        result.current.applyUpdate();
      });
    }).not.toThrow();
  });

  it('setWaitingWorker로 워커 참조 설정 가능', () => {
    const mockPostMessage = vi.fn();
    const mockWorker = { postMessage: mockPostMessage } as unknown as ServiceWorker;

    // 워커 설정
    setWaitingWorker(mockWorker);

    const { result } = renderHook(() => useSwUpdate(), { wrapper });

    act(() => {
      result.current.applyUpdate();
    });

    expect(mockPostMessage).toHaveBeenCalled();

    // 워커 해제
    setWaitingWorker(null);
    mockPostMessage.mockClear();

    act(() => {
      result.current.applyUpdate();
    });

    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});
