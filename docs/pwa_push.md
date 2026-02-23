# PWA 및 Web Push 가이드(모바일 웹 우선)

본 문서는 서강대학교 경제대학원 총동문회 웹앱의 PWA 구성과 Web Push 알림 구현/운영 지침을 정리한다. SMS 채널은 1차 릴리스에서 보류한다.

## 목표
- 모바일 웹 우선 UX 유지: 설치 가능한 PWA, 오프라인 스켈레톤, 빠른 LCP/INP.
- Web Push를 공지/행사 알림의 1차 채널로 제공(사용자 옵트인 기반).
- 안전한 키/구독 관리와 대량 발송 안정성 확보.

## 구성 요소
- 매니페스트: `apps/web/public/manifest.json`
- 서비스워커: `apps/web/public/sw.js`(또는 next-pwa 커스텀 서비스워커)
- 구독 등록 UI: `apps/web/app/sw-register.tsx`
- 구독 저장/발송 API: `apps/api/routers/notifications.py`(신규)
- 구독 저장소: `push_subscription` 테이블(아래 모델 참조)

## 환경 변수
```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:security@trr.co.kr
# at-rest encryption (optional; prod only)
PUSH_ENCRYPT_AT_REST=false
PUSH_KEK=  # base64-encoded 16/24/32-byte key (recommend 32B)
```

## VAPID 키 생성

VAPID 키 쌍은 프로젝트마다 1회 생성하여 환경변수에 등록한다.

### 방법 1 — Node.js (권장)
```bash
npx web-push generate-vapid-keys
```

### 방법 2 — Python (.venv에서)
```bash
python -c "
import base64
from cryptography.hazmat.primitives.asymmetric import ec

priv = ec.generate_private_key(ec.SECP256R1())
priv_raw = priv.private_numbers().private_value.to_bytes(32, 'big')
pub = priv.public_key().public_numbers()
pub_raw = b'\x04' + pub.x.to_bytes(32, 'big') + pub.y.to_bytes(32, 'big')

print('Public :', base64.urlsafe_b64encode(pub_raw).rstrip(b'=').decode())
print('Private:', base64.urlsafe_b64encode(priv_raw).rstrip(b'=').decode())
"
```

### 생성 후 환경변수 매핑

| 생성 값 | 파일 | 변수명 |
|---------|------|--------|
| Public Key | `.env` / `.env.api` | `VAPID_PUBLIC_KEY` |
| Private Key | `.env` / `.env.api` | `VAPID_PRIVATE_KEY` |
| Public Key (동일) | `apps/web/.env.local` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |

`VAPID_SUBJECT`는 `mailto:` 형식의 연락처 이메일을 입력한다(기본값: `mailto:security@trr.co.kr`).

at-rest 암호화용 `PUSH_KEK`가 필요한 경우: `openssl rand -base64 32`

## 데이터 모델(초안)
- `push_subscription`
  - `id` (PK)
  - `member_id` (FK → member.id)
  - `endpoint` (text; optionally encrypted with `enc:v1:` prefix)
  - `endpoint_hash` (SHA-256, unique; 암호화 여부와 무관하게 결정적 조회 키)
  - `p256dh` (text)
  - `auth` (text)
  - `ua` (text, optional)
  - `created_at`, `last_seen_at`, `revoked_at`
- `notification_preference`
  - `member_id`, `channel='webpush'`, `topic`(notice,event,comment 등), `enabled`(bool)

## API 스펙(초안)
- `POST /notifications/subscriptions`
  - req: `{ endpoint, keys: { p256dh, auth }, ua? }`
  - res: `204 No Content`
- `DELETE /notifications/subscriptions`
  - req: `{ endpoint }`
  - res: `204 No Content`
- `POST /notifications/admin/notifications/send` (운영자)
  - req: `{ title, body, url? }`
  - res: `{ accepted: number, failed: number }`
- `POST /notifications/admin/notifications/prune-logs` (운영자)
  - req: `{ older_than_days?: number }` (기본 30)
  - res: `{ deleted: number, before: string, older_than_days: number }`
- `GET /notifications/admin/notifications/stats` (운영자)
  - query: `?range=24h|7d|30d` (기본 7d)
  - res: `{ active_subscriptions, recent_accepted, recent_failed, encryption_enabled, range, failed_404?, failed_410?, failed_other? }`

## 프런트엔드 구현 절차
1. 매니페스트에 아이콘(192/512)과 `display: 'standalone'`, `start_url` 정의.
2. `sw-register.tsx`에서 서비스워커 등록 → `Notification.requestPermission()`은 온보딩 CTA(예: "행사 알림 받기")에서만 호출.
3. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })` 수행 후 구독을 API로 전송.
4. 권한이 `denied`이면 재시도 버튼/가이드(브라우저 설정 열기)를 제공.
5. 서비스워커 `push` 이벤트에서 `showNotification(title, { body, icon, data: { url, tag } })` 처리. `notificationclick`에서 `clients.openWindow(data.url ?? '/')`.
6. 개발환경에서는 SW를 기본 비활성(dev RSC 안정화). 필요 시 `NEXT_PUBLIC_ENABLE_SW=1`로 강제 등록.
7. Admin UI(`/admin/notifications`): 알림 발송·요약(기간 필터)·최근 로그·로그 정리(prune) 제공.

## 백엔드 구현 절차
1. `pywebpush`(또는 동등 라이브러리)로 VAPID 서명 발송 구현.
2. 구독 저장/삭제 라우터 추가(`routers/notifications.py`).
3. 실패 응답(404/410) 시 구독 자동 폐기. 연속 실패 카운트 임계치 초과 시 비활성화.
4. APScheduler(혹은 워커)로 예약 발송(D-3/D-1) 큐 실행. 배치 크기/재시도/백오프 설정.
5. 운영자 알림 발송 API 제공.
6. (선택) at-rest 암호화 활성화: `PUSH_ENCRYPT_AT_REST=true`, `PUSH_KEK` 설정. 저장 시 endpoint/p256dh/auth를 AES-GCM으로 암호화하고, 해시(`endpoint_hash`)로 조회·삭제.

## 권한·UX 원칙
- 옵트인: 기본 비활성. 사용자 의식적 동의 후 구독 저장.
- 주기적 검증: 30일 이상 미사용 구독 점검, 죽은 구독 정리.
- 접근성: 알림 설명은 간결한 한국어 카피 + 스크린리더 레이블 포함.

## 성능·안정성 가드
- 레이트리밋: 구독 등록/삭제 5 req/min/account, 발송 API 6 req/min/operator(10초 간격, 대량 발송은 내부 큐).
- 모니터링: 발송 성공률, 4xx/5xx 비율 대시보드.
- 키 순환: 분기 1회 권장. 공개키 롤링 동안 구독 재발급 유도 배너 노출.
- 저장 데이터 보호: at-rest 암호화 활성 시 운영 KEK 관리(시크릿 매니저), 키 회전 절차(더블 키/롤링 기간) 수립.

## 테스트 체크리스트
- [ ] 데스크톱 Chrome/Edge 설치형 PWA에서 구독/수신 동작
- [ ] Android Chrome 설치형 PWA에서 백그라운드 수신
- [ ] iOS Safari(설치형 웹앱)에서 권한 요청/수신 동작
- [ ] 권한 거부 후 재요청 UX
- [ ] 죽은 구독 정리(410/404) 자동화
- [ ] 예약 발송(D-3/D-1) 실제 트리거 검증

## 비고
- SMS 채널은 보류. 지원 시 별도 채널로 추가하며, 웹푸시와 독립적인 구독/쿨다운 정책을 둔다.
