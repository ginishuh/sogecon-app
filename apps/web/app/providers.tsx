"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ToastProvider } from '../components/toast';
import { SwUpdateProvider } from './contexts/sw-update-context';
import { ServiceWorkerRegister } from './sw-register';
import { SwUpdateBanner } from '../components/sw-update-banner';

export function Providers({ children }: { children: ReactNode }) {
  // QueryClient는 클라이언트에서 1회 생성
  const [client] = useState(() => new QueryClient());
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
