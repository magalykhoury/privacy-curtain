# Privacy Curtain 2.0

Privacy Curtain is a local Chrome extension for selective visual blurring on WhatsApp Web, Gmail, Outlook and Microsoft Teams. Preferences use `chrome.storage.sync`; the extension does not collect messages, contact names, email subjects or email bodies. Sync may synchronize preferences through Chrome when browser sync is enabled.

**Release status: development candidate.** The user reports WhatsApp blurring works correctly in 2.0.2. Automation uses synthetic DOM fixtures and mocked Chrome APIs; it has not inspected the user's authenticated session. Gmail, Outlook and Teams still require live acceptance checks. A successful build or a green test suite does not prove coverage on every live account.

Current development version: **2.0.3**. This UI-only update restores the original blue-and-white appearance, icon buttons, rounded switches and two-column chat settings at the original 640 px width. The working 2.0.2 engine and storage mappings are unchanged. See [visual restoration, verification and exact reload instructions](docs/BLUE_UI_RESTORATION.md). WhatsApp's outside and inside masters remain independent; see [the scope fix and count-only diagnostic guide](docs/WHATSAPP_SCOPE_FIX.md).

The platform icon buttons now sit directly below the Privacy Curtain header. The current-website information box is removed on every page; website detection still selects the appropriate platform automatically, and each platform retains its protection switch and blur controls. This compact popup update keeps version 2.0.3. Reload **Privacy Curtain Dev** at `chrome://extensions` in the existing test profile, then reopen its popup; do not remove it or clear its saved settings.

