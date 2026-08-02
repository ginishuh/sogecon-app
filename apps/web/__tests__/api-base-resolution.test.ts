import { describe, expect, it } from 'vitest';

import { resolveApiBase } from '../lib/api';

describe('API base selection', () => {
  it('uses server-only API_INTERNAL_URL on the server', () => {
    expect(resolveApiBase({
      publicBase: 'https://api.example.com',
      internalBase: 'http://api:3001',
      isBrowser: false,
      nodeEnv: 'production',
    })).toBe('http://api:3001');
  });

  it('always uses the public build-time URL in the browser', () => {
    expect(resolveApiBase({
      publicBase: 'https://api.example.com',
      internalBase: 'http://api:3001',
      isBrowser: true,
      nodeEnv: 'production',
      currentHostname: 'alumni.example.com',
    })).toBe('https://api.example.com');
  });

  it('normalizes trailing slashes without changing the server/browser split', () => {
    expect(resolveApiBase({
      publicBase: 'https://api.example.com///',
      internalBase: 'http://api:3001///',
      isBrowser: false,
      nodeEnv: 'production',
    })).toBe('http://api:3001');
    expect(resolveApiBase({
      publicBase: 'https://api.example.com///',
      internalBase: 'http://api:3001///',
      isBrowser: true,
      nodeEnv: 'production',
    })).toBe('https://api.example.com');
  });

  it('does not invent a production localhost fallback', () => {
    expect(() => resolveApiBase({
      publicBase: '',
      isBrowser: false,
      nodeEnv: 'production',
    })).toThrow('NEXT_PUBLIC_WEB_API_BASE');
  });

  it('keeps current-host and localhost fallback behavior limited to dev/test', () => {
    expect(resolveApiBase({
      publicBase: 'http://localhost:3001',
      isBrowser: true,
      nodeEnv: 'development',
      currentHostname: '192.0.2.20',
    })).toBe('http://192.0.2.20:3001');
    expect(resolveApiBase({
      publicBase: '',
      isBrowser: false,
      nodeEnv: 'test',
    })).toBe('http://localhost:3001');
  });

  it('does not rewrite loopback public URLs in production', () => {
    expect(resolveApiBase({
      publicBase: 'http://127.0.0.1:3001',
      isBrowser: true,
      nodeEnv: 'production',
      currentHostname: '192.0.2.20',
    })).toBe('http://127.0.0.1:3001');
  });
});
