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
    description: '동문 수첩에는 이름과 기수만 보이고, 연락처는 잠겨 있어요. 가입과 로그인은 그대로 이용할 수 있어요.',
  },
};

export const DIRECTORY_DISCLOSURE_ITEMS = [
  '이름, 기수, 전공',
  '직장, 부서, 직책, 업종',
  '휴대전화, 이메일',
  '개인 주소, 직장 주소',
] as const;

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
