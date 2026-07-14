import type { AuthStatus } from '../hooks/useAuth';

export function AdminAuthState({ status }: { status: AuthStatus }) {
  if (status === 'loading') {
    return <div className="p-6 text-sm text-text-secondary">관리자 권한을 확인하고 있습니다.</div>;
  }
  if (status === 'error') {
    return <div className="p-6 text-sm text-state-error">로그인 상태를 확인하지 못했습니다.</div>;
  }
  if (status === 'unauthorized') {
    return <div className="p-6 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>;
  }
  return null;
}
