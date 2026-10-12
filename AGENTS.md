# Repository instructions

Work only on **magalykhoury/privacy-curtain**. `origin` and `remote.pushDefault` target that repository. Never push to **mini-dev-tools/privacy-curtain**; the `legacy-readonly` remote is a historical reference with pushes disabled. Do not force-push or discard existing changes.

Keep the original blue Privacy Curtain design, implemented in the current React architecture. Historical UI files are visual references only. Preserve the modern blur engine, independent WhatsApp scopes, preference keys, storage migration and synchronization. Do not restore old JavaScript or selectors.

Read `CLAUDE.md` and `README.md` for architecture and checks. Before source changes, make a complete, timestamped external backup and verify its file inventory and SHA-256 hashes. Preserve release archives and existing user edits, including `public/assets/popup.css` and the untracked instruction document.

Never modify the installed Chrome Web Store extension or the user's Chrome profile. Use only synthetic fixtures and disposable profiles for automation; do not access private conversations or credentials. Do not submit or publish an extension release without explicit authorization.
