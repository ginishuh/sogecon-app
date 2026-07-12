type MockSession = 'member' | 'admin';

export async function configureMockServer(session: MockSession): Promise<void> {
  const controlUrl = process.env.E2E_MOCK_API_CONTROL_URL;
  if (!controlUrl) return;

  const response = await fetch(`${controlUrl.replace(/\/$/, '')}/__e2e/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  if (!response.ok) {
    throw new Error(`E2E mock API reset failed: HTTP ${response.status}`);
  }
}
