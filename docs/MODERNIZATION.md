# Privacy Curtain 2.0 modernization record

Status: locally built development candidate, not published or installed into the user's profile. Live authenticated website acceptance is pending. The original instruction document remains unchanged and untracked.

## Safety inspection and backup

- Baseline branch: `main`; baseline commit: `3acb6d4` (name, popup size and icons). Recent history also included `70751a4`, `717cc44`, `31840d0` and `98f04f5`.
- Existing user change: `public/assets/popup.css`. It contains an extra `]` after the opening body rule; it was preserved byte-for-byte and is excluded from new builds.
- Existing untracked file: `Privacy_curtain_instruction.md`. Preserved and excluded from implementation commits.
- Complete backup: `C:\Users\User\Desktop\internship\refactor\privacy-curtain-backup-20261012-183740-781`.
- Verification inventory: `C:\Users\User\Desktop\internship\refactor\privacy-curtain-backup-20261012-183740-781.verification.json`.
- Verified **3,607 files / 59,221,709 bytes**, with matching SHA-256 hashes for every copied file. Git metadata, dependencies, assets, documentation, lockfiles, `dist` and `dist.zip` are included. No existing backup was overwritten.
- Working branch: `modernization/privacy-curtain-v2`.
- A later preservation check verified **21 files** covering the old `dist`, `dist.zip`, user CSS, instruction document and historical `bun.lock`; all still match the initial hashes.
- No destructive Git commands, profile access, extension registration changes, installed-extension edits, publishing or uploads were performed.

## WhatsApp investigation and evidence

The development source at the baseline used:

| Category | Old selector assumption | Failure or risk |
| --- | --- | --- |
| Profile pictures | `img[src]` across the page | Explains why images can continue matching when class names change; also catches unrelated images and chat media |
| Names | `span[title][dir="auto"]._ao3e` | Requires an obfuscated class even when title/direction metadata remains |
| Previews | `div._ak8k span.x1iyjqo2.x6ikm8r.x10wlt62.x1n2onr6.xlyipyv.xuxw1ft.x1rg5ohu._ao3e` | Any missing generated class breaks the match |
| Header picture/name | Global generated class combinations and `data-tab="6"` | No reliable boundary between list, header and unrelated UI |
| Opened messages/media | Long comma-separated selector strings | Appending `:hover` once leaves every earlier list member unconditional in the reveal rule |
| Everything | Individual categories plus one generated `role=listitem` class combination | A missing row class loses the extra coverage; row blur also causes overlapping parent/child filters |

