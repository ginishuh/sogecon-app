import {
  buildProfilePayload,
  ProfileForm,
  validateProfileForm,
} from '../app/me/validation';

const createForm = (override: Partial<ProfileForm> = {}): ProfileForm => ({
  email: '',
  major: '',
  visibility: 'all',
  birth_date: '',
  birth_lunar: false,
  phone: '',
  company: '',
  department: '',
  job_title: '',
  company_phone: '',
  addr_personal: '',
  addr_company: '',
  industry: '',
  ...override,
});

describe('validateProfileForm', () => {
  it('returns empty errors for valid optional inputs', () => {
    const errors = validateProfileForm(
      createForm({
        department: '연구조직',
        job_title: '수석 연구원',
        addr_personal: '서울특별시 마포구 어딘가 123',
        addr_company: '서울특별시 종로구 회사빌딩 20층',
        industry: '제조',
        phone: '010-1234-5678',
        company_phone: '02-1234-5678',
      })
    );
    expect(errors).toEqual({});
  });

  it('flags invalid phone numbers and length violations', () => {
    const invalidPhone = validateProfileForm(createForm({ phone: 'abc12345' }));
    expect(invalidPhone.phone).toBe(
      '전화번호는 숫자, +, -, 공백으로만 7~20자 입력해주세요.'
    );

    const longDepartment = validateProfileForm(
      createForm({ department: 'x'.repeat(81) })
    );
    expect(longDepartment.department).toBe(
      '부서는 1~80자 이내로 입력해주세요.'
    );
  });
});

describe('buildProfilePayload', () => {
  it('trims values and converts blanks to null', () => {
    const payload = buildProfilePayload(
      createForm({
        email: '  user@example.com  ',
        major: '  경영학  ',
        phone: ' 010-1234-5678 ',
        company_phone: '  ',
        department: '  ',
        addr_personal: ' ',
        industry: ' 제조 ',
      })
    );

    expect(payload.email).toBe('user@example.com');
    expect(payload.major).toBe('경영학');
    expect(payload.phone).toBe('010-1234-5678');
    expect(payload.company_phone).toBeNull();
    expect(payload.department).toBeNull();
    expect(payload.addr_personal).toBeNull();
    expect(payload.industry).toBe('제조');
    expect(payload.birth_date).toBeNull();
    expect(payload.birth_lunar).toBe(false);
  });
});
