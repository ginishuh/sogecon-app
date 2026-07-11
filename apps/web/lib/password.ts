export const BCRYPT_MAX_PASSWORD_BYTES = 72;
export const PASSWORD_TOO_LONG_MESSAGE = '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.';

export function isPasswordWithinBcryptLimit(password: string): boolean {
  return new TextEncoder().encode(password).byteLength <= BCRYPT_MAX_PASSWORD_BYTES;
}
