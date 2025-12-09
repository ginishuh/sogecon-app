# 이슈 #87: 게시물 관리 기능 추가 — 구현계획

> 작성일: 2025-12-09
> 이슈: https://github.com/ginishuh/sogecon-app/issues/87
> 상태: 계획 단계

---

## 1. 현황 분석

### 현재 구현 상태

| 기능 | API | Web UI | 비고 |
|------|-----|--------|------|
| 게시물 목록 조회 | ✅ `GET /posts/` | ✅ `/posts` | 카테고리 필터, 고정글 지원 |
| 게시물 상세 조회 | ✅ `GET /posts/{id}` | ✅ `/posts/[id]` | 조회수 자동 증가 |
| 게시물 생성 | ✅ `POST /posts/` | ✅ `/posts/new` | 관리자 전용 |
| 게시물 수정 | ❌ 없음 | ❌ 없음 | **구현 필요** |
| 게시물 삭제 | ❌ 없음 | ❌ 없음 | **구현 필요** |
| 관리자 목록 페이지 | - | ❌ 없음 | **구현 필요** |
| 공개/비공개 관리 | 부분 (`published_at`) | ❌ 없음 | **UI 필요** |

### 핵심 파일 위치

**API (백엔드)**
- 모델: `apps/api/models.py` (Post 클래스)
- 라우터: `apps/api/routers/posts.py`
- 서비스: `apps/api/services/posts_service.py`
- 저장소: `apps/api/repositories/posts.py`
- 스키마: `apps/api/schemas.py` (PostCreate, PostRead)

**Web (프론트엔드)**
- 서비스: `apps/web/services/posts.ts`
- 목록: `apps/web/app/posts/page.tsx`
- 상세: `apps/web/app/posts/[id]/page.tsx`
- 작성: `apps/web/app/posts/new/page.tsx`
- 컴포넌트: `apps/web/components/post-card.tsx`

---

## 2. 구현 범위

### 필수 기능 (이슈 요구사항)
1. **게시글 수정 API + UI** — 관리자가 기존 게시물 편집
2. **게시글 삭제 API + UI** — 관리자가 게시물 삭제 (확인 다이얼로그 포함)
3. **관리자 게시글 목록 페이지** — `/admin/posts`에서 전체 게시물 관리
4. **공개/비공개 상태 관리** — `published_at` 필드 활용, 토글 UI

### 선택적 확장 (우선순위 낮음)
- 일괄 삭제/상태 변경
- 검색/필터 (제목, 작성자, 날짜 범위)
- 정렬 옵션 (최신순, 조회순, 댓글순)

---

## 3. API 설계

### 3.1 게시물 수정 — `PATCH /posts/{post_id}`

```
권한: 관리자만 (require_admin)
요청: PostUpdate (부분 업데이트)
응답: PostRead
```

**PostUpdate 스키마** (새로 추가):
```python
class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    category: str | None = None
    pinned: bool | None = None
    published_at: datetime | None = Field(default=None, description="None → 비공개, 값 → 발행일시")
    cover_image: str | None = None
    images: list[str] | None = None
```

**비즈니스 로직**:
- 전달된 필드만 업데이트 (None 필드는 무시)
- `published_at = None` → 비공개 상태
- `published_at = <datetime>` → 해당 시점 이후 공개
- 수정 시 `author_id`는 변경 불가

### 3.2 게시물 삭제 — `DELETE /posts/{post_id}`

```
권한: 관리자만 (require_admin)
응답: { "ok": true, "deleted_id": int }
```

**비즈니스 로직**:
- 연관된 댓글은 CASCADE 삭제 (FK 설정 확인 필요)
- 소프트 삭제 vs 하드 삭제: **하드 삭제** 채택 (단순성 우선)
- 삭제 전 존재 여부 확인 → 404 반환

### 3.3 관리자 게시물 목록 — `GET /admin/posts`

```
권한: 관리자만 (require_admin)
쿼리: limit, offset, category, status (all|published|draft), q (검색어)
응답: { items: PostRead[], total: int }
```

**특징**:
- 기존 `/posts/`와 달리 **비공개 게시물 포함**
- 페이지네이션 + 총 개수 반환 (관리 UI용)
- 검색어 `q`는 제목/본문 ILIKE 매칭

