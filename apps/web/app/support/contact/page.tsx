"use client";

import { useState } from 'react';
import { useToast } from '../../../components/toast';
import { submitContact } from '../../../services/support';

export default function SupportContactPage() {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submitContact({ subject, body, contact: contact || undefined });
      toast.show('문의가 접수되었습니다.', { type: 'success' });
      setSubject(''); setBody(''); setContact('');
    } catch {
      toast.show('문의 접수 중 오류가 발생했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">관리자 문의</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm">제목
          <input className="mt-1 w-full rounded border px-3 py-2" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="text-sm">내용
          <textarea className="mt-1 w-full rounded border px-3 py-2" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <label className="text-sm">연락처(선택)
          <input className="mt-1 w-full rounded border px-3 py-2" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="이메일/전화 등" />
        </label>
        <button disabled={busy} className="rounded bg-state-success px-4 py-2 text-white disabled:opacity-50">보내기</button>
      </form>
    </div>
  );
}

