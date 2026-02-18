"use client";

import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { AdminPermissionToken } from '../lib/rbac';
import { hasPermissionSession } from '../lib/rbac';

type Props = {
  permission: AdminPermissionToken;
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequirePermission({ permission, children, fallback }: Props) {
  const { status, data } = useAuth();

  if (status === 'loading') return null;
  if (status === 'authorized' && hasPermissionSession(data, permission)) {
    return <>{children}</>;
  }
  if (fallback !== undefined) return <>{fallback}</>;
  return null;
}
