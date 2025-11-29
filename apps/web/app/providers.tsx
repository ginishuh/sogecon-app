"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ToastProvider } from '../components/toast';
import { SwUpdateProvider } from './contexts/sw-update-context';
import { ServiceWorkerRegister } from './sw-register';
import { SwUpdateBanner } from '../components/sw-update-banner';

export function Providers({ children }: { children: ReactNode }) {
  // QueryClient는 클라이언트에서 1회 생성
  // 기본 캐싱 설정: staleTime 1분, gcTime 5분, 포커스 시 refetch 비활성화
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  }));
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SwUpdateProvider>
          <ServiceWorkerRegister />
          <SwUpdateBanner />
          {children}
        </SwUpdateProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