---

## 4. Web UI 설계

### 4.1 관리자 게시물 목록 페이지

**경로**: `/admin/posts`
**파일**: `apps/web/app/admin/posts/page.tsx`

**UI 구성**:
```
┌─────────────────────────────────────────────────────────┐
│ 게시물 관리                           [+ 새 글 작성]    │
├─────────────────────────────────────────────────────────┤
│ 필터: [전체 ▼] [공지 ▼] [뉴스 ▼]  상태: [전체|공개|비공개] │
│ 검색: [____________] [🔍]                                │
├─────────────────────────────────────────────────────────┤
│ □ │ 제목          │ 카테고리 │ 상태  │ 조회 │ 작성일  │ 액션   │
│───┼───────────────┼──────────┼───────┼──────┼─────────┼────────│
│ □ │ 공지사항 #1   │ notice   │ 📢공개│ 123  │ 12/01   │ ✏️ 🗑️ │
│ □ │ 초안 글       │ news     │ 📝비공개│ 0   │ 12/05   │ ✏️ 🗑️ │
├─────────────────────────────────────────────────────────┤
│ ◀ 이전  1 2 3 ... 10  다음 ▶        총 95건           │
└─────────────────────────────────────────────────────────┘
```

**기능**:
- 테이블 형태의 게시물 목록
- 상태 배지: 공개(초록), 비공개(회색), 고정(📌)
- 인라인 액션: 수정(→ 수정 페이지), 삭제(확인 다이얼로그)
- 새 글 작성 버튼 → `/posts/new` 이동

### 4.2 게시물 수정 페이지

**경로**: `/admin/posts/[id]/edit`
**파일**: `apps/web/app/admin/posts/[id]/edit/page.tsx`

**UI 구성**:
- 기존 `/posts/new` 폼 재사용 (PostForm 컴포넌트 추출)
- 초기값: 기존 게시물 데이터 로드
- 추가 필드:
  - **공개 상태 토글**: 즉시 공개 / 비공개 / 예약 발행
  - **고정 체크박스**: 상단 고정 여부

**폼 필드**:
```
제목: [________________]
카테고리: [공지 ▼] [뉴스 ▼] [히어로 ▼]
본문: [                    ]
      [                    ]
커버 이미지: [URL 입력] [미리보기]
추가 이미지: [URL 추가] [이미지1 ×] [이미지2 ×]
────────────────────────────
공개 상태: (•) 즉시 공개  ( ) 비공개  ( ) 예약 발행 [____]
□ 상단 고정
────────────────────────────
              [취소]  [저장]
```

### 4.3 삭제 확인 다이얼로그

**컴포넌트**: `components/confirm-dialog.tsx` (범용)

```
┌────────────────────────────────┐
│ ⚠️ 게시물 삭제                  │
├────────────────────────────────┤
│ "공지사항 #1" 게시물을          │
│ 삭제하시겠습니까?               │
│                                │
│ 이 작업은 되돌릴 수 없습니다.   │
│ 연관된 댓글도 함께 삭제됩니다.  │
├────────────────────────────────┤
│         [취소]    [삭제]       │
└────────────────────────────────┘
```

### 4.4 상세 페이지 수정 버튼

**파일**: `apps/web/app/posts/[id]/page.tsx` 수정

관리자인 경우 상세 페이지에 수정/삭제 버튼 표시:
```tsx
{isAdmin && (
  <div className="flex gap-2">
    <Link href={`/admin/posts/${post.id}/edit`}>수정</Link>
    <button onClick={() => setShowDeleteDialog(true)}>삭제</button>
  </div>
)}
```

---

## 5. 구현 순서

### Phase 1: API 구현 (백엔드)

1. **스키마 추가** — `PostUpdate` 정의
2. **Repository 확장**
   - `update_post(db, post_id, payload)` → PATCH 로직
   - `delete_post(db, post_id)` → DELETE 로직
   - `list_admin_posts(db, ...)` → 비공개 포함 목록
   - `count_posts(db, ...)` → 총 개수
3. **Service 확장**
   - `update_admin_post(db, post_id, payload, admin_student_id)`
   - `delete_admin_post(db, post_id, admin_student_id)`
   - `list_admin_posts_with_count(...)`
