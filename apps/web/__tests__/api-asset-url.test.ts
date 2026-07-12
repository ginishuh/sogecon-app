import { describe, expect, it } from 'vitest';

import { API_BASE, resolveApiAssetUrl } from '../lib/api';

describe('API 이미지 URL', () => {
  it('API media 상대 경로에 API base를 붙인다', () => {
    expect(resolveApiAssetUrl('/media/images/example.png')).toBe(`${API_BASE}/media/images/example.png`);
  });

  it('절대 URL과 Web 정적 이미지 경로는 유지한다', () => {
    expect(resolveApiAssetUrl('https://cdn.example.com/example.png')).toBe('https://cdn.example.com/example.png');
    expect(resolveApiAssetUrl('/images/home/hero.svg')).toBe('/images/home/hero.svg');
  });
});
