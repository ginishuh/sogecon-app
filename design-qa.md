# Issue #235 공지·동문 소식·행사 Design QA

## Comparison target

- Source visual truth: `/home/ginis/sogecon-app/.artifacts/design-qa-events-235/source-hybrid.png`
- Windows source copy: `C:\Users\USER\Documents\Codex\2026-07-11\chrome-browser-control-sogecon-app-pr\design-qa-events-235\source-hybrid.png`
- Implementation: `http://localhost:3000/events`
- Primary viewport/state: Desktop `1440×1024`, synthetic upcoming events 3건
- Responsive states: Tablet `768×900`, Mobile `390×844`, past-events empty state, `/events/5`, `/events/999999`
- Comparison image: `C:\Users\USER\Documents\Codex\2026-07-11\chrome-browser-control-sogecon-app-pr\design-qa-events-235\comparison-source-vs-implementation-desktop.png`
- Runtime: Next.js 16.2.10 production, Chrome extension Browser Control

## Evidence

- `implementation-desktop.png` — latest build, `1440×1024`
- `implementation-tablet.png` — latest build, `768×900`
- `implementation-mobile.png` — latest build, `390×844`
- `implementation-empty-mobile.png` — latest build, `390×844`
- `implementation-detail-desktop.png` — detail-only prior build, `1440×1024`
- `implementation-detail-mobile.png` — detail-only prior build, `390×844`
- `implementation-not-found.png` — 404-only prior build, `390×844`

All evidence files have valid PNG magic and the expected dimensions. The detail and not-found screenshots predate the list-only notification-strip correction; their components and routes did not change afterward. Attempts to recapture those three files on the latest build hit the Chrome screenshot command timeout, which is recorded as a collection limitation rather than product evidence.

## Findings

No actionable P0, P1, or P2 differences remain.

- [P3] The source uses a stronger active navigation underline than the rendered site header.
  - Location: global header `행사 일정` item.
  - Evidence: the source underline is prominent; the implementation relies more on the existing header's text state.
  - Impact: small current-location emphasis difference only.
  - Follow-up: keep the shared header contract unless navigation is refreshed as a separate scope.

- [P3] The source date tile includes a more decorative year/month treatment.
  - Location: featured event date block.
  - Evidence: implementation retains year, `7.18`, and weekday but removes the source's stronger calendar-header treatment.
  - Impact: date remains the first readable signal; no information loss.
  - Follow-up: none required.

- [P3] The Mobile featured event is `398.39px` tall, so the next event begins below the first viewport.
  - Location: `/events` at `390×844`.
  - Evidence: card `x=16`, `w=358.4`, `h=398.39`; all event metadata and the `316.8×44` CTA fit without clipping.
  - Impact: one additional scroll gesture, with intact reading order and no overflow.
  - Follow-up: reconsider only if denser production content makes the first card materially taller.

## Required fidelity surfaces

- Fonts and typography: passed. Existing KoPub/Pretendard variables remain authoritative. Source and implementation preserve eyebrow → H1 → featured title → ledger hierarchy; the implementation is intentionally one step more compact.
- Spacing and layout rhythm: passed. Desktop uses the repository `1152px` centered content contract, with featured band → ledger rows → update strip matching the source order. Tablet and Mobile reflow without overlap.
- Colors and visual tokens: passed. Sogang burgundy, navy text, warm cream surfaces, neutral borders, green status badges, and brand focus rings match the selected direction.
- Image and icon fidelity: passed. The screen requires no event photography. The official logo remains the shared header asset, and Calendar, MapPin, Users, Bell, Clock, and Arrow icons come from the existing Phosphor library.
- Copy and content: passed. Korean date, time, place, capacity, status, detail, empty, and recovery copy is present. Application totals and progress bars are intentionally omitted because public `EventRead` exposes no aggregate RSVP count; the implementation does not fabricate data.

## Responsive and interaction evidence

