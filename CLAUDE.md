# Privacy Curtain developer notes

Read `README.md` for development, testing and safe unpacked loading. Read `docs/MODERNIZATION.md` for the investigation, storage migration, architecture, evidence and remaining release gates.

- React 19 popup, Vite 6 build, JavaScript/JSX and local CSS; Chrome Manifest V3.
- `public/shared.js` centralizes platform detection, category selectors, defaults, validation and additive migration.
- WhatsApp `blurAll` is outside-only. `pc_whatsapp_insideAll` is the independent inside master, default false. Every WhatsApp option has an explicit scope; never let one master activate both. Count-only diagnostics are on demand in the popup; see docs/WHATSAPP_SCOPE_FIX.md.
- `public/content.js` is a classic content script loaded after shared.js. It uses one CSS controller per page and listens directly to preference storage changes.
- `src/preferences.js` is the popup's preference/routing boundary. Write validated patches, never stale full objects. Storage remains authoritative.
- `public/background.js` performs install/update migration only. Do not restore a competing global blur action engine.
- Preserve all saved preference keys and explicit false values. Never clear sync/local storage.
- Do not read or log message text, email bodies, contact names, cookies or credentials. No runtime telemetry or network dependencies.
- Keep exact supported hosts aligned across shared.js and the manifest; `npm run check:build` validates them.
- `npm run build` writes builds/production-v2. `npm run build:dev` writes separately named builds/development-v2. Preserve existing dist and dist.zip.
- The old public/assets/popup.css has a pre-existing user edit: do not overwrite it. It is intentionally not packaged. The historical bun.lock is preserved; use npm and package-lock.json.
- `npm test` covers core preferences, migration and routing. `npm run test:browser` uses synthetic fixtures and mocked Chrome APIs in fresh headless Chrome contexts. Build production first.
- Neither synthetic DOM tests nor a build verify compatibility with a live authenticated application. Manual release gates are documented; no installed Chrome profile/extension is to be modified automatically.
