/**
 * 날짜 포맷팅 유틸리티 함수
 */

/**
 * 게시판 목록용 간단한 날짜 포맷 (MM/DD)
 */
export function formatBoardDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const formatted = date.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit'
  });

  // "01. 15." → "01/15"
  return formatted.replace(/\. /g, '/').replace(/\.$/, '');
}

/**
 * 게시글 상세/댓글용 전체 날짜 포맷 (YYYY년 MM월 DD일 HH:MM)
 */
export function formatFullDate(dateString: string | null | undefined): string {
  if (!dateString) return '게시 예정';

  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