The repository destination is **[magalykhoury/privacy-curtain](https://github.com/magalykhoury/privacy-curtain)**. `origin` and the default push destination point only there. The original repository is retained locally as `legacy-readonly`, with its push URL disabled. Work belongs to the new repository; never push to the original. Historical branches retain the original local main, the published GitHub main and the Gmail branch without merging old functionality into the modern engine.

## Safely load the development extension

The ready-to-test build is:

`C:\Users\User\Desktop\internship\refactor\privacy-curtain\builds\development-v2`

1. Create a separate Chrome profile from Chrome's profile menu. Continue without signing into Chrome, so browser settings and extension preferences do not sync with your usual profile.
2. In that new profile, open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select **builds/development-v2**, the folder containing `manifest.json`. Do not select the source root, the old `dist`, or a directory inside Chrome's own profile.
4. Confirm the extension is named **Privacy Curtain Dev**. No fixed manifest key or update URL is embedded. It has independent extension storage in this separate, unsigned-in profile.
5. Pin it if desired. Open WhatsApp Web there and link a test account yourself if needed. No automation accesses your conversations or credentials.
6. Refresh the website after the initial load. Choose categories in the popup; fresh installations keep category toggles off. Verify each category before relying on the extension.
7. After code changes, run `npm run build:dev`, then reload **Privacy Curtain Dev** in this separate profile and refresh the test tabs. Leave the installed v1.0 extension in your normal profile unchanged.

The extension has not been automatically installed, reloaded or submitted to the Chrome Web Store. Do not load the production build into your usual profile during testing.

## WhatsApp manual acceptance checklist

Start with platform protection on, both **Outside Blur everything** and **Inside Blur everything** off, and Hover to reveal off. Use only a test account and do not share real page HTML, messages, names or screenshots.

- With **Profile pictures** alone enabled, inspect individual and group avatars and default avatar icons. Names and previews should stay readable.
- With **Contact and group names** alone enabled, check individual and group names, including names rendered without the old CSS classes. Avatars and previews should stay readable.
- With **Conversation previews** alone enabled, check last-message text and group previews. Names and avatars should stay readable.
- Open a conversation. Verify **Header picture**, **Header name**, **Incoming and outgoing messages**, and **Images and media** independently. Search, send, menu and compose controls should stay usable and unblurred.
- Turn on **Outside Blur everything** with every inside switch off. Only list avatars/names/previews should blur. Turn it off: all its blur should clear. Opened messages and media must stay clear throughout.
- Turn on **Inside Blur everything** with outside controls off. Check header/message/media protection; the conversation list must remain clear. Test inside individual switches independently, then both masters on and all-off.
- Enable **Hover to reveal**. Hover a name, avatar, preview or message individually. Only its intended target should reveal. Move away: it should immediately blur again. Disable hover: the content must stay blurred even under the pointer.
- Scroll far enough to virtualize the list, search/archive conversations where applicable, switch chats, refresh and navigate back/forward. Newly appearing matching items should already be blurred.
- Open a second WhatsApp tab. Change a category in the first popup and confirm both tabs update. Pause WhatsApp protection and resume: the chosen categories should be retained.
- Keep WhatsApp active but select Gmail, Outlook or Teams in the popup. Change a preference there and verify only that platform's open tabs use it.

Record any uncovered category as a failed acceptance check. The candidate must not be described as live-compatible until all relevant checks pass. See [the investigation and limitations](docs/MODERNIZATION.md).

## Controls and behavior

WhatsApp has separate conversation-list controls (avatars, names, previews) and opened-conversation controls (header image/name, messages and media). Additional controls retain legacy usernames and latest-message text/images. **Images and media** is a new independent control; upgrading does not silently expand the old latest-image setting.

WhatsApp's existing `blurAll` key now controls the **outside list only**. Its new `pc_whatsapp_insideAll` key controls the opened conversation only and defaults off. The outside master never enables, disables or overwrites inside settings. Expand Additional controls when testing all-off to check the preserved legacy latest-message switches too.

Gmail, Outlook and Teams have their own panels. Their selectors are tested against synthetic structures; coverage on current live layouts, localized variants and embedded email frames still needs manual verification. Blur everything means every implemented category, not the entire application.

Platform protection pauses/resumes without overwriting individual choices. Each master overrides only its own scope while enabled and restores that scope's previous choices when switched off. Other platforms keep their platform-wide master. Hover reveal and blur intensity apply to all platforms. Intensity ranges from 3 to 16 px. Blur is a visual filter, not encryption or a guarantee that every text size is unreadable; select an adequate intensity for your display. Notifications, tooltips and content outside the configured selectors are outside coverage.

The popup restores the original Arial typography, `#3e50a1` blue accents, white surfaces, 54 × 28 px switches with white circular handles, 36 px platform icon buttons and rounded bordered fieldsets. WhatsApp and Teams have Outside Chat Options on the left and Inside Chat Options on the right; Gmail and Outlook each have a single Email Options fieldset with independent settings. The existing eye branding, keyboard controls, visible focus, system/light/dark themes, additional controls and diagnostics remain available. Its intrinsic content width is 640 px, independent of a small initial viewport. The main panel fits the available popup height up to 600 px, with one vertical scroll container when needed and no horizontal or duplicate outer scrollbars. Chrome may reserve a small native width allowance around the content.

## Development and testing

Use Node.js 22.12+ or Node.js 24 and npm. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if execution policy blocks the `.ps1` shims. `package-lock.json` is authoritative; `bun.lock` is preserved as a historical lockfile and has not been refreshed.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run build:dev
npm run check:build
npm run test:browser
```

Builds go to **builds/production-v2** and **builds/development-v2**. Existing `dist`, `dist.zip` and old assets are preserved. Only the explicit extension files and local popup assets are packaged. Builds retain old hashed files inside these output directories; `index.html` references the current assets.

Playwright tests use locally installed Google Chrome with fresh temporary contexts; they never use your current profile or install an extension. On machines without Chrome, install Playwright Chromium and change `channel: 'chrome'` to `channel: 'chromium'` in `playwright.config.js`. Popup tests serve the built production files on `127.0.0.1:4179`; build production first and leave that port free. Website test navigation is fulfilled with synthetic local HTML and external requests are blocked.

Unit tests cover selector generation, exact host detection, preference normalization, additive migration, patch-only persistence, platform-specific routing, multiple matching tabs and errors. Browser tests cover computed CSS, hover, each WhatsApp toggle, group chats, dynamic/recycled rows, conversation switching, navigation, refresh, style recovery, loading races, negative UI controls, the other platform fixtures, popup interaction, themes and simulated multi-tab storage events.

These tests do **not** exercise a real installed MV3 extension, real Chrome storage sync across devices or authenticated live website layouts. The manual checks above cover the remaining acceptance work.

The optional `npm run test:popup-native` command separately verifies native MV3 popup sizing and local CSS loading in project-local test Chromium with disposable test data. It does not use the user's Chrome profile. See [the popup test setup](docs/POPUP_LAYOUT_FIX.md) for the one-time browser installation and the scope of this check.

## Architecture and permissions

- `public/shared.js`: shared host registry, category selectors, defaults, validation, migration and CSS generation. Loaded before the content script and imported into the popup bundle.
- `public/content.js`: one idempotent CSS controller per supported page, storage-change subscription and narrowly scoped style repair. No body subtree scanning, message-content reads or History API patching.
- `src/preferences.js`: additive migration and validated single-key/patch writes. Messages refresh only matching platform tabs; tabs independently listen to storage. A missing script can be injected using bundled files.
- `public/background.js`: install/update migration only; no competing blurEnabled action engine, polling or injection of separate blur styles.
- `src/App.jsx` / `src/popup.css`: separate platform panels and accessible popup controls.
- `vite.config.js`: explicit extension file packaging, separate outputs, local assets and a distinctly named development build.

Permissions are limited to storage, scripting, activeTab and exact HTTPS hosts for `web.whatsapp.com`, `mail.google.com`, `outlook.live.com`, `outlook.office.com`, `outlook.office365.com`, `outlook.cloud.microsoft`, `teams.microsoft.com`, `teams.live.com` and `teams.cloud.microsoft`. There are no wildcard parent domains, broad tabs permission, telemetry or remotely hosted executable code. Popup CSP disallows network connections and remote scripts/styles/fonts.

Migration retains every existing platform preference key, preserves false values and adds metadata/master/general keys. No local or sync storage is cleared. Legacy-only `blurEnabled` profiles map to WhatsApp's outside master; existing WhatsApp category keys take precedence. Existing inside selections remain independent; the new inside master defaults off. Details and verification results are in [MODERNIZATION.md](docs/MODERNIZATION.md).