The CSS bug was confirmed independently of site changes. `.first, .second:hover { filter: none !important; }` unblurs `.first` without hovering. The browser regression reproduces this old behavior, then verifies the replacement using computed styles. The implementation wraps the complete selector list in `:is(...)` before appending `:hover`, following [Selectors Level 4](https://www.w3.org/TR/selectors/).

The public unauthenticated WhatsApp page did not expose a signed-in chat DOM. No authentic sanitized DOM fixture was available. The user's screenshot was described in text; no actual screenshot was attached. The installed extension's files were not accessed.

Public primary project sources provide **selector evidence**, not live compatibility proof: [WPPConnect's chat-list detection](https://github.com/wppconnect-team/wppconnect-extension/blob/main/src/wa-js.ts) identifies `#pane-side`, chat-list test IDs and row roles; [WhatsBlur's own technical documentation](https://github.com/ErAnmolgurjar/WhatsBlur) identifies `cell-frame-title`, `cell-frame-label` and `cell-frame-secondary`. The new list rules use these attributes, scoped title/direction fallbacks and a shorter legacy preview fallback. They no longer require the long generated class combinations.

The local fixtures are **synthetic** and deliberately include fake names/content. They model evidence-backed list attributes plus candidate conversation/header/media structures from the old source. They are not a capture of the current authenticated application. Header title test IDs, generated-class fallbacks, missing test IDs, default avatar representations and media variants still need manual live verification. If the current site changes those structures, a selector update remains necessary; the engine must not be described as covering every live chat until acceptance passes.

## Previous and updated architecture

Previously, the popup read all storage, wrote the entire preference object on each click, grouped Gmail and Outlook, referenced undefined Outlook toggles and could route a selected platform's update to the active platform. The content script repeated CSS generation per category, accepted forced-platform/message preference overrides, removed and recreated styles, cleared site inline filters, observed the whole body and patched History API methods. The background worker had a separate `blurEnabled` action engine and conflicting stylesheet.

Now:

- `public/shared.js` owns exact HTTPS host detection, category definitions, defaults, validation, migration and a single CSS rule pair. The popup bundle, worker and content script use the same definitions.
- List rules are confined to WhatsApp's list roots/rows. Header and message/media rules are confined to `#main`. Blur everything combines all implemented categories rather than blurring the application or whole WhatsApp rows.
- Native buttons, editable fields and popup-menu controls are excluded from targets. Existing site inline styles are not cleared.
- `public/content.js` installs one guarded controller/style element. CSS automatically matches newly inserted and recycled elements, including same-host SPA navigation. One observer watches the document root, direct root children and the small style element for repair; it never observes the body subtree or scans conversation text.
- Known targets are temporarily concealed without hover while preferences load. On initial storage read failure this concealment remains. Once preferences load, only configured categories apply. Reveal/conceal has no filter transition.
- Content scripts subscribe to `storage.onChanged`. Messages only request a preference reread and cannot supply authoritative preferences or force another site's platform. Duplicate script injection reuses the controller.
- `src/preferences.js` validates patch-only writes, routes refresh messages to every exact-host tab for the selected platform, and safely attempts bundled script injection when a listener is missing. Closing/suspended tabs cannot roll back a successful preference write. Other tabs also update directly from storage events.
- The popup follows authoritative storage snapshots, including when another tab changes a preference during delayed refresh messaging. It offers separate platforms, pause/resume without erasing choices, accessible switches, appearance/reveal settings and error feedback.
- The worker performs additive install/update migration only. The competing action handler and legacy injected style are removed. Chrome does not dispatch the action click handler when the action opens a popup; see [Chrome action documentation](https://developer.chrome.com/docs/extensions/reference/api/action).

## Features and intentional changes

- WhatsApp: list avatars/default group icons, names/group names and previews; separate header image/name, incoming/outgoing text and media. Latest-message text/images and usernames remain available as additional legacy controls.
- New `blurChatMedia` covers matched conversation media. The old `blurChatLastImage` retains latest-message behavior; it is not silently repurposed into all media.
- Gmail: sender variants, subjects, previews and matched email content; the previous whole-row all setting remains.
- Outlook: separate sender/subject/preview/content controls and its independent all setting. Existing generated Outlook row selectors are retained and their age is a known compatibility risk. Content rules match only the defined document structure and do not cover cross-origin email frames.
- Teams: named chat/header/message/media categories. Broad `.fui-Text` / arbitrary `dir=auto` message selectors were removed because they also blur unrelated UI and drafts; avatar targeting is scoped to chat lists and headers. Sites lacking those boundaries require a selector update. This narrowing is intentional and documented rather than a silent loss of coverage.
- The unused Universal Blur label and dead controls/references are removed. No universal all-site blur is advertised; its stored key is not deleted.
- Category defaults remain off; existing true/false choices are preserved. Hover defaults on to retain v1 behavior and can be disabled. Intensity is validated from 3 to 16 px; theme can be system/light/dark.
- Popup assets are bundled locally; the Bootstrap Icons CDN stylesheet and sample favicon are no longer loaded. Existing branding is retained. The popup is 392 px wide, adapts to narrower viewports, and scrolls within a 600 px height cap.

## Storage migration

No old keys are renamed or deleted. No storage area is cleared. Only known preference keys are read; unknown stored entries remain untouched. Flat per-platform v1 flags have precedence over the unused legacy global flag.

| Keys | Behavior |
| --- | --- |
| Existing `blur*`, `gmailBlur*`, `outlookBlurAll`, `teams_blur*` keys | Retained, with explicit booleans preserved |
| `blurEnabled` only, without any WhatsApp category/all key | Explicit true/false maps to WhatsApp all/protection state; original key remains |
| `blurEnabled` alongside any explicit WhatsApp category/all key | Category settings take precedence, avoiding accidental global enable/disable |
| `pc_settingsVersion` | Additive schema marker set to 2 |
| `pc_whatsapp_enabled`, `pc_gmail_enabled`, `pc_outlook_enabled`, `pc_teams_enabled` | Master pause/resume keys; default true without selecting categories |
| `pc_hoverReveal`, `pc_blurIntensity`, `pc_theme` | General preferences; defaults true, 5 px, system |
| `blurChatMedia`, `gmailBlurContent`, individual `outlookBlur*` keys | New independent controls; default false |

Missing/malformed flags use defaults rather than JavaScript truthiness. Invalid intensity/theme values are validated in memory; malformed raw keys and unrelated settings are not broadly rewritten. Migration is idempotent for representative v1 and legacy-only settings. Actual installed v1 storage was not inspected. Chrome handles cross-tab preference events and optional cross-device synchronization; see [storage API documentation](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Manifest, security and privacy

Manifest V3 is retained with local classic content scripts and a service worker. Minimum Chrome version is 111. Existing `storage`, `scripting` and `activeTab` permissions are retained; no broad `tabs` permission is added. Every host is an exact HTTPS match, and permission/content-script/detection lists are checked for agreement.

Added hosts are `outlook.office365.com`, `teams.live.com`, `teams.cloud.microsoft` and `outlook.cloud.microsoft`. Microsoft documents the organizational Outlook/Teams variants in [Microsoft 365 endpoint guidance](https://learn.microsoft.com/en-us/microsoft-365/enterprise/urls-and-ip-address-ranges?view=o365-worldwide) and personal Teams in [Teams for Personal on the web](https://insider.teams.com/blog/teams-for-personal-web/). Domain legitimacy is verified; authenticated DOM compatibility on those variants is not.

Popup CSP permits self-hosted scripts/styles/fonts and disallows connections and objects. The runtime source adds no fetch, XHR, telemetry, tracking or remote code. It does not collect, log, store or transmit page text. Worker warnings contain generic errors only. Chrome sync stores preferences only; no custom network service is used. Browser popup tests reject any external request.

This remains visual concealment: it does not protect notifications, native title tooltips, screen readers, clipboard content, unknown layouts, arbitrary page scripts, cross-origin frames, OS screenshots taken during an allowed reveal, or data already held by the website. Blur strength must be adequate for the displayed text size.

## Validation and phase checkpoints

The first functional milestone was WhatsApp: 9 unit checks, scoped lint and 17 headless Chrome fixture tests passed before the popup redesign. The refactored engine and separated settings then passed 16 unit checks and full lint. Popup, other-platform and multi-tab checks were added incrementally; final results are recorded after the last run.

| Check | Result / evidence scope |
| --- | --- |
| `npm test` | 16 unit tests passed: selectors, exact hosts, each platform's settings, migration, routing, persistence and errors |
| `npm run test:browser` | 35 headless Chrome tests passed on local synthetic fixtures/mocked Chrome APIs, including the CSS bug reproducer, every WhatsApp toggle, group/header/incoming/outgoing/media targets, dynamic items, hover/reconceal, negative controls, navigation/refresh, startup race, style recovery, unsupported pages, other platforms, popup interactions, storage races, themes and simulated multi-tab updates |
| `npm run lint` | Passed, including shared/content/worker code, popup, build scripts and tests |
| `npm run build` | Passed with Vite 6.4.4; output `builds/production-v2` |
| `npm run build:dev` | Passed; output `builds/development-v2`, named Privacy Curtain Dev |
| `npm run check:build` | Both outputs passed manifest, source equality, local popup references, icon, CSP and exact-host checks |
| Dependency audit | Compatible `npm audit fix` updates reduced 15 findings to zero; no force/major-version upgrade used |
| JavaScript / imports | Builds passed; tested popup and other-platform fixtures produced no page errors |
| Light/dark / accessibility | Keyboard switches, visible focus, reduced motion, 320 px width and theme render checks passed; both synthetic theme screenshots inspected |
| Old artifacts / user changes | 21 protected file hashes still match backup |
| Live authenticated sites / installed MV3 integration | Not tested; no credentials/private account/profile access used |

Playwright uses fresh temporary contexts of installed Chrome, not the user's profile. Every fake website response is fulfilled locally. Chrome extension APIs are mocked, including storage and messaging; a passing fixture is not an MV3 integration or live website compatibility result. Real cross-device sync, page CSP behavior, permission/site-access withholding and full browser performance under real workloads remain manual checks. No claims of live acceptance are made.

The source/checkpoint reports were delivered during implementation. The final implementation can be committed on the isolated branch after all checks, excluding the pre-existing user changes and generated outputs. No release archives or old source assets were deleted; `bun.lock` stays historical, with npm's updated lockfile authoritative.

## Files and testing deliverables

Modified: `.gitignore`, `README.md`, `CLAUDE.md`, `eslint.config.js`, `index.html`, `package.json`, `package-lock.json`, `public/content.js`, `public/background.js`, `public/manifest.json`, `src/App.jsx`, `src/main.jsx`, `src/popup.css`, `vite.config.js`.

Added: `public/shared.js`, `src/preferences.js`, `playwright.config.js`, `scripts/check-build.js`, `scripts/serve-test.js`, `tests/core.test.js`, `tests/preferences.test.js`, `tests/fixtures/whatsapp.html`, `tests/fixtures/mail-teams.html`, `tests/browser/mock-chrome.js`, `tests/browser/whatsapp.spec.js`, `tests/browser/platforms.spec.js`, `tests/browser/popup.spec.js`, `tests/browser/multi-tab.spec.js`, this document.

Removed files: none. The unused source assets and old `public/vite.config.js` are preserved but not copied into builds. The user's modified `public/assets/popup.css` is not an implementation change.

Generated, ignored artifacts: `builds/production-v2`, `builds/development-v2`, `test-results/popup-light.png`, `test-results/popup-dark.png`. New builds intentionally do not overwrite the old `dist` or `dist.zip`. The build completeness check validates the new deliverable folders instead of treating the old `dist` as a v2 release.

For exact safe installation and per-category manual WhatsApp acceptance steps, use [README.md](../README.md). Neither development nor production has been loaded into the normal profile automatically. No manifest key/update URL is present; the separate unsigned-in test profile prevents storage collisions with the installed copy.

## Installed copy and remaining release gates

The user reports that the installed v1.0 background script differs from this development source. The development baseline's legacy action handler and GET_BLUR_STATE listener are documented above. The actual installed script and storage were not read, so the installed/source diff is **unknown**; it cannot safely be presented as a verified file comparison. The installed extension remains untouched.

Before a release, manually verify every category against the current WhatsApp DOM and each supported Gmail/Outlook/Teams variant using test accounts. Obtain only intentionally sanitized structural fixtures if selectors need adjustment, never private DOM dumps. Retire generated-class fallbacks after authentic structural fixtures cover their variants. Verify native MV3 installation/CSP/site access, migration from the actual released settings schema, real browser performance and multi-device sync. These are release gates, not claims fulfilled by the local tests. Do not publish this candidate without a separate user instruction.
