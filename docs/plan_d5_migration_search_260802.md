# D5 migration gate·동문 검색 인덱스 계획 및 검증 기록

## 범위와 기준점

- 기준점: `main` exact head `2f136ef276e71734c6cd2f553e58774f3acdacd5`
- 대상: GitHub #252의 빈 PostgreSQL migration/schema drift gate, #266의 동문 수첩 검색 trgm index 정비
- 원칙: production/VPS와 운영 데이터는 조회·변경하지 않는다. 모든 seed·benchmark는 local disposable PostgreSQL에서 수행한다.
- API 응답/OpenAPI 계약은 변경하지 않는다. 검색 결과 계약은 동일한 ordering과 대표 query 결과로 고정한다.

## 조사 결과와 선택

현재 `apps/api/repositories/members.py`는 `q`에 `name`·`email`·`student_id`를
OR로 검색하고, `major`·`company`·`industry`에는 각각 `ILIKE '%...%'` 필터를
적용한다. 기존 `e2143fa9dd96` migration의 `name`·`email`·주소 2개·`job_title`
GIN은 metadata에 표현되지 않아 fresh `alembic check` baseline drift를 만들고
있었고, RSVP 상태와 active push subscription의 기존 migration index도 같은
문제였다. D5에서는 이 catalog 계약을 모델 metadata에 실제로 표현했다. 일반
drift를 숨기는 Alembic filter는 추가하지 않았다.

기존 local `appdb`는 비민감 dev row 5개뿐이고 후보 필드가 대부분 NULL이라
선택도 판단에 부족했다. 그래서 동일한 synthetic dataset을 disposable DB 두 개에
seed했다.

| 필드 | rows | non-null | distinct | 대표 hit 비율 | plan 결론 |
| --- | ---: | ---: | ---: | ---: | --- |
| `student_id` | 120,000 | 120,000 | 120,000 | exact-like 1/120,000 (0.0008%) | GIN 선택, 채택 |
| `company` | 120,000 | 120,000 | 11,413 | `%acme%` 2.00% | GIN 선택, 채택 |
| `major` | 120,000 | 120,000 | 20 | `%경제%` 10.00% | Seq Scan, 제외 |
| `industry` | 120,000 | 120,000 | 12 | `%금융%` 8.33% | Seq Scan, 제외 |

실제 운영 검색 telemetry는 production 접근 금지 경계 때문에 사용하지 않았다.
검색 빈도는 현재 repository/UI가 제공하는 검색 형태(`q`와 세 개의 명시적 필터)를
기준으로 exact·partial·case-insensitive 대표 workload를 동일 횟수로 고정한
proxy다. 따라서 아래 수치는 workload 증거이며 운영 전체 트래픽의 빈도 추정치는
아니다.

## 구현 계약

- 새 Alembic revision: `d5f2a1c9e7b3`, `c8a7f3d1e2b4`에서 `pg_trgm`을 확인하고
  `idx_members_student_id_trgm`, `idx_members_company_trgm`을 생성한다.
- 두 index 모두 `USING gin (... gin_trgm_ops)`이며 upgrade/downgrade 모두
  `autocommit_block()` 안의 `CONCURRENTLY`를 사용한다.
- downgrade는 새 두 index만 역순 제거한다. 기존 index가 extension을 사용하므로
  `pg_trgm`은 제거하지 않는다.
- `ops/ci/migration_gate.py`는 빈 DB에서 `upgrade head` → `alembic check` →
  `alembic_version`/extension/index catalog readback을 하나의 필수 gate로 수행한다.
  `tests/api/test_migration_gate.py`는 일반 컬럼·테이블·인덱스 drift의 negative regression이다.

## 결과 계약 및 query plan

대표 결과는 인덱스 전후 동일했다. 각 결과는 `updated_at DESC, name ASC, id ASC`
ordering으로 25개를 제한한 결과의 SHA-256 digest다.

| case | before digest | after digest |
| --- | --- | --- |
| student exact-like | `f2dfefea8832c61cb527b59de9f87ba0` | `f2dfefea8832c61cb527b59de9f87ba0` |
| company partial | `b212762c58a9e3c796e25d28cae7a7d5` | `b212762c58a9e3c796e25d28cae7a7d5` |
| company case-insensitive | `a6fccd94d8a5c4a35298589977545a478` | `a6fccd94d8a5c4a35298589977545a478` |
| major low-selectivity | `947e07e91493cb4ecde8b116868fadfc` | `947e07e91493cb4ecde8b116868fadfc` |
| industry low-selectivity | `00c7525f1dee82d447f43a08cfed6c2f` | `00c7525f1dee82d447f43a08cfed6c2f` |

`EXPLAIN (ANALYZE, BUFFERS)`는 `enable_seqscan`을 끄지 않고 default planner로
측정했다. 동일한 local PostgreSQL 16 container에서 5회 실행한 median이다.

