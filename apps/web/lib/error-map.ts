import { MEMBER_LANGUAGE, OFFICE_CONTACT_MESSAGE } from './member-language';

// API 오류 코드 → UX 메시지 매핑. 내부 코드는 화면에 직접 노출하지 않는다.

const ERROR_MESSAGES: Record<string, string> = {
  // 인증 관련
  login_failed: '학번 또는 비밀번호가 올바르지 않습니다.',
  member_pending_approval: `${MEMBER_LANGUAGE.officeName}에서 가입 신청을 확인 중입니다. 승인 안내를 받은 뒤 ${MEMBER_LANGUAGE.activation}을 진행해 주세요.`,
  member_not_active: `아직 이용할 수 없는 계정입니다. ${OFFICE_CONTACT_MESSAGE}`,
  admin_member_record_missing: `운영자 계정에 연결된 회원 정보가 없습니다. ${OFFICE_CONTACT_MESSAGE}`,
  unauthorized: '로그인이 필요합니다.',
  invalid_or_expired_reset_token: '재설정 링크가 올바르지 않거나 사용 기한이 지났습니다. 비밀번호 찾기를 다시 요청해 주세요.',
  admin_permission_required: '이 작업을 수행할 운영 권한이 없습니다.',
  super_admin_required: '최고 운영자 권한이 필요합니다.',

  // 회원 관련
  member_not_found: '회원 정보를 찾을 수 없습니다.',
  member_exists: '이미 등록된 회원입니다.',
  member_phone_already_in_use: '이미 다른 회원이 사용 중인 전화번호입니다.',
  member_already_active: '이미 첫 로그인 설정을 마친 회원입니다.',
  member_activation_pending: `가입 승인이 이미 완료되었습니다. 안내 메일의 링크로 ${MEMBER_LANGUAGE.activation}을 진행해 주세요. 메일을 받지 못하셨다면 ${OFFICE_CONTACT_MESSAGE}`,
  signup_already_pending: '이미 심사 대기 중인 신청이 있습니다.',
  student_id_required: '학번을 입력해 주세요.',
  signup_request_not_found: '가입신청을 찾을 수 없습니다.',
  signup_request_not_pending: '대기 중인 신청만 처리할 수 있습니다.',
  signup_request_not_approved: `승인된 신청만 ${MEMBER_LANGUAGE.activationCode}를 다시 발급할 수 있습니다.`,
  email_not_configured: '안내 메일을 보낼 준비가 되어 있지 않습니다. 안내문구를 복사해 전달해 주세요.',
  email_send_failed: '안내 메일을 보내지 못했습니다. 잠시 후 다시 시도하거나 안내문구를 복사해 전달해 주세요.',
  email_recipient_missing: '보낼 이메일 주소가 없어 안내 메일을 발송하지 못했습니다.',
  signup_member_exists: '이미 가입된 회원이 있습니다. 같은 분이면 이 신청은 반려해 주세요.',
  signup_member_student_id_variant: '학번 표기만 다른 기존 회원 정보가 있어 승인할 수 없습니다. 같은 분인지 확인해 주세요.',
  signup_member_account_exists: '이 학번으로 이미 만들어진 계정이 있어 일반 가입 승인으로 처리할 수 없습니다. 회원 관리에서 처리하고 이 신청은 반려해 주세요.',
  signup_member_email_mismatch: '기존 회원 정보의 이메일과 신청 이메일이 다릅니다. 회원 관리에서 본인 확인 후 이메일을 정정한 뒤 다시 승인해 주세요.',
  signup_email_in_use: '신청 이메일을 이미 다른 회원이 사용하고 있습니다. 같은 분인지 확인한 뒤 이 신청을 반려해 주세요.',
  signup_approve_conflict: '다른 회원 정보와 학번 또는 이메일이 겹쳐 승인하지 못했습니다. 목록을 새로 고친 뒤 확인해 주세요.',

  // 게시글/행사 관련
  post_not_found: '게시글을 찾을 수 없습니다.',
  post_owner_required: '작성자 본인의 게시판 글만 수정하거나 삭제할 수 있습니다.',
  board_category_immutable: '게시글의 공개 범위를 바꾸는 카테고리 변경은 할 수 없습니다.',
  event_not_found: '행사를 찾을 수 없습니다.',
  hero_item_not_found: '배너를 찾을 수 없습니다.',
  rsvp_not_found: '행사 신청 내역이 없습니다.',
  rsvp_exists: '이미 행사에 신청했습니다.',

  // 관리자 권한 변경 관련
  admin_user_not_found: '관리자 계정을 찾을 수 없습니다.',
  admin_user_already_exists: '이미 관리자 계정이 존재합니다.',
  admin_user_create_conflict: '관리자 계정 생성 중 충돌이 발생했습니다.',
  member_email_already_in_use: '이미 다른 회원이 사용 중인 이메일입니다.',
  member_email_mismatch: '기존 회원 정보의 이메일과 입력값이 다릅니다.',
  profile_change_already_pending: '이미 대기 중인 변경 요청이 있습니다.',
  profile_change_not_pending: '대기 중인 요청만 처리할 수 있습니다.',
  profile_change_same_value: '현재 값과 동일한 값으로는 변경할 수 없습니다.',
  profile_change_request_not_found: '변경 요청을 찾을 수 없습니다.',
  profile_change_invalid_cohort: '기수는 숫자로 입력해주세요.',
  roles_empty: '운영 권한을 하나 이상 선택해 주세요.',
  admin_grade_required: '운영자 또는 최고 운영자 권한이 필요합니다.',
  self_demotion_forbidden: '자신의 최고 운영자 권한은 제거할 수 없습니다.',
  last_super_admin_forbidden: '마지막 최고 운영자의 권한은 제거할 수 없습니다.',
  view_request_self_not_allowed: '본인 정보는 요청 없이 확인할 수 있습니다.',
  view_request_not_needed: '이미 공개된 정보입니다.',
  view_request_already_pending: '이미 보기 요청을 보냈습니다.',
  view_request_not_found: '보기 요청을 찾을 수 없습니다.',
  view_request_not_pending: '대기 중인 요청만 처리할 수 있습니다.',
  view_request_not_accepted: '허용 중인 요청만 철회할 수 있습니다.',
  directory_consent_required: '동문 수첩에 공개하려면 안내에 동의해 주세요.',
};

