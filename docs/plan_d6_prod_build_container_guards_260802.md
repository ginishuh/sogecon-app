# D6 production build and container guards (2026-08-02)

## Accepted scope

This plan records the accepted implementation for GitHub #253 and #257 only.
It does not include D7, Dependabot remediation, dependency upgrades, or
unrelated cleanup. Base merge: `6bed2b6834b6138b128755e415f337d80dc66a87`.

## Accepted design

### Web API URL

- `NEXT_PUBLIC_WEB_API_BASE` is the browser-visible, build-time public API URL.
- Every real `next build` invokes the small validator from the production build
  phase. Missing/blank, malformed/relative, and non-HTTPS URLs fail.
- `WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1` is a build-only local/test escape hatch:
  it permits HTTP only for `localhost`, `127.0.0.1`, and `::1`; missing values and
  arbitrary HTTP hosts still fail. The normal `ops/cloud-build.sh` path does not
  forward it, and the runtime Web image does not retain it.
- `API_INTERNAL_URL` replaces `NEXT_PUBLIC_API_INTERNAL_URL` and is server-only.
  Browser resolution always uses the public URL. Current-host/localhost fallback
  and loopback rewriting are limited to development/test; production does not
  invent `http://<host>:3001`.
- Browser `credentials: include`, existing public API behavior, D4 preview/cookie
  boundaries, and local compose development remain intact.

### Images and start guards

- API image healthcheck uses Python stdlib against `127.0.0.1:3001/healthz` and
  requires 2xx. Web uses Node fetch against `127.0.0.1:3000/` and requires 2xx.
- Both runtime images remain non-root; API uploads remain mounted at `/app/uploads`.
- `cloud-start.sh` preflights images/env files/network before stopping containers,
  applies the accepted resource, logging, capability, restart, and health defaults,
  waits for API healthy before Web, and succeeds only when both are healthy.
- Missing health, unhealthy, exited/dead, or timeout is a failure with concise
  inspect state and bounded redacted logs. No automatic DB rollback or silent
  container restore is performed. Rollback is rerunning with exact previous tags.
- `ops/ci/test_cloud_start.sh` is a repo-guards command contract, including
  preflight ordering, both service run guards, health sequencing, failure modes,
  secret non-disclosure, and executable mode readback.

## Acceptance evidence slots

| Gate | Evidence | Result |
| --- | --- | --- |
| Validator/resolver focused tests | `vitest` build-config/api-base tests: 20 passed | PASS |
| Missing/HTTP/loopback/HTTPS build matrix | missing, malformed, HTTP/no escape, arbitrary HTTP escape, loopback/no escape rejected; loopback escape and HTTPS succeeded | PASS |
| Cloud start command contract | `bash ops/ci/test_cloud_start.sh` → concise `PASS` | PASS |
| Existing migration/githook guards | cloud migrate, githooks, repo guards, versions | PASS |
| Repository/API/Web static gates | ruff, pyright (2 existing warnings), pytest 303 passed, lint, Web tests 269 passed, HTTPS build | PASS |
| Automatic Web E2E | managed mock API + production Web: 5 files / 11 tests passed | PASS |
| Current API/Web image build | `local/sogecon-d6/alumni-api:d6-260802`, TLS Web tag | PASS |
| Disposable DB migration/readback | `d6-postgres-260802`, `d6_disposable`, `d6-network-260802`, exact uploads path; real migration/seed | PASS |
| Docker inspect authority | healthy, non-root, loopback ports, resource/log/security/restart/mount/network readback | PASS |
| Deliberately non-serving failure | actual wait returned nonzero with `health=unhealthy`, bounded logs | PASS |
| Exact previous-tag rollback semantics | same script with exact `d6-previous-260802` tags returned both healthy | PASS |
| Visible browser with local TLS API | ephemeral `playwright-cli`, TLS Web/API proxies, HTTPS API requests, no mock/production access | PASS |
| Login/support/push/upload UI flows | login/support/upload and DB/filesystem readback PASS; push CTA INCONCLUSIVE due Chrome incognito Push API restriction; contact has documented first-attempt partial row | PARTIAL |
| Exact cleanup | `d6-*` containers/network, disposable DB, TLS cert/proxy, env files, uploads, and ephemeral browser sessions removed; ports read back empty | PASS |

## Revalidated review follow-up (PR #288 head `913e9012fdee980e4375c8d85421dccdde9ddeef`)

### Root causes and bounded changes