| query | before median | after median | after plan |
| --- | ---: | ---: | --- |
| `student_id ILIKE '%S00000012345%'` | 42.018 ms | 1.958 ms | Bitmap Heap/Index Scan (`idx_members_student_id_trgm`) |
| `major ILIKE '%경제%'` | 39.082 ms | 37.651 ms | Parallel Seq Scan |
| `company ILIKE '%acme%'` | 33.797 ms | 7.845 ms | Bitmap Heap/Index Scan (`idx_members_company_trgm`) |
| `industry ILIKE '%금융%'` | 42.555 ms | 47.021 ms | Parallel Seq Scan |
| `name/email/student_id` OR q | 88.076 ms | 2.099 ms | BitmapOr including student GIN |

응답 시간은 5회·단일 local container라 cache, parallel scheduling, noise의
영향을 받는다. plan node와 선택도도 함께 기록했으며, major/industry는 latency
개선 주장을 하지 않고 planner가 Seq Scan을 선택한 사실을 제외 근거로 삼았다.

clean build 직후 `pg_relation_size`는 새 `company` 6,584 kB, `student_id`
6,224 kB였고 members 전체 relation 합계는 before 101 MB, after 116 MB였다.
즉 새 두 index의 초기 overhead는 약 12.5 MB다. 쓰기 비용은 10,000-row
`EXPLAIN ANALYZE INSERT`를 rollback하는 3회 측정에서 before median 1,090.621 ms,
after median 1,105.327 ms(+14.706 ms, +1.35%)였다. 이 역시 local/noisy,
rollback-only 측정이므로 운영 SLA가 아니다.

## 검증 matrix

- empty disposable DB: 최초 revision부터 `upgrade head`, `current=head`,
  `alembic check`, extension/index catalog readback PASS
- existing baseline disposable DB: c8 head에서 D5 upgrade, `alembic check`,
  catalog readback PASS
- existing local `appdb`: D5 upgrade exit 0, `alembic_version=d5f2a1c9e7b3`,
  `pg_trgm=1.6`, 두 새 index definition readback PASS
- existing local `appdb`에 authoritative gate를 재실행하면 기존
  `signup_activation_issue_logs`의 역사적 추가 index 4개
  (`issued_at`, `issued_by_student_id`, `issued_type`, `signup_request_id`)가
  `remove_index` drift로 보고되어 `alembic check`가 FAIL한다. 이 항목은 D5
  검색 필드 범위를 넘어가므로 삭제·blanket filter·임의 migration으로 확대하지
  않았다. 후속 선택지는 (a) 해당 index의 실제 필요성과 출처를 조사해 별도
  migration으로 metadata/catalog를 정렬하거나, (b) 보존이 명시된 경우에만
  정확한 이름 단위 계약을 추가하는 것이다.
- downgrade/upgrade: disposable gate DB에서 D5 downgrade 후 c8 readback,
  재upgrade와 migration gate PASS
- baseline drift: metadata에 기존 7개 index 계약을 추가한 뒤 fresh `alembic check`
  가 `No new upgrade operations detected`로 종료
- negative regression: unmigrated normal model column/table/index가 각각 `add_column`/`add_table`/`add_index`로 검출

실제 visible browser는 저장소 `playwright-cli` skill의 ephemeral session으로
검증했다. `d5-browser-final`에서 production Web → real local API → 전용 local
PostgreSQL 순서의 실제 화면 flow를 사용해 로그인 후 동문 수첩에 진입하고,
검색어 `d5student001` typing 결과 1명과 상세 회사 필터 `Acme` typing 결과
2명을 readback했다. `d5-anon-final`에서는 같은 동문 수첩 링크 click이
`/login` 화면으로 닫히는 권한 경계를 확인했다. mock, storage-state, 운영 URL·계정은
사용하지 않았다. 처음 disposable seed의 reserved-domain email 오류는 test row만
교정한 뒤 최종 browser flow를 재실행했다.

local `appdb`에는 D5 범위 밖의 과거 `signup_activation_issue_logs` 단일 index
4개(`issued_at`, `issued_by_student_id`, `issued_type`, `signup_request_id`)가
남아 있다. D5는 이를 삭제하거나 숨기지 않았다. 해당 legacy drift를 정리하는 것은
별도 migration 설계가 필요한 범위라 이번 작업에 확대하지 않는다.

## 남은 위험

- 운영 실제 분포와 telemetry를 사용하지 않았으므로 선택도는 synthetic workload
  기준이다. 배포 후 query statistics와 index bloat/쓰기 지연을 별도 운영 관측
  항목으로 확인해야 한다.
- `CONCURRENTLY`는 lock을 줄이지만 build 시간이 들고 invalid index 재시도 시
  catalog 확인이 필요하다. 이번 검증은 운영 DB에 적용하지 않았다.
