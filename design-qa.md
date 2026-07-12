# Home design QA

- Source visual truth: `/home/ginis/.codex/generated_images/019f4f96-1245-7ea2-8709-9a4b34ee179c/exec-cd9e0265-614d-4ba2-a9e1-d84c315d3968.png`
- Implementation desktop capture: `/home/ginis/sogecon-app/.artifacts/design-qa-home-260712/implementation-desktop.png`
- Implementation mobile captures: `/home/ginis/sogecon-app/.artifacts/design-qa-home-260712/implementation-mobile.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-home-260712/implementation-mobile-lower.png`
- Full-view comparison: `/home/ginis/sogecon-app/.artifacts/design-qa-home-260712/desktop-comparison-final.png`
- Focused hero/action comparison: `/home/ginis/sogecon-app/.artifacts/design-qa-home-260712/hero-comparison-final.png`
- Viewports: desktop `1440×1024`; mobile `390×844`
- State: production runtime, public home, logged out, `scrollY=0` for top captures

## Findings

No actionable P0, P1, or P2 differences remain.

- [P3] The implementation keeps a subtle rounded outer hero container instead of the source frame's edge-to-edge canvas treatment.
  - Location: home hero.
  - Evidence: the focused comparison shows the same split composition, image emphasis, title hierarchy, burgundy CTA, and overlapping action strip; the implementation retains the repository's existing rounded-surface language.
  - Impact: minor stylistic difference only; it preserves consistency with the rest of the product.
  - Follow-up: reconsider only if the rest of the public pages adopt a fully editorial edge-to-edge layout.

- [P3] The source mock contains populated announcement, event, and news fixtures while the local implementation shows the real empty-data state.
  - Location: recent activity.
  - Evidence: the implementation retains the same three-column hierarchy and section proportions, but uses actionable Korean empty-state copy because the local API returned no public activity data.
  - Impact: expected runtime-data difference, not a layout or fidelity defect.
  - Follow-up: validate the populated state again when representative public fixtures are available.

## Required fidelity surfaces

- Fonts and typography: passed. Existing Pretendard and KoPub variables remain in use; the display hierarchy, optical weight, burgundy emphasis, line height, and Korean wrapping match the selected direction. Mobile heading remains inside its container.
- Spacing and layout rhythm: passed. The final desktop home width is `1344px` with symmetric effective margins of about `40px`; hero, overlapping action strip, section divider, and three-column activity rhythm track the source. Mobile uses a single vertical flow with no horizontal overflow.
- Colors and visual tokens: passed. Existing Sogang burgundy, warm ivory, white surfaces, neutral text, brand focus ring, and restrained shadow tokens are preserved. No unrelated palette or gradient was introduced.
- Image quality and asset fidelity: passed. The generated alumni networking photograph matches the selected art direction, is stored as an optimized WebP, and rendered with positive natural dimensions. The supplied official logo remains unchanged. Phosphor outline icons replace ad-hoc decorative glyphs.
- Copy and content: passed. Existing Korean role-specific actions and live API content remain authoritative. The selected direction's central message and CTA are retained without exposing internal implementation terms.

## Responsive and interaction evidence

- Desktop hero: `1344×441.6`; action strip renders as three columns; activity renders as three equal columns.
- Mobile hero: `358.4×571.737`; heading does not intersect previous or next controls.
- Mobile document: `scrollWidth=clientWidth=375`; action and activity areas use a single-column flow.
- Carousel previous, next, and indicators change slides correctly.
- Focus-visible ring is present on the `44×44` carousel control.
- Console errors/warnings, hydration, chunk, and image errors: 0.

## Comparison history

### Iteration 1

- Finding: [P1] The first implementation remained constrained to the general `72rem` application width, making the desktop composition visibly smaller and more dashboard-like than the selected source.
- Fix: added a home-only `84rem` responsive width while preserving the narrower global application layout for task screens.
- Post-fix evidence: `implementation-desktop.png` and `desktop-comparison-final.png` show a `1344px` home surface with symmetric margins and source-like hero/action proportions.

### Iteration 2

- Finding: no remaining P0/P1/P2 issues. The generated PNG hero asset was larger than necessary for delivery.
- Fix: converted the visually identical asset to a `96KB` WebP and rebuilt production successfully.
- Post-fix evidence: production build passes; the image source, crop, dimensions, and component layout are otherwise unchanged from the passed browser capture.

## Implementation checklist

- [x] Preserve official logo, brand colors, and repository fonts.
- [x] Recreate the selected split hero and overlapping action strip.
- [x] Preserve role-aware navigation and live API behavior.
- [x] Provide purposeful loading, error, empty, and populated structures.
- [x] Verify desktop, mobile, carousel interaction, focus, image loading, console, and network.
- [x] Optimize the generated hero asset for production delivery.

## Follow-up polish

- Recheck recent activity with representative populated public content.
- Extend the same editorial surface and spacing language to posts, events, directory, and profile screens in separate scoped iterations.

## Board list design QA

