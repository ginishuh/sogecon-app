import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import React from 'react';

import { SiteHeader } from '../../components/site-header';
import { ToastProvider } from '../../components/toast';

export function renderSiteHeaderWithProviders(): void {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SiteHeader />
      </ToastProvider>
    </QueryClientProvider>
  );
}
