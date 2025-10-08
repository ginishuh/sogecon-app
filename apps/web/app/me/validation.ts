export type ProfileVisibility = 'all' | 'cohort' | 'private';

export type ProfileForm = {
  name: string;
  major: string;
  visibility: ProfileVisibility;
  birth_date: string;
  birth_lunar: boolean;
  phone: string;
  company: string;
  department: string;
  job_title: string;
  company_phone: string;
  addr_personal: string;
  addr_company: string;
  industry: string;
};

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>> & {
  form?: string;
};

export type ProfilePayload = {
  name: string;
  major: string | null;
  visibility: ProfileVisibility;
  birth_date: string | null;
  birth_lunar: boolean;
  phone: string | null;
  company: string | null;
  department: string | null;
  job_title: string | null;
  company_phone: string | null;
  addr_personal: string | null;
  addr_company: string | null;
  industry: string | null;
};

const PHONE_PATTERN = /^[0-9+\-\s]{7,20}$/;

const LENGTH_RULES: Record<
  'department' | 'job_title' | 'addr_personal' | 'addr_company' | 'industry',
  { min: number; max: number; message: string }
> = {
  department: { min: 1, max: 80, message: '부서는 1~80자 이내로 입력해주세요.' },
  job_title: { min: 1, max: 80, message: '직함은 1~80자 이내로 입력해주세요.' },
  addr_personal: {
    min: 1,
    max: 200,
    message: '개인 주소는 1~200자 이내로 입력해주세요.',
  },
  addr_company: {
    min: 1,
    max: 200,
    message: '회사 주소는 1~200자 이내로 입력해주세요.',
  },
  industry: { min: 1, max: 60, message: '업종은 1~60자 이내로 입력해주세요.' },
};

const PHONE_ERROR =
  '전화번호는 숫자, +, -, 공백으로만 7~20자 입력해주세요.';

export function validateProfileForm(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {};

  if (!form.name.trim()) {
    errors.name = '이름을 입력해주세요.';
  }

  const phone = form.phone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = PHONE_ERROR;
  }

  const companyPhone = form.company_phone.trim();
  if (companyPhone && !PHONE_PATTERN.test(companyPhone)) {
    errors.company_phone = PHONE_ERROR;
  }

  (Object.keys(LENGTH_RULES) as Array<keyof typeof LENGTH_RULES>).forEach(
    (key) => {
      const value = form[key].trim();
      if (!value) return;
      const rule = LENGTH_RULES[key];
      const { min, max, message } = rule;
      const length = value.length;
      if (length < min || length > max) {
        errors[key] = message;
      }
    }
  );

  return errors;
}

const optional = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export function buildProfilePayload(form: ProfileForm): ProfilePayload {
  return {
    name: form.name.trim(),
    major: optional(form.major),
    visibility: form.visibility,
    birth_date: optional(form.birth_date),
    birth_lunar: !!form.birth_lunar,
    phone: optional(form.phone),
    company: optional(form.company),
    department: optional(form.department),
    job_title: optional(form.job_title),
    company_phone: optional(form.company_phone),
    addr_personal: optional(form.addr_personal),
    addr_company: optional(form.addr_company),
    industry: optional(form.industry),
  };
}
