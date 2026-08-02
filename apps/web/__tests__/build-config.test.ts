import { afterEach, describe, expect, it, vi } from 'vitest';

// next.config.js loads this small CommonJS module directly during `next build`.
import {
  getPublicApiImageRemotePattern,
  validateProductionWebApiBase,
} from '../lib/build-config';

describe('production Web API build configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['', '   '])('rejects a blank API base: %j', (apiBase) => {
    expect(() => validateProductionWebApiBase({ apiBase })).toThrow('NEXT_PUBLIC_WEB_API_BASE');
  });

  it('rejects a missing API base from the process environment', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_API_BASE', '');
    expect(() => validateProductionWebApiBase()).toThrow('NEXT_PUBLIC_WEB_API_BASE');
  });

  it.each(['api.example.com', 'https://', 'ftp://api.example.com'])('rejects malformed/non-absolute URLs: %s', (apiBase) => {
    expect(() => validateProductionWebApiBase({ apiBase })).toThrow();
  });

  it('rejects HTTP production API URLs without the explicit local escape hatch', () => {
    expect(() => validateProductionWebApiBase({
      apiBase: 'http://localhost:3001',
      allowInsecureLocalApi: '',
    })).toThrow();
  });

  it('accepts HTTPS API URLs', () => {
    expect(validateProductionWebApiBase({ apiBase: 'https://api.example.com/v1' })).toBe('https://api.example.com/v1');
  });

  it.each([
    'https://api.example.com?tenant=x',
    'https://api.example.com/#fragment',
    'https://api.example.com?',
    'https://api.example.com#',
    'https://user:pass@api.example.com/v1',
  ])('rejects URL parts that break API path concatenation: %s', (apiBase) => {
    expect(() => validateProductionWebApiBase({ apiBase })).toThrow('NEXT_PUBLIC_WEB_API_BASE');
  });

  it('derives the public API image origin, including an explicit port', () => {
    expect(getPublicApiImageRemotePattern('https://api.example.com:8443/v1')).toEqual({
      protocol: 'https',
      hostname: 'api.example.com',
      port: '8443',
    });
  });

  it.each(['http://localhost:3001', 'http://127.0.0.1:3001', 'http://[::1]:3001'])('accepts explicit HTTP loopback escape: %s', (apiBase) => {
    expect(validateProductionWebApiBase({ apiBase, allowInsecureLocalApi: '1' })).toBe(apiBase);
  });

  it.each(['http://api.example.com:3001', 'http://192.0.2.10:3001'])('rejects arbitrary-host HTTP even with escape: %s', (apiBase) => {
    expect(() => validateProductionWebApiBase({ apiBase, allowInsecureLocalApi: '1' })).toThrow('loopback');
  });
});
