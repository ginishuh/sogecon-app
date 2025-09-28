import Link from 'next/link';

const apiBase =
  process.env.NEXT_PUBLIC_WEB_API_BASE ?? process.env.WEB_API_BASE ?? 'http://localhost:3001';

async function fetchHealth() {
  try {
    const res = await fetch(`${apiBase}/healthz`, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      return { ok: false, status: res.status };
    }

    const data = (await res.json()) as { ok: boolean };
    return { ok: Boolean(data.ok), status: res.status };
  } catch (error) {
    return { ok: false, status: 503 };
  }
}

export default async function HomePage() {
  const health = await fetchHealth();

  return (
    <section className="space-y-6">
      <p>
        공개 동문 애플리케이션의 홈 화면입니다. 게시글과 행사는 로컬 API에서 제공되며, 추후 인증과
        권한 기능이 추가될 예정입니다.
      </p>
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">API 상태</h2>
        <p className="mt-2 text-sm text-slate-600">
          {health.ok ? '연결됨 ✅' : `연결 안 됨 ⚠️ (status ${health.status})`}
        </p>
        <p className="mt-1 text-xs text-slate-500">기본 엔드포인트: {apiBase}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="rounded border border-slate-200 bg-white p-4 shadow-sm" href="/posts">
          <h3 className="font-semibold">게시글</h3>
          <p className="mt-1 text-sm text-slate-600">공지와 소식을 모아볼 공간입니다.</p>
        </Link>
        <Link className="rounded border border-slate-200 bg-white p-4 shadow-sm" href="/events">
          <h3 className="font-semibold">행사</h3>
          <p className="mt-1 text-sm text-slate-600">정기 모임 및 RSVP 관리를 위한 자리입니다.</p>
        </Link>
      </div>
    </section>
  );
}
