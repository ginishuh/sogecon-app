import { describe, expect, it, vi } from 'vitest';

import { generateNonce } from '../lib/nonce';

describe('generateNonce', () => {
  it('생성된 값은 base64 포맷이며 24자 길이이다', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(nonce.length).toBe(24);
  });

  it('crypto.getRandomValues를 호출한다', () => {
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    generateNonce();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
