/**
 * 요청 단위로 CSP nonce를 생성한다. 128비트 난수를 base64로 변환해 사용한다.
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // btoa는 문자열 인자를 요구하므로 바이트를 단일 문자열로 직렬화한다.
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}
