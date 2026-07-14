import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminAuthState } from '../components/admin-auth-state';

describe('AdminAuthState', () => {
  it.each([
    ['loading', '관리자 권한을 확인하고 있습니다.'],
    ['error', '로그인 상태를 확인하지 못했습니다.'],
    ['unauthorized', '관리자 로그인이 필요합니다.'],
  ] as const)('%s 상태에 맞는 사용자 문구를 표시한다', (status, message) => {
    render(<AdminAuthState status={status} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