- P1 root cause: `scripts/deploy-vps.sh` passed `--web-env` only to the
  runtime start step, while `ops/cloud-build.sh` receives build arguments only
  from the shell environment. Local Web image builds therefore reached the
  production validator without `NEXT_PUBLIC_WEB_API_BASE`. The wrapper now
  safely parses only that exact key from the supplied env file (no `source`,
  `eval`, expansion, or execution), supports an explicit `--web-api-base`
  override, forwards the resolved value, and fails before Docker when absent.
  VPS, WSL2, standalone, API, and CI build instructions now show an HTTPS
  public base.
- P2 root cause: `API_BASE` is intentionally the server fetch base when
  `API_INTERNAL_URL` is set, but `resolveApiAssetUrl` reused it for SSR HTML.
  Asset resolution now selects the public build-time base independently,
  including during server rendering; API base trailing slashes are normalized.
- P2 root cause: `HEALTH_TIMEOUT` represented integer external curl retries in
  `deploy-vps.sh` but could be inherited by `cloud-start.sh` as an invalid
  Docker duration. `deploy-vps.sh` now validates positive integer wait seconds,
  `CONTAINER_HEALTH_TIMEOUT` is the Docker-only variable, and contract coverage
  proves the inherited integer is ignored while the duration override works.
- Compatibility root cause: D6 `cloud-start.sh` requires image HEALTHCHECK
  state, so a pre-D6 image cannot be rolled back with the D6 script. The
  authoritative runbooks now define image plus deployment script/checkout as a
  matched release set and require the corresponding pre-D6 deployment script
  for pre-D6 images. D6→D7 support plaintext logging/partial-commit behavior
  remains explicitly deferred to #254.
- Direct cleanup: HTTP rejection coverage is independent of inherited
  `WEB_BUILD_ALLOW_INSECURE_LOCAL_API`, and secret redaction strips both
  single- and double-quoted env-file values.
- Decision override from source thread `019fbae0-8fe8-7c43-b147-601557203dc7`
  keeps the operator-confirmed standalone systemd Web as the pre-cutover state
  and rollback fallback, while accepting full Docker API/Web/PostgreSQL with
  the existing D6 `cloud-start.sh` guards as the near-term target.
- Korean/English VPS runbooks and API/Web ops docs now specify the bounded
  migration: explicit HTTPS Web image build/pull, Docker-network
  `API_INTERNAL_URL` in the Web runtime env, image/env/network preflight,
  systemd stop/disable only at cutover, full `cloud-start.sh`, health plus
  representative browser readback, and systemd symlink rollback.
- No production access or migration was performed. No Web code changed, so the
  prior exact-diff Web lint/test/build evidence is retained; this override was
  verified with affected docs/shell checks only.
- Latest affected checks PASS: shell syntax for the changed deployment scripts,
  cloud-start/deploy-vps/cloud-migrate command contracts, repository/version
  guards, and `git diff --check`. A repository scan found no Web-omitting
  deployment mode; Web suite/build remains intentionally not rerun because Web
  code is unchanged.

### Follow-up evidence

| Gate | Evidence | Result |
| --- | --- | --- |
| Web resolver/build-config focused regression | `pnpm -C apps/web exec vitest run __tests__/api-base-resolution.test.ts __tests__/api-asset-url.test.ts __tests__/build-config.test.ts` → 3 files / 22 tests passed | PASS |
| Cloud-start inherited timeout and quote-redaction contract | `bash ops/ci/test_cloud_start.sh` → `cloud-start command contract: PASS` | PASS |
| VPS local-build forwarding/missing-value/integer-timeout contract | `bash ops/ci/test_deploy_vps.sh` → `deploy-vps command contract: PASS` | PASS |
| Full Web quality gates | Node `24.12.0`: `pnpm -C apps/web lint` PASS; `env -u WEB_BUILD_ALLOW_INSECURE_LOCAL_API -u API_INTERNAL_URL pnpm -C apps/web test` → 79 files / 289 tests passed; `NEXT_PUBLIC_WEB_API_BASE=https://api.example.com pnpm -C apps/web build` PASS | PASS |
| Repository and related shell guards | `.venv/bin/python ops/ci/guards.py && .venv/bin/python ops/ci/check_versions.py` PASS; cloud-migrate and githooks contracts PASS; `git diff --check` PASS | PASS |

## Verification limits

Any gate that cannot run because of a missing local prerequisite is recorded as
`INCONCLUSIVE` with the exact command and reason. A mock or lower-level API call
does not replace the requested actual browser/runtime proof.
