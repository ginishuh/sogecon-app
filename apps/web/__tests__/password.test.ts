import { describe, expect, it } from 'vitest';

import { isPasswordWithinBcryptLimit } from '../lib/password';

describe('bcrypt 비밀번호 길이 정책', () => {
  it.each(['a'.repeat(72), '한'.repeat(24)])('UTF-8 72바이트를 허용한다', (password) => {
    expect(isPasswordWithinBcryptLimit(password)).toBe(true);
  });

  it.each(['a'.repeat(73), '한'.repeat(25)])('UTF-8 72바이트 초과를 거부한다', (password) => {
    expect(isPasswordWithinBcryptLimit(password)).toBe(false);
  });
});
