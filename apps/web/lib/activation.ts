import { siteConfig } from './site';

/**
 * 활성화 링크를 생성한다.
 * 클라이언트에서는 window.location.origin을, 서버에서는 siteConfig.url을 기본 base로 사용한다.
 */
export function buildActivationUrl(token: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : siteConfig.url;
  return `${base}/activate?token=${encodeURIComponent(token)}`;
}

/**
 * 수신자에게 전달할 활성화 안내문구를 생성한다.
 */
export function buildActivationMessage(
  name: string,
  studentId: string,
  activationUrl: string,
): string {
  return (
    `[${siteConfig.name}] ${name}(${studentId})님, 가입이 승인되었습니다.\n` +
    `아래 링크에서 비밀번호를 설정해 계정을 활성화해 주세요.\n${activationUrl}`
  );
}
