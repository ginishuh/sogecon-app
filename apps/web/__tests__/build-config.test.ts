import { describe, expect, it } from 'vitest';

// next.config.js loads this small CommonJS module directly during `next build`.
import { validateProductionWebApiBase } from '../lib/build-config';

describe('production Web API build configuration', () => {
  it.each([undefined, '', '   '])('rejects missing or blank API base: %j', (apiBase) => {
    expect(() => validateProductionWebApiBase({ apiBase })).toThrow('NEXT_PUBLIC_WEB_API_BASE');
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

  it.each(['http://localhost:3001', 'http://127.0.0.1:3001', 'http://[::1]:3001'])('accepts explicit HTTP loopback escape: %s', (apiBase) => {
    expect(validateProductionWebApiBase({ apiBase, allowInsecureLocalApi: '1' })).toBe(apiBase);
  });

  it.each(['http://api.example.com:3001', 'http://192.0.2.10:3001'])('rejects arbitrary-host HTTP even with escape: %s', (apiBase) => {
    expect(() => validateProductionWebApiBase({ apiBase, allowInsecureLocalApi: '1' })).toThrow('loopback');
  });
});
