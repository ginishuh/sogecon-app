"use client";

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { login } from '../services/auth';
import { ApiError } from '../lib/api';
import { useToast } from './toast';
import { useAuth } from '../hooks/useAuth';

export function LoginInline({ onSuccess }: { onSuccess?: () => void }) {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const { show } = useToast();
  const { invalidate } = useAuth();

  const mut = useMutation({
    mutationFn: () => login({ student_id: studentId, password }),
    onSuccess: async () => {
      await invalidate();
      show('로그인되었습니다.', { type: 'success' });
      onSuccess?.();
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? '로그인 실패' : '알 수 없는 오류';
      show(msg, { type: 'error' });
    }
  });

  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
      <label className="text-xs text-neutral-muted">
        학번
        <input
          className="mt-1 w-full rounded border border-neutral-border px-2 py-1"
          value={studentId}
          onChange={(e) => setStudentId(e.currentTarget.value)}
          inputMode="numeric"
          autoComplete="username"
        />
      </label>
      <label className="text-xs text-neutral-muted">
        비밀번호
        <input
          className="mt-1 w-full rounded border border-neutral-border px-2 py-1"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          autoComplete="current-password"
        />
      </label>
      <button
        type="submit"
        className="mt-1 rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
        disabled={mut.isPending || !studentId || !password}
      >
        로그인
      </button>
    </form>
  );
}

