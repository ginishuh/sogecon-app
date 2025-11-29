import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SwUpdateBanner } from '../components/sw-update-banner';
import { SwUpdateProvider, setWaitingWorker, useSwUpdate } from '../app/contexts/sw-update-context';

// 테스트용 컴포넌트: Context 조작 가능
function TestComponent({ initialUpdate }: { initialUpdate: boolean }) {
  const { setUpdateAvailable } = useSwUpdate();

  React.useEffect(() => {
    if (initialUpdate) {
      setUpdateAvailable(true);
    }
  }, [initialUpdate, setUpdateAvailable]);

  return <SwUpdateBanner />;
}

// 테스트용 래퍼: Provider와 함께 배너 렌더링
function renderWithProvider(initialUpdate = false) {
  const result = render(
    <SwUpdateProvider>
      <TestComponent initialUpdate={initialUpdate} />
    </SwUpdateProvider>
  );

  return result;
}

describe('SwUpdateBanner', () => {
  beforeEach(() => {
    // waitingWorker 초기화
    setWaitingWorker(null);
  });

  it('업데이트가 없으면 배너를 표시하지 않음', () => {
    renderWithProvider(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('업데이트가 있으면 배너를 표시함', () => {
    renderWithProvider(true);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('새 버전이 있습니다.')).toBeInTheDocument();
  });

  it('새로고침 버튼이 표시됨', () => {
    renderWithProvider(true);
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
  });

  it('닫기 버튼이 표시됨', () => {
    renderWithProvider(true);
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 시 배너가 사라짐', () => {
    renderWithProvider(true);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('새로고침 버튼 클릭 시 waitingWorker에 메시지 전송', () => {
    const mockPostMessage = vi.fn();
    const mockWorker = { postMessage: mockPostMessage } as unknown as ServiceWorker;
    setWaitingWorker(mockWorker);

    renderWithProvider(true);
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('waitingWorker가 없으면 새로고침 버튼 클릭해도 에러 없음', () => {
    setWaitingWorker(null);
    renderWithProvider(true);

    // 에러 없이 클릭 가능
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    }).not.toThrow();
  });

  it('접근성: role=alert과 aria-live=polite 속성이 있음', () => {
    renderWithProvider(true);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });
});
