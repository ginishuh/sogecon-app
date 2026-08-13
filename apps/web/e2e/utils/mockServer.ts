export type MockSession = 'anonymous' | 'member' | 'admin' | 'admin_hero';

export type MockServerOptions = {
  adminBoardExtraImage?: boolean;
};

export async function configureMockServer(
  session: MockSession,
  options?: MockServerOptions,
): Promise<void> {
  const controlUrl = process.env.E2E_MOCK_API_CONTROL_URL;
  if (!controlUrl) return;

  const response = await fetch(`${controlUrl.replace(/\/$/, '')}/__e2e/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session,
      adminBoardExtraImage: options?.adminBoardExtraImage === true,
    }),
  });
  if (!response.ok) {
    throw new Error(`E2E mock API reset failed: HTTP ${response.status}`);
  }
}
