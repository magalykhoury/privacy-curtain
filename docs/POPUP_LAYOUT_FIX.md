# Popup layout fix — development 2.0.2

## Investigation and reproduction

The v2.0.1 development HTML correctly referenced a present local stylesheet (`./assets/index-Dh21FJCh.css`) and module script. `base: './'` produces extension-relative URLs. No CDN or absolute Vite development-server asset URL is used in the unpacked build.

The old sizing rule was `body { width: 392px; max-width: 100vw; }`. Chrome automatically sizes an action popup from its contents, within a 25×25 to 800×600 px range ([Chrome action documentation](https://developer.chrome.com/docs/extensions/reference/api/action)). A viewport-relative cap lets a small initial viewport constrain the same contents Chrome uses to determine the preferred popup width.

A new regression was run against the original bundle at a 25 px initial viewport. The local stylesheet loaded with HTTP **200**, React mounted, and the width assertion failed with **25 px instead of 392 px**. This establishes a layout defect independently of CSS-fetch or React errors. Earlier tests used a wide viewport and did not check this bootstrap case.

The native MV3 check also reproduced the defect using a read-only copy of the backed-up 2.0.1 build: its stylesheet parsed successfully, but `html`, `body`, `#root` and `main.popup` were all only **58 px wide**, with main-panel horizontal content overflow (218 px scroll width). No existing Chrome profile was involved.

## Fix

- `html` and `body` explicitly declare `width` and `min-width` of **392 px**, with no `vw` cap. The popup's intrinsic width is independent of its initial viewport.
- `#root` and `main.popup` use the full available root width.
- `html`/`body` declare a preferred 600 px height and do not scroll. `main.popup` is the only vertical scroll container; its height fits the smaller of **600 px or the actual popup viewport height**. Keeping the preferred root height independent of the viewport avoids another bootstrap sizing loop, while fitting the panel prevents clipped bottom controls on smaller browser windows. Its horizontal overflow is suppressed and the tests also verify that its content fits without horizontal scrolling.
- Short content has no scroll overflow. Long platform controls, expanded settings and diagnostics still need vertical scrolling within Chrome's height limit; no controls are deleted to avoid that necessary scrolling.
- The development manifest and visible popup version are **2.0.2**. WhatsApp's existing 2.0.1 scope engine and preferences are unchanged.

The output folder remains `builds/development-v2`. Its current HTML references `./assets/index-CqZemdA1.css` and `./assets/index-B5RNQo85.js`; those files are present. The stylesheet is generated from `src/popup.css`; the preserved user edit in `public/assets/popup.css` is not packaged or loaded. Future builds may change the hashes, so always inspect the references in the current `index.html` rather than loading a stale asset manually.

## Verification

The browser regression suite passes **48 tests**, including four new intrinsic-width cases (initial viewports 25, 120, 320 and 392 px), one scroll-container check and one smaller-height/reachable-footer check. Each width test confirms a successful local stylesheet response, visible block layout and dimensions of `html`, `body`, `#root` and `main.popup`. It checks main-panel horizontal fit and the 600 px height cap. The height test scrolls the footer fully into a 510 px viewport. Layout JSON is attached to the test results. The existing interaction, theme, keyboard and WhatsApp scope regressions remain in the suite.

Both production and development builds, lint, and `npm run check:build` pass. The latter verifies every popup asset reference and that packaged extension scripts match source. The updated light-theme popup screenshot was visually inspected.

`npm run test:popup-native` adds a separate native MV3 popup check. It uses project-local Playwright Chromium (`.test-browsers`), a fresh disposable profile under `test-results`, and a copy of the development build. Only that copy receives an external layout-probe script. The script opens the actual action popup, reads dimensions and stylesheet-load status, and sends measurements to its own worker. No delivered extension source is instrumented; no user profile, account, messages or browsing data is read. The browser is closed and the unique temporary directory is removed after checking that its resolved location stays inside the workspace. The generated report is `test-results/popup-native-layout.json`.

Install the optional native-test browser on Windows PowerShell with:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location).Path '.test-browsers'
npx.cmd --no-install playwright install chromium --no-shell
npm.cmd run test:popup-native
```

The final **native MV3 test passed** in project-local Chromium 156. Its actual auto-sized viewport was **407 × 510 px**, including a 15 px native width allowance. All four root elements retained **392 px content width**. The stylesheet parsed successfully, the main panel fit the actual **510 px** available height, and only that panel scrolls. Its content had no horizontal overflow. An earlier overly strict viewport-equals-content assertion was corrected to account for native width allowance; the 392 px content-width assertions remain exact.

The native test also caught a height issue that a regular 600 px test viewport missed: before fitting the panel to the available viewport, a 600 px panel could be clipped inside a 510 px popup. The final height assertion and reachable-footer regression guard that case.

The ordinary 48-test suite uses HTTP-served bundles and mocked Chrome APIs; the native check exercises extension-origin resources, the actual action popup and real Chrome APIs in disposable test data. Neither test verifies authenticated WhatsApp selector coverage. Playwright's normal runner clears `test-results`, so run the native command after the ordinary suite if you want to retain its JSON artifact.

## Exact Chrome reload instructions

1. Use the separate test Chrome profile where **Privacy Curtain Dev** was loaded. Leave the installed Web Store v1.0 in your usual profile untouched.
2. Close the open Dev popup and its popup DevTools window.
3. In that test profile, open `chrome://extensions`. Find **Privacy Curtain Dev** and click its **Reload** button. Do not remove/reinstall it or clear any storage.
4. Check that Dev's version is **2.0.2**. Its loaded directory should be `C:\Users\User\Desktop\internship\refactor\privacy-curtain\builds\development-v2`.
5. Click the Dev toolbar icon again. The popup should have a usable **392 px** width with the branding, current-site panel, platform buttons and controls visible. Long content can scroll vertically; there should be no horizontal or duplicate outer scrollbar.
6. Refresh the WhatsApp test tab if you will also use its content controls/coverage diagnostics after reloading the extension. The popup layout fix does not establish live WhatsApp selector compatibility.

If the popup still differs, report only its four root dimensions and the current CSS request status from DevTools. Do not share private page contents or profile data.

## Safety checkpoint

Branch: `modernization/privacy-curtain-v2`; baseline `d1c4494`. Existing `public/assets/popup.css` user edits and the untracked instruction document were preserved.

Before changes, a complete backup was created at `C:\Users\User\Desktop\internship\refactor\privacy-curtain-backup-popup-fix-2026-10-12T17-57-02-716Z`, with its sibling `.verification.json`. **4,488 files / 233,204,329 bytes** were copied and every SHA-256 hash matched. Existing source, Git metadata, assets and release builds are included. No installed v1.0 extension or current Chrome profile was changed.
