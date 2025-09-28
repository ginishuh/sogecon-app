import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="space-y-6">
      <p>
        서강대학교 경제대학원 총동문회 공개 웹 앱의 초기 홈입니다. 게시글과 행사는 로컬 API에서
        제공되며, 추후 인증과 권한 기능이 추가될 예정입니다.
      </p>
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">API 상태</h2>
        <p className="mt-2 text-sm text-slate-600">
          개발 환경에서는 `make api-dev`로 API 서버를 실행하고, 헬스 체크는 `http://localhost:3001/healthz`
          로 확인할 수 있습니다.
        </p>
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
