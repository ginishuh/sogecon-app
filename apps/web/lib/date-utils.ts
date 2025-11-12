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
  return fullDateFormatter.format(date);
}
