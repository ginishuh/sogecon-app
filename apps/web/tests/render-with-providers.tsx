import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import React, { type PropsWithChildren, type ReactElement } from 'react';

type ExtendedRenderOptions = RenderOptions & {
  queryClientConfig?: QueryClientConfig;
};

function Providers({ children, config }: PropsWithChildren<{ config?: QueryClientConfig }>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
    ...config,
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function renderWithProviders(ui: ReactElement, options?: ExtendedRenderOptions): RenderResult {
  const { queryClientConfig, ...renderOptions } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => <Providers config={queryClientConfig}>{children}</Providers>,
    ...renderOptions,
  });
}
