import { getRsvpExperience, hasPublicDirectoryDetails, VISIBILITY_INFO, canRequestDirectoryView, individualGrantNotice, DIRECTORY_DISCLOSURE_ITEMS } from '../lib/member-experience';
import type { Member } from '../services/members';

describe('동문 핵심 여정 사용자 언어', () => {
  it('공개 범위를 내부 값이 아닌 영향 중심 문구로 제공한다', () => {
    expect(VISIBILITY_INFO.all.label).toBe('모든 동문에게 공개');
    expect(VISIBILITY_INFO.cohort.label).toBe('같은 기수에게만 공개');
    expect(VISIBILITY_INFO.private.label).toBe('나만 보기');
  });

  it('미신청과 취소를 신청 가능한 사용자 상태로 합친다', () => {
    expect(getRsvpExperience(null)).toMatchObject({ label: '아직 신청하지 않았어요', participating: false });
    expect(getRsvpExperience('cancel')).toMatchObject({ label: '아직 신청하지 않았어요', participating: false });
    expect(getRsvpExperience('going')).toMatchObject({ label: '참여 신청 완료', participating: true });
    expect(getRsvpExperience('waitlist')).toMatchObject({ label: '대기 중', participating: true });
  });

  it('공개된 상세 정보가 없는 동문을 구분한다', () => {
    const member = { email: '', phone: null, company: null, department: null, job_title: null, industry: null, addr_personal: null, addr_company: null } as Member;
    expect(hasPublicDirectoryDetails(member)).toBe(false);
    expect(hasPublicDirectoryDetails({ ...member, company: '서강기업' })).toBe(true);
    expect(hasPublicDirectoryDetails({ ...member, details_visible: false, company: '서강기업' })).toBe(false);
  });

  it('잠긴 상세는 대기·허용이 아니면 다시 요청할 수 있다', () => {
    const locked = { details_visible: false } as Member;
    expect(canRequestDirectoryView(locked)).toBe(true);
    expect(canRequestDirectoryView({ ...locked, view_request: 'pending' })).toBe(false);
    expect(canRequestDirectoryView({ ...locked, view_request: 'accepted' })).toBe(false);
    expect(canRequestDirectoryView({ ...locked, view_request: 'declined' })).toBe(true);
    expect(canRequestDirectoryView({ ...locked, view_request: 'revoked' })).toBe(true);
  });

  it('개별 허용 고지는 제공 대상·목적·항목·기간·거부권을 적는다', () => {
    expect(individualGrantNotice('홍길동', 61)).toEqual({
      title: '홍길동(61기)에게 내 동문 수첩 상세정보를 제공합니다.',
      purpose: '목적: 동문 간 연락',
      items: DIRECTORY_DISCLOSURE_ITEMS,
      period: '기간: 허용 취소 또는 탈퇴 시까지',
      refusal:
        '동의를 거부할 수 있습니다. 거부해도 가입·로그인과 다른 서비스 이용에는 불이익이 없고, 이 요청자에게 수첩 상세정보만 공개되지 않습니다.',
    });
  });
});
