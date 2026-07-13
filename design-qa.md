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

## Board detail and comments design QA

- Source visual truth: `/home/ginis/.codex/generated_images/019f4f96-1245-7ea2-8709-9a4b34ee179c/exec-b4364241-b04b-4dce-85c8-c21568a22a5c.png`
- Implementation desktop captures: `/home/ginis/sogecon-app/.artifacts/design-qa-board-detail-260713/implementation-board-detail-desktop.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-board-detail-260713/implementation-board-detail-comments-desktop.png`
- Implementation mobile captures: `/home/ginis/sogecon-app/.artifacts/design-qa-board-detail-260713/implementation-board-detail-mobile.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-board-detail-260713/implementation-board-detail-comments-mobile.png`
- Full-view comparison: `/home/ginis/sogecon-app/.artifacts/design-qa-board-detail-260713/board-detail-comparison-full.png`
- Focused article-to-comments comparison: `/home/ginis/sogecon-app/.artifacts/design-qa-board-detail-260713/board-detail-comparison-focused.png`
- Viewports: desktop `1440×1024`; mobile `390×844`
- State: production runtime, authenticated synthetic E2E member, `/board/13`; no post, comment, or fixture mutation

### Findings

No actionable P0, P1, or P2 differences remain.

- [P3] The selected source shows two populated comments while the existing safe fixture has no comments.
  - Location: comments timeline.
  - Evidence: the focused comparison shows the same article-to-conversation hierarchy, composer, and final return action; the implementation presents a purposeful empty state before the composer because `GET /comments/?post_id=13` returned an empty collection.
  - Impact: representative comment-author, timestamp, delete-action, and long-comment density remain unverified visually.
  - Follow-up: capture a populated synthetic comment state in a later pass when an approved fixture exists.

- [P3] The selected source contains a longer article and populated publication date, while the current synthetic fixture has short copy and displays `게시 예정`.
  - Location: article metadata and body.
  - Evidence: the implementation preserves the selected reading column, typography, image treatment, and vertical flow, but the available content cannot exercise long-paragraph rhythm or attachment states.
  - Impact: no current usability defect; this is a content-coverage limitation.
  - Follow-up: recheck long body, attachment, and normal publication-date states with representative data.

### Required fidelity surfaces

- Fonts and typography: passed. The repository's Pretendard and KoPub variables remain authoritative; the final desktop title is `32px`, the mobile title is `28px`, metadata is deliberately restrained, and article/comment copy keeps readable Korean line height and wrapping.
- Spacing and layout rhythm: passed. The card shell and shadow were removed, the article and comments now form one journal-style flow, and the final board-return action sits after the composer. Mobile article width is `311.2px`, up from the audited `245.6px`, without document overflow.
- Colors and visual tokens: passed. Existing Sogang burgundy, warm-white canvas, neutral rules, muted metadata, semantic destructive action, and brand focus ring are preserved without introducing a new palette or gradient.
- Image quality and asset fidelity: passed. The live post image loads through the Next optimizer with positive natural dimensions and its original ratio. Phosphor icons are used for navigation, pin, edit, and delete actions; no placeholder or hand-built decorative asset was introduced.
- Copy and content: passed for the available state. Korean category, author, navigation, empty-comment, composer, retry, and action copy are user-facing and do not expose raw category keys, internal IDs, HTTP text, or object serialization.

### Responsive and interaction evidence

- Desktop article width: `848px`; rendered image `672×179.2`; title `32px`.
- Mobile document: `scrollWidth=clientWidth=375`; article, body, image, and comments use a `311.2px` reading width.
- Mobile image: positive natural size and rendered at `311.2×83.14` with ratio preserved.
- Top and final board-return links, edit, delete, and submit actions meet the `44px` touch-height contract.
- Textarea has the accessible name `댓글로 대화에 참여하기`, keyboard focus-visible styling, and an appropriately disabled empty submit state.
- Article body is followed by the comments region and then the final board-return action in DOM and visual order.
- Console errors/warnings, hydration, chunk, CSP, and image errors: 0; observed product 5xx/404: 0.

### Comparison history

#### Iteration 1