4. **Router 추가**
   - `PATCH /posts/{post_id}` → 수정
   - `DELETE /posts/{post_id}` → 삭제
   - `GET /admin/posts` → 관리자 목록
5. **테스트** — 권한 검증, CRUD 동작 확인

### Phase 2: Web 서비스 확장 (프론트엔드)

1. **서비스 함수 추가** (`services/posts.ts`)
   - `updatePost(id, payload)`
   - `deletePost(id)`
   - `listAdminPosts(params)`
2. **타입 정의 업데이트**

### Phase 3: UI 컴포넌트 구현

1. **PostForm 컴포넌트 추출** — 작성/수정 공용
2. **ConfirmDialog 컴포넌트** — 범용 확인 다이얼로그
3. **관리자 목록 페이지** — `/admin/posts`
4. **수정 페이지** — `/admin/posts/[id]/edit`
5. **상세 페이지 버튼 추가** — 관리자 전용 수정/삭제

### Phase 4: 통합 및 테스트

1. E2E 흐름 테스트
2. 권한 검증 테스트
3. 엣지 케이스 (존재하지 않는 게시물, 동시 수정 등)

---

## 6. 데이터베이스 고려사항

### 기존 스키마 확인

```python
class Post(Base):
    id: int (PK)
    author_id: int (FK → members.id, CASCADE)
    title: str
    content: Text
    published_at: datetime | None  # None = 비공개
    category: str | None
    pinned: bool
    cover_image: str | None
    images: JSONB
    view_count: int
```

### FK CASCADE 확인 필요

`comments.post_id` → `posts.id`의 ON DELETE 동작 확인:
- CASCADE면 자동 삭제
- RESTRICT면 댓글 먼저 삭제 필요

```sql
-- 확인 쿼리
SELECT conname, confdeltype
FROM pg_constraint
WHERE conrelid = 'comments'::regclass
  AND contype = 'f';
```

### 마이그레이션

스키마 변경 없음 (기존 필드 활용). 마이그레이션 불필요.

---

## 7. 보안 고려사항

1. **권한 검증**: 모든 수정/삭제 엔드포인트에 `require_admin` 적용
2. **CSRF 보호**: 기존 세션 기반 인증 활용 (HttpOnly 쿠키)
3. **입력 검증**: Pydantic 스키마로 타입/길이 검증
4. **감사 로그**: (선택) 수정/삭제 시 로그 기록 고려

---

## 8. 예상 작업량

| 단계 | 작업 항목 | 난이도 |
|------|----------|--------|
| Phase 1 | API 수정/삭제 엔드포인트 | 중 |
| Phase 1 | 관리자 목록 API | 중 |
| Phase 2 | Web 서비스 함수 | 하 |
| Phase 3 | PostForm 컴포넌트 추출 | 중 |
| Phase 3 | 관리자 목록 페이지 | 중상 |
| Phase 3 | 수정 페이지 | 중 |
| Phase 3 | 확인 다이얼로그 | 하 |
| Phase 4 | 테스트 | 중 |

---

## 9. 참고 자료

- 기존 관리자 페이지 패턴: `/admin/notifications`
- 인증 훅: `useAuth()`, `RequireAdmin` 컴포넌트
- API 호출 패턴: `apiFetch()`, React Query
- 댓글 삭제 로직 참고: `routers/comments.py`

---

## 10. 체크리스트

### API
- [ ] `PostUpdate` 스키마 추가
- [ ] `PATCH /posts/{post_id}` 구현
- [ ] `DELETE /posts/{post_id}` 구현
- [ ] `GET /admin/posts` 구현
- [ ] 단위 테스트 작성

### Web
- [ ] `updatePost()`, `deletePost()` 서비스 함수
- [ ] `listAdminPosts()` 서비스 함수
- [ ] `PostForm` 공용 컴포넌트
- [ ] `ConfirmDialog` 컴포넌트
- [ ] `/admin/posts` 관리자 목록 페이지
- [ ] `/admin/posts/[id]/edit` 수정 페이지
- [ ] 상세 페이지 수정/삭제 버튼

### 문서
- [ ] API 문서 업데이트 (OpenAPI 자동 생성)
- [ ] worklog 업데이트