const INTERNAL_MESSAGE_PATTERN = /(?:\[object Object\]|토큰|\b(?:VAPID|token|role|RBAC|super_admin|error)\b|HTTP\s+\d{3}|^[a-z][a-z0-9_]+$)/i;

function safeFallback(fallback?: string): string | undefined {
  const value = fallback?.trim();
  if (!value || !/[가-힣]/.test(value) || INTERNAL_MESSAGE_PATTERN.test(value)) {
    return undefined;
  }
  return value;
}

export function apiErrorToMessage(code?: string, fallback?: string): string {
  const message = code ? ERROR_MESSAGES[code] : undefined;
  return message ?? fallback ?? '요청 처리 중 오류가 발생했습니다.';
}

export function memberApiErrorToMessage(code?: string, fallback?: string): string {
  const message = code ? ERROR_MESSAGES[code] : undefined;
  return message ?? safeFallback(fallback) ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

// 운영자 화면 전용: 서버 detail에 충돌 회원 학번 같은 다음 행동 정보가 담기는 코드.
const ADMIN_DETAIL_CODES = new Set([
  'signup_member_exists',
  'signup_member_student_id_variant',
  'signup_member_account_exists',
  'signup_member_email_mismatch',
  'signup_email_in_use',
  'signup_approve_conflict',
]);

export function adminApiErrorToMessage(code?: string, detail?: string): string {
  if (code && ADMIN_DETAIL_CODES.has(code)) {
    const safe = safeFallback(detail);
    if (safe) return safe;
  }
  return apiErrorToMessage(code, detail);
}