- Finding: [P2] The audited implementation nested a card inside broad page padding, leaving only `245.6px` of usable mobile reading width; the top return link was `20px` high and the desktop surface read like a management card rather than editorial content.
- Fix: removed the card background, radius, and shadow; widened the mobile reading column to `311.2px`; raised navigation and author actions to `44px`; strengthened the title hierarchy; and rebuilt the detail/comments flow as one journal surface.
- Post-fix evidence: the first production captures showed positive image dimensions, no horizontal overflow, `44px` actions, and a `26.7%` wider mobile content column.

#### Iteration 2

- Finding: [P2] The first implementation placed the final `게시판으로 돌아가기` action between the article and comments, interrupting the selected source's article-to-conversation continuity; desktop top spacing and the `37.6px` title were also looser than the source.
- Fix: moved the final return action after the comment composer, reduced desktop top and back-link spacing, and set the desktop title to `32px`.
- Post-fix evidence: the latest full and focused combined comparisons show article → comments empty state → composer → final return action, with the category/title/image block moved upward. Windows production QA reports no visual, runtime, or accessibility regression.

### Implementation checklist

- [x] Preserve official logo, colors, fonts, and existing auth/data behavior.
- [x] Recreate the selected journal-style article and continuous comment conversation flow.
- [x] Remove nested card chrome and recover useful mobile reading width.
- [x] Keep edit, delete, retry, empty, loading, disabled, and navigation states functional and accessible.
- [x] Verify Desktop, 390px Mobile, keyboard focus, image rendering, console, network, and no document overflow.
- [x] Compare the source and final implementation in combined full and focused evidence.

### Follow-up polish

- Capture populated comments, a long article, attachment content, and a normal publication date when approved synthetic fixtures are available.

## Directory and member profile design QA

- Desktop source visual truth: `/home/ginis/.codex/generated_images/019f4f96-1245-7ea2-8709-9a4b34ee179c/exec-ef2191cf-5d17-4280-baf1-0da5a30aa1b5.png`
- Mobile source visual truth: `/home/ginis/.codex/generated_images/019f4f96-1245-7ea2-8709-9a4b34ee179c/exec-83e1960c-7d36-4368-9514-1accf1ff64ed.png`
- Implementation captures: `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/01-directory-desktop.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/02-member-modal-desktop.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/03-directory-tablet.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/04-directory-mobile.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/05-directory-mobile-filters.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/06-member-modal-mobile.png`
- Combined comparisons: `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/directory-comparison-desktop.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/directory-comparison-mobile.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-directory-260713/directory-comparison-modal.png`
- Viewports: desktop `1440×1024`; tablet `768×900`; mobile `390×844`
- State: production runtime, authenticated synthetic E2E member filtered by name; no member, profile, or fixture mutation

### Findings

No actionable P0, P1, or P2 differences remain.

- [P3] The desktop implementation retains a restrained bordered filter panel instead of the source's open filter row and active-filter chips.
  - Location: directory search and filter controls.
  - Evidence: the combined desktop comparison shows the same wide search, cohort, sort, disclosure, and immediate result flow; the implementation uses the repository's existing form-surface language and live URL summary instead of introducing a second chip interaction model.
  - Impact: minor source-fidelity difference only; filter behavior and result access remain clear.
  - Follow-up: reconsider chips only if multiple simultaneous filters become common in real usage.

- [P3] The source mobile card uses a visually separate full-width profile button, while the implementation makes the whole card operable and presents the final action as a label and arrow.
  - Location: mobile and tablet member cards.
  - Evidence: the combined mobile comparison preserves identity, cohort, email, organization privacy, visibility, and final profile action in the same order. The implementation's complete `311.2×230.4` card is keyboard and pointer operable.
  - Impact: intentional accessibility improvement with a small visual difference.
  - Follow-up: none unless user testing shows the whole-card behavior is insufficiently discoverable.

- [P3] The selected desktop source contains several representative rows and a populated work section, while the safe local fixture provides one member without work data.
  - Location: directory result density and member modal work section.
  - Evidence: the final production captures use the real filtered API state; the work section is correctly omitted and no placeholder row or invented profile data is rendered.
  - Impact: long company names, dense pagination, and populated work hierarchy remain visual coverage limits rather than current defects.
  - Follow-up: repeat the visual check when approved representative synthetic fixtures are available.

