import { getRsvpExperience, hasPublicDirectoryDetails, VISIBILITY_INFO } from '../lib/member-experience';
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
  });
});
