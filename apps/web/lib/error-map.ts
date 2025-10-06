// API 오류 코드 → UX 메시지 매핑(간단 버전)

export function apiErrorToMessage(code?: string, fallback?: string): string {
  switch (code) {
    case 'member_not_found':
      return '회원 정보를 찾을 수 없습니다.';
    case 'member_exists':
      return '이미 등록된 회원입니다.';
    case 'post_not_found':
      return '게시글을 찾을 수 없습니다.';
    case 'event_not_found':
      return '행사를 찾을 수 없습니다.';
    case 'rsvp_not_found':
      return 'RSVP 정보가 없습니다.';
    case 'rsvp_exists':
      return '이미 RSVP가 존재합니다.';
    default:
      return fallback ?? '요청 처리 중 오류가 발생했습니다.';
  }
}

