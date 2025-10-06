# M3 Phase-2 — Subscription Auth + Tests

Scope
- Replace temporary admin guard with member session guard for subscription save/delete.
- Derive member from session; ignore client-provided identifiers.
- Add tests: rate limiting (429) for admin test send; invalid payloads (422) for subscriptions.
- Web: improve CTA error messages (permission denied, restore flow).

Acceptance Criteria
- Saving/deleting subscriptions requires authenticated member; tests cover 401/403.
- 429 test for admin send; 422 tests for invalid payloads; all green.
- Docs updated (architecture + m3_plan) and dev log entry present.

Notes
- Keep secrets out of repo; VAPID keys remain .env/.env.local.
- Maintain guardrails: no broad exception, no Any/ignores, cyclomatic complexity ≤ 10.