- `/posts`의 전체·공지사항·동문 소식 분류는 현재 선택을 `aria-pressed`로 노출하고, 44px 조작 영역과 기존 브랜드 포커스 표시를 유지한다.
- 존재하지 않는 `/posts/[id]`는 영문 Next 기본 404 대신 “소식을 찾지 못했습니다.”와 공지·소식 목록 복귀 행동을 제공한다.
- 최신 Windows focused QA에서 `/posts` Desktop `1440/1440`, Mobile `390/390`, 세 분류 버튼 `44px`, 실제 선택 전환과 키보드 포커스를 확인했다. `/posts/999999`는 한국어 복구 UI를 포함한 의도된 Document 404로 렌더되고, Console 오류·경고와 예상 밖 4xx/5xx는 0건이었다.
- Desktop main: centered `1152px`; featured event `1088×176.7`; two ledger rows approximately `1086.4×95`.
- Tablet document: `753/753`; featured `688.8×219.2`; rows reflow without horizontal overflow.
- Mobile document: `390/390`; featured and later cards remain within the viewport; all detail actions are at least `44px` tall.
- Filters expose `aria-pressed`; Chrome coordinate click switches upcoming → past empty state → upcoming, and Tab/Shift+Tab show the white-offset brand ring.
- Past empty state provides a working `316.8×44` “예정된 행사 보기” action.
- Detail preserves title → status → schedule/place/capacity → description → RSVP → support.
- Missing event returns “행사를 찾지 못했습니다.” with 44px event-list and office-contact recovery actions instead of indefinite loading.
- Console errors/warnings, hydration, chunk, CSP, and unexpected 4xx/5xx: 0. The `/events/999999` API 404 is the expected not-found test.

## Comparison history

### Iteration 1

- Finding: [P2] The first implementation rendered the source's empty-state sentence below three real events, creating a false “등록된 예정 행사가 없습니다” message.
- Fix: split the real zero-result state from a truthful data-present update prompt. The list now shows “새 행사 소식을 놓치지 마세요.” while the past-events filter shows the actual empty state.
- Post-fix evidence: latest Desktop/Tablet/Mobile/empty captures show the corrected strip, preserve source order, and contain no P0/P1/P2 mismatch.

### Iteration 2

- Finding: no actionable P0/P1/P2 differences.
- Post-fix evidence: Windows production QA passed the full-view comparison, filters, responsive layout, detail hierarchy, 404 recovery, focus, console, and network checks.

### PR review follow-up

- Finding: the first query only inspected the oldest 20 API rows, so many past events could hide a real upcoming event. Past view copy and hidden section labels also retained future-tense language.
- Fix: read public events in 100-row pages until exhaustion, add boundary/sort/pagination tests, synchronize H1/description/list labels with the selected view, use a KST year formatter, and route invalid event slugs to the same Korean recovery UI.
- Focused Windows evidence: Desktop and Mobile view switching, past copy, empty state, invalid slug, `/posts` regression, Console, and Network passed. The initially unstable selected-filter ring was changed to a focus-state contract; selected and unselected filters both retained a white `2px` offset plus brand `4px` ring at `44px` height.

## Implementation checklist

- [x] Keep `소식` and `행사 일정` as separate navigation routes.
- [x] Expose the selected post category to assistive technology and provide a Korean missing-post recovery state.
- [x] Add H1, description, and accessible upcoming/past controls.
- [x] Emphasize the nearest event and retain practical ledger rows on Desktop.
- [x] Reflow the same information into one-column Tablet/Mobile cards.
- [x] Provide truthful zero-result and data-present next actions.
- [x] Replace missing-event indefinite loading with Korean recovery UI.
- [x] Preserve RSVP behavior without performing QA mutations.
- [x] Validate production build, responsive states, keyboard focus, console, and network.

## Follow-up polish

- Public aggregate RSVP counts would require an explicit API contract decision; do not infer or fabricate them in the Web layer.
- Recheck populated waitlist and completed-event states when approved synthetic fixtures are available.

final result: passed
