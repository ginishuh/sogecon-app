/**
 * 전화번호 포맷팅 유틸리티
 * DB에는 숫자만 저장 (예: "01089656747"), 표시 시 하이픈 포맷
 */

// [regex, replacement] 패턴 — 위에서부터 첫 매치 적용
const PHONE_FORMATS: ReadonlyArray<[RegExp, string]> = [
  // 휴대폰: 010-XXXX-XXXX
  [/^(01\d)(\d{4})(\d{4})$/, '$1-$2-$3'],
  // 서울 8자리: 02-XXXX-XXXX
  [/^(02)(\d{4})(\d{4})$/, '$1-$2-$3'],
  // 서울 7자리: 02-XXX-XXXX
  [/^(02)(\d{3})(\d{4})$/, '$1-$2-$3'],
  // 지역번호 3자리 + 8자리: 0XX-XXXX-XXXX
  [/^(0\d{2})(\d{4})(\d{4})$/, '$1-$2-$3'],
  // 지역번호 3자리 + 7자리: 0XX-XXX-XXXX
  [/^(0\d{2})(\d{3})(\d{4})$/, '$1-$2-$3'],
];

/**
 * 숫자만 저장된 전화번호를 표시용 하이픈 포맷으로 변환.
 * 매칭되지 않으면 원본 반환.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  for (const [pattern, replacement] of PHONE_FORMATS) {
    if (pattern.test(digits)) {
      return digits.replace(pattern, replacement);
    }
  }

  return raw;
}
