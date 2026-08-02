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

## Verification limits

Any gate that cannot run because of a missing local prerequisite is recorded as
`INCONCLUSIVE` with the exact command and reason. A mock or lower-level API call
does not replace the requested actual browser/runtime proof.
