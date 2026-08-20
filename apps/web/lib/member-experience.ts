import type { Member } from '../services/members';
import type { RSVP } from '../services/rsvps';

export const VISIBILITY_INFO: Record<Member['visibility'], { label: string; description: string }> = {
  all: {
    label: '모든 동문에게 공개',
    description: '로그인한 모든 동문이 공개된 연락처와 소속 정보를 볼 수 있어요.',
  },
  cohort: {
    label: '같은 기수에게만 공개',
    description: '같은 기수 동문에게만 공개된 연락처와 소속 정보를 보여줘요.',
  },
  private: {
    label: '나만 보기',
    description: '불특정 동문에게는 이름과 기수만 보여요. 보기 요청을 허용한 동문에게만 상세가 열리고, 허용은 같은 화면에서 언제든 취소할 수 있어요.',
  },
};

export const DIRECTORY_DISCLOSURE_ITEMS = [
  '이름, 기수, 전공',
  '직장, 부서, 직책, 업종',
  '휴대전화, 이메일',
  '개인 주소, 직장 주소',
] as const;

export function individualGrantNotice(name: string, cohort: number): {
  title: string;
  purpose: string;
  items: readonly string[];
  period: string;
  refusal: string;
} {
  return {
    title: `${name}(${cohort}기)에게 내 동문 수첩 상세정보를 제공합니다.`,
    purpose: '목적: 동문 간 연락',
    items: DIRECTORY_DISCLOSURE_ITEMS,
    period: '기간: 허용 취소 또는 탈퇴 시까지',
    refusal:
      '동의를 거부할 수 있습니다. 거부해도 가입·로그인과 다른 서비스 이용에는 불이익이 없고, 이 요청자에게 수첩 상세정보만 공개되지 않습니다.',
  };
}

export type RsvpExperience = {
  label: string;
  description: string;
  participating: boolean;
};

export function getRsvpExperience(status: RSVP['status'] | null | undefined): RsvpExperience {
  if (status === 'going') {
    return { label: '참여 신청 완료', description: '행사 참여 명단에 등록되어 있어요.', participating: true };
  }
  if (status === 'waitlist') {
    return { label: '대기 중', description: '자리가 나면 참여 순서에 따라 안내해 드려요.', participating: true };
  }
  return { label: '아직 신청하지 않았어요', description: '아래 버튼에서 행사 참여를 신청할 수 있어요.', participating: false };
}

export function hasPublicDirectoryDetails(member: Member): boolean {
  if (member.details_visible === false) {
    return false;
  }
  return Boolean(
    member.email || member.phone || member.company || member.department || member.job_title ||
      member.industry || member.addr_personal || member.addr_company,
  );
}

export function canRequestDirectoryView(member: Member): boolean {
  return member.details_visible === false && member.view_request !== 'pending' && member.view_request !== 'accepted';
}