### Required fidelity surfaces

- Fonts and typography: passed. Existing Pretendard and KoPub variables remain authoritative; the page now has a semantic `h1`, a clear result heading, stronger member identity, and readable Korean wrapping at every tested width.
- Spacing and layout rhythm: passed. Desktop uses a full-width editorial result row, while widths below `1024px` switch to cards. The collapsed filter keeps results near the top, and the expanded mobile filter uses a compact two-column grid.
- Colors and visual tokens: passed. Existing Sogang burgundy, warm-white surfaces, neutral rules, muted metadata, and brand focus ring are preserved. No unrelated palette or gradient was introduced.
- Image and icon fidelity: passed for the available state. Initial avatars are purposeful fallbacks, and Phosphor icons provide search, filtering, privacy, contact, work, support, and directional cues without hand-built SVGs.
- Copy and content: passed. Korean labels explain search, privacy, profile actions, and support in user language. Raw `all`, `cohort`, `private`, roles, status, internal IDs, and repeated `공개하지 않음` strings are not exposed.

### Responsive and interaction evidence

- Desktop result row: `1024×116`; profile action `97.525×44`; no eight-column table remains.
- Tablet document: `scrollWidth=clientWidth=753`; the table is absent and a profile card is shown without fragmented columns.
- Mobile document: `scrollWidth=clientWidth=375`; collapsed search controls lead directly to the first result card.
- Mobile advanced filter: `277.6×298.7625`, reduced from the first implementation's `454.7375px`; five inputs are `44px` high in a two-column grid and reset is `277.6×44`.
- Mobile result heading moves to document Y `813.1375px`, about `163px` earlier than the failed layout's expected position.
- Search query and sorting synchronize to the URL and survive reload; reset restores `/directory` and the default sort.
- Modal uses `aria-modal=true`, an accessible `회원 정보` name, `44×44` close control, focus trap, Escape dismissal, and focus return to the calling profile action.
- Console errors/warnings, hydration, chunk, CSP, and image errors: 0; observed product 5xx/404: 0.

### Comparison history

#### Iteration 1

- Finding: [P1] The audited `768px` layout retained an eight-column desktop table, causing member details to fragment into two or three lines and making comparison difficult. Desktop filters also dominated the results, privacy placeholders repeated across columns, and the page title was an `h2` without an `h1`.
- Fix: moved the desktop list breakpoint to `1024px`, introduced editorial rows at desktop and profile cards below it, collapsed advanced filters by default, consolidated privacy into one summary, and promoted the page title to `h1`.
- Post-fix evidence: Windows production QA confirms no visible table at `768px`, no horizontal overflow, a full-width desktop row, one privacy summary, and stable search, sort, reset, modal, focus, and URL behavior.

#### Iteration 2

- Finding: [P1] The first mobile implementation stacked all five advanced fields vertically, increasing the expanded filter from the audited `423.9375px` to `454.7375px` and pushing results farther down.
- Fix: changed the advanced filter to a two-column mobile grid and made reset span both columns while retaining the six-column desktop expansion.
- Post-fix evidence: focused Windows production QA measures `298.7625px`, a `34.3%` reduction from the failed implementation and `29.5%` below the audit baseline; inputs and reset remain `44px`, with no overlap or document overflow.

#### Iteration 3

- Finding: [P1] PR review found that collapsing advanced filters also hid the only general reset action, so users with successful basic search results had to clear fields individually or open the advanced panel first.
- Fix: added a result-summary reset action whenever search, sort, or page state differs from the default; kept the advanced-panel reset; distinguished public organization and private organization icons; added narrow-grid protection and automated coverage for disclosure, one-click reset, editorial rows, modal focus trap, and focus return.
- Post-fix evidence: Windows production QA verifies a `109.925×44` reset action at both `390px` and `1440px`, one-click restoration to `/directory`, automatic disappearance in the default state, the existing `298.7625px` compact filter, card/list breakpoints, modal keyboard behavior, and zero console or HTTP errors. Public-organization icon rendering remains browser-blocked by fixture absence, while private organization retains the correct lock icon and the public branch is fixed in component code.

