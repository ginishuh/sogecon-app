import { type ReactNode } from 'react';
import { AuthGuard } from '../../components/auth-guard';

export default function BoardLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
