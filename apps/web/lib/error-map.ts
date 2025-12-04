// API 오류 코드 → UX 메시지 매핑

const ERROR_MESSAGES: Record<string, string> = {
  // 인증 관련
  login_failed: '학번 또는 비밀번호가 올바르지 않습니다.',
  admin_member_record_missing: '관리자 계정에 회원 정보가 없습니다. 관리자에게 문의하세요.',
  unauthorized: '로그인이 필요합니다.',

  // 회원 관련
  member_not_found: '회원 정보를 찾을 수 없습니다.',
  member_exists: '이미 등록된 회원입니다.',

  // 게시글/행사 관련
  post_not_found: '게시글을 찾을 수 없습니다.',
  event_not_found: '행사를 찾을 수 없습니다.',
  rsvp_not_found: 'RSVP 정보가 없습니다.',
  rsvp_exists: '이미 RSVP가 존재합니다.',
};

export function apiErrorToMessage(code?: string, fallback?: string): string {
  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return fallback ?? '요청 처리 중 오류가 발생했습니다.';
}