### Implementation checklist

- [x] Preserve official logo, colors, repository fonts, and existing privacy behavior.
- [x] Replace the tablet table with readable cards and provide scalable desktop editorial rows.
- [x] Keep advanced filters collapsed by default and compact when expanded on mobile.
- [x] Consolidate privacy language and rebuild member detail as identity, contact, optional work, visibility, and support.
- [x] Preserve search, sort, URL recovery, reset, modal focus, Escape, and focus-return behavior.
- [x] Verify Desktop, Tablet, Mobile, expanded filters, modal, console, network, and document overflow in production Chrome.
- [x] Compare the selected source and final implementation in combined desktop, mobile, and modal evidence.

### Follow-up polish

- Recheck dense result lists, long organization names, populated work details, and multiple pages when approved representative synthetic fixtures exist.

final result: passed

## My profile and privacy design QA

- Source visual truth: `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/source-hybrid.png`
- Implementation mobile captures: `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/implementation-mobile.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/implementation-mobile-lower.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/implementation-mobile-contact-open.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/implementation-mobile-change-request.png`
- Implementation desktop captures: `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/implementation-desktop.png`, `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/implementation-desktop-lower.png`
- Full-view mobile comparison: `/home/ginis/sogecon-app/.artifacts/design-qa-me-233/comparison-source-vs-implementation-mobile.png`
- Viewports: mobile `390×844`; desktop `1440×1024`; responsive smoke `768×900`
- State: production runtime, authenticated synthetic E2E member; no profile save, avatar upload, change-request submission, database, or fixture mutation

### Findings

No actionable P0, P1, or P2 differences remain.

- [P3] The final privacy section begins at document Y `455.39px`, `5.39px` below the focused `450px` art-direction target.
  - Location: mobile `fieldset[aria-describedby="profile-visibility-help"]`.
  - Evidence: the final source-to-implementation comparison and browser rect measurement show preview, privacy, summaries, save, and change-request entry in the intended order; save is at `793.39px` and change request at `942.19px`, both within their acceptance targets.
  - Impact: no meaningful discovery or task-flow cost; the difference is a small spacing variation.
  - Follow-up: none unless later content-density testing requires another compact pass.

- [P3] The source uses a filled muted-rose avatar, while the implementation uses the repository's existing pink outline fallback for members without an uploaded image.
  - Location: identity and directory preview avatars.
  - Evidence: both final mobile and desktop captures use the same purposeful repository fallback and a real 44px photo-change control.
  - Impact: minor visual-source difference only; no placeholder box or broken asset is shown.
  - Follow-up: verify a real uploaded avatar when an approved synthetic image fixture is available.

### Required fidelity surfaces

- Fonts and typography: passed. Existing Pretendard and KoPub variables remain authoritative; the semantic `h1` is followed by `h2` sections, identity and status are compact on mobile, and desktop hierarchy remains unchanged.
- Spacing and layout rhythm: passed. The selected privacy-first order is preserved, the mobile document shrank from `1839px` during the failed iteration to `1482px`, and the save and change-request actions now meet their focused document-position targets.
- Colors and visual tokens: passed. Existing Sogang burgundy, navy text, warm-white surfaces, neutral rules, semantic success color, and brand focus ring remain in use without a new palette or gradient.
- Image and icon fidelity: passed for the available state. The official header logo remains intact; Phosphor icons provide camera, privacy, contact, organization, status, and change-request cues; no hand-built SVG or fake asset was introduced.
- Copy and content: passed. Korean identity, saved/dirty state, privacy impact, contact and organization summaries, support, and change-request copy use user language and expose no raw enums, internal IDs, HTTP text, or serialized objects.

### Responsive and interaction evidence

- Mobile document: `scrollWidth=clientWidth=375`; clipped or overlapping controls: 0.
- Final mobile positions: preview `276.99px`, privacy `455.39px`, summaries `634.99px`, save `793.39px`, change-request entry `942.19px`.
- Photo change, change-request actions, lunar checkbox label, inputs, and primary actions retain at least a `44px` operable area.
- Privacy choices expose accessible names for all members, same cohort, and private; their help and live status update with the selection and return to `all` without saving.
- Contact and organization summaries use matching `aria-expanded`, `aria-controls`, and hidden targets, and the single-section state closes one when the other opens.
- Dirty feedback changes both the top status and save CTA, then returns to the saved state when the temporary edit is reverted.
- Desktop document: `scrollWidth=clientWidth=1440`; responsive smoke at `768px` and `1440px` found no clipped controls.
- Console errors/warnings, hydration, chunk, and CSP errors: 0; observed product 4xx/5xx: 0.