- Source visual truth: `/home/ginis/.codex/generated_images/019f4f96-1245-7ea2-8709-9a4b34ee179c/exec-952daff8-b52f-451e-967a-8ee55563f84b.png`
- Implementation desktop capture: `/home/ginis/sogecon-app/.artifacts/design-qa-board-260712/implementation-board-desktop.png`
- Implementation mobile capture: `/home/ginis/sogecon-app/.artifacts/design-qa-board-260712/implementation-board-mobile.png`
- Full-view comparison: `/home/ginis/sogecon-app/.artifacts/design-qa-board-260712/board-comparison-full.png`
- Focused header, tabs, search, and list comparison: `/home/ginis/sogecon-app/.artifacts/design-qa-board-260712/board-comparison-focused.png`
- Viewports: desktop `1440×1024`; mobile `390×844`
- State: production runtime, authenticated synthetic E2E member, `/board`, `scrollY=0`

### Findings

No actionable P0, P1, or P2 differences remain.

- [P3] The selected source includes an all-period filter, but the implementation does not invent a filter unsupported by the current API contract.
  - Location: board search controls.
  - Evidence: the combined comparison shows the source period selector between search and reset, while the implementation keeps the working search and reset controls only.
  - Impact: intentional product constraint; no misleading or inert control is exposed.
  - Follow-up: add the control only when the API supports a meaningful date-range query.

- [P3] The local fixture posts show `-` for the publication date.
  - Location: board list date column and mobile post metadata.
  - Evidence: all three live synthetic fixture rows render `-`; the selected source uses populated dates.
  - Impact: the list remains usable, but real date mapping should be confirmed before production content review.
  - Follow-up: tracked in #227 as a data/field-mapping investigation.

- [P3] The optional featured story is absent from the live capture.
  - Location: between board header and tabs.
  - Evidence: none of the three existing posts satisfies both `pinned` and actual-image conditions; the implementation intentionally begins with the list rather than rendering an empty feature shell.
  - Impact: expected low-content behavior and central to the selected hybrid direction.
  - Follow-up: capture the feature state when a representative eligible post exists, without fabricating production-like content for this pass.

### Required fidelity surfaces

- Fonts and typography: passed. Repository Pretendard and KoPub variables remain authoritative; the source hierarchy of burgundy eyebrow, strong Korean page title, restrained description, and compact table metadata is preserved without text clipping.
- Spacing and layout rhythm: passed. The desktop header, static write action, editorial tabs, search controls, and practical list preserve the source composition while allowing the feature block to collapse cleanly. Mobile uses a single reading flow with no document overflow or control overlap.
- Colors and visual tokens: passed. Existing Sogang burgundy, warm-white surface, neutral borders, muted metadata, and brand focus ring match the selected direction and the refreshed home.
- Image quality and asset fidelity: passed for the captured state. The official logo retains positive natural dimensions and list image markers use Phosphor icons. The optional feature image is hidden because no eligible live post exists, not replaced by a placeholder.
- Copy and content: passed. Live Korean category labels, titles, author names, search/empty copy, and actions remain authoritative; raw category keys and internal IDs are not exposed.

### Responsive and interaction evidence

- Desktop static write action: `118.49×48`; editorial tabs are at least `44×48`.
- Mobile document: `scrollWidth=clientWidth=375`; write action `358.4×48`.
- Mobile tablist: `scrollWidth=421`, `clientWidth=325`, `overflow-x:auto`; the scroll function remains internal to the tablist.
- Mobile native scrollbar: `::-webkit-scrollbar display:none`; rail and arrows are absent in the final capture.
- ArrowRight selects 자유게시판, End selects 경조사 and moves `scrollLeft` to `96`, Home returns to 전체 and `scrollLeft=0`.
- Search, reset, category tabs, `/board/new`, and post-detail navigation work without data submission.
- Focus-visible ring is present on the `44×48` selected tab.
- Console errors/warnings, hydration, chunk, CSP, and image errors: 0; observed product 5xx/404: 0.

### Comparison history

#### Iteration 1

- Finding: [P2] Windows rendered the mobile editorial tablist with a persistent native scrollbar rail and arrow controls, adding a visually dated extra row below the selected underline.
- Fix: retained `overflow-x:auto` and keyboard/touch scrolling while hiding only the scrollbar chrome for the editorial variant.
- Post-fix evidence: the final mobile capture has no native rail or arrows; `scrollWidth=421 > clientWidth=325`, End/Home move `scrollLeft` between `0` and `96`, and ARIA selection remains correct.

#### Iteration 2

- Finding: no remaining P0/P1/P2 differences. The optional source feature could not be compared in the current live-data state.
- Fix: no synthetic database content was created; the low-content-safe list-first behavior was retained as an intentional product requirement.
- Post-fix evidence: the full and focused combined comparisons show a stable three-row layout, consistent hierarchy, and no empty feature shell.

### Implementation checklist

- [x] Preserve official logo, colors, and repository fonts.
- [x] Recreate the selected editorial header, static write CTA, underline tabs, search, and practical list.
- [x] Keep feature content optional and driven by real eligible posts.
- [x] Preserve category, search, paging, empty, loading, error, and navigation behavior.
- [x] Verify Desktop, 390px Mobile, keyboard tabs, focus, console, network, and no document overflow.
- [x] Compare source and implementation in combined full and focused evidence.

### Follow-up polish

- Confirm publication-date field mapping with representative non-synthetic content.
- Capture the optional featured story in Desktop and Mobile when an eligible post exists.
- Continue the same editorial language into `/board/[id]` and comments under #227.

final result: passed
