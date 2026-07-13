/**
 * 날짜 포맷팅 유틸리티 함수
 * - Intl.DateTimeFormat 사용으로 타임존 일관성 보장
 */

// 한국 타임존 고정 포맷터
const boardDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
});

const fullDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * 게시판 목록용 간단한 날짜 포맷 (MM/DD)
 */
export function formatBoardDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  const formatted = boardDateFormatter.format(date);

  // "01. 15." → "01/15"
  return formatted.replace(/\. /g, '/').replace(/\.$/, '');
}

/**
 * 게시글 상세/댓글용 전체 날짜 포맷 (YYYY년 MM월 DD일 HH:MM)
 */
export function formatFullDate(dateString: string | null | undefined): string {
  if (!dateString) return '게시 예정';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '게시 예정';
  return fullDateFormatter.format(date);
}

/**
 * 관리자 발행 시각을 우선하고, 일반 동문 글은 작성 시각을 사용한다.
 * 손상된 발행 시각이 있으면 유효한 작성 시각으로 안전하게 대체한다.
 */
export function resolvePostDate(
  publishedAt: string | null | undefined,
  createdAt: string | null | undefined,
): string | null {
  for (const candidate of [publishedAt, createdAt]) {
    if (!candidate) continue;
    if (!Number.isNaN(new Date(candidate).getTime())) return candidate;
  }
  return null;
}

export function formatPostBoardDate(
  publishedAt: string | null | undefined,
  createdAt: string | null | undefined,
): string {
  const date = resolvePostDate(publishedAt, createdAt);
  return date ? formatBoardDate(date) : '작성일 미확인';
}

export function formatPostFullDate(
  publishedAt: string | null | undefined,
  createdAt: string | null | undefined,
): string {
  const date = resolvePostDate(publishedAt, createdAt);
  return date ? formatFullDate(date) : '작성일 미확인';
}