### Comparison history

#### Iteration 1

- Finding: [P2] The audited page was a roughly `1365px` undifferentiated form with the save action about `1662px` below the heading, weak section semantics, a native privacy select, and a lunar-checkbox hit area below `44px`.
- Fix: rebuilt the page as identity and save status, directory preview, three descriptive privacy radio cards, collapsed contact and organization summaries, a clear save boundary, and a separate change-request module.
- Post-fix evidence: automated tests, lint, production build, and repository guards passed; Windows production QA confirmed the new hierarchy, privacy behavior, dirty state, 44px controls, and responsive stability.

#### Iteration 2

- Finding: [P1] Browser QA initially appeared to show a contact/organization accordion mismatch, and the implementation allowed both independent panels to remain open.
- Fix: replaced two booleans with a single explicit `openSection` state and added regression coverage proving the newly opened panel closes the other.
- Post-fix evidence: fresh production Chrome checks showed contact opens only contact fields, organization opens only organization fields, and button, target, and label visibility remain aligned.

#### Iteration 3

- Finding: [P2] The first redesign still placed preview at `468.99px`, privacy at `691.39px`, save at `1135.39px`, and change request at `1292.19px`, giving photo editing more mobile priority than the privacy task.
- Fix: hid the explanatory paragraph visually on mobile while keeping it accessible, integrated photo change into the identity avatar, compacted the identity row, and reduced mobile preview, privacy, summary-row, and section spacing without changing desktop density.
- Post-fix evidence: final production Chrome measurements are preview `276.99px`, privacy `455.39px`, save `793.39px`, and change request `942.19px`; the full-view comparison classifies the remaining `5.39px` privacy spacing difference as P3.

#### Iteration 4

- Finding: [P1] PR review found that the mobile camera action targeted a file input inside a `display:none` responsive parent and that the visually hidden privacy radios had no card-level keyboard focus ring. It also identified loading/empty ambiguity, URL resolver drift, missing mobile upload guidance, and missing validation-open coverage.
- Fix: moved the shared file input into the always-active DOM, restored the mobile size/type guidance, added `focus-within` rings to privacy cards, switched avatars to `resolveApiAssetUrl`, separated change-request loading from empty state, and added focused regression tests.
- Post-fix evidence: targeted profile, change-request, and asset URL tests pass together with the full Web suite, lint, and production build. Windows production focused QA opened and cancelled the native file chooser from the mobile camera action, found no `display:none` ancestor on the shared file input, confirmed the visible mobile upload guidance, and verified keyboard movement plus the white-offset brand ring on all privacy cards. With the new guidance line, focused mobile positions are preview `304.99px`, privacy `483.39px`, save `821.39px`, and change request `949.39px`; the document remains `390/390` with no P2 impact. Loading-versus-empty timing is covered by the focused automated test because the Browser Control interception could not reliably pause the server-side request.

### Implementation checklist

- [x] Preserve the official logo, repository fonts, Sogang color system, existing auth, profile, privacy, and change-request contracts.
- [x] Show identity, saved/dirty status, and the directory-facing profile preview before editing details.
- [x] Replace the opaque privacy select with accessible, descriptive radio cards.
- [x] Collapse contact and organization fields into accurate one-at-a-time summaries with validation recovery.
- [x] Keep save and name/cohort change-request boundaries separate and explain empty request history.
- [x] Verify Mobile, Tablet, Desktop, keyboard focus, 44px actions, accordion mapping, privacy state, dirty recovery, console, network, and no document overflow.
- [x] Compare the selected source and final implementation in one full-view mobile evidence image.

### Follow-up polish

- Recheck a completed avatar upload, populated change-request history, and long organization/address content when approved synthetic fixtures are available.

final result: passed
