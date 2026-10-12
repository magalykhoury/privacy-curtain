# WhatsApp scope isolation — development 2.0.1

## Confirmed cause and evidence limits

In 2.0.0, `public/shared.js:buildCSS` selected every WhatsApp category with `all || prefs[key]`, where `all` was `prefs.blurAll`. This meant an outside master activated `#main` header, message and media selectors regardless of their individual switches. The popup also checked/disabled inside controls using the same global `all`. The original master regression incorrectly required both scopes to blur.

The new outside-only regression was run against 2.0.0 and failed on the generated header rules. With individual preferences false, turning off `blurAll` already produced empty CSS in the old pure generator; this is consistent with it causing the unwanted inside blur. Browser regressions now check the full on/off behavior using computed styles, including ancestors, rather than only checking the generated text.

The user's live report confirms missing sidebar names/previews and incorrect inside blur in their test. It does not reveal the current signed-in DOM structure or active script version. We have not accessed the account, profile or live DOM, and cannot confirm why sidebar selectors miss or why blur appears after about a minute. The extension has no one-minute delay timer. Storage loading/error concealment, stale scripts and selector mismatch can be distinguished using the new report; they are investigation possibilities, not verified causes.

## Settings and scope boundaries

| Setting | Scope | Effect |
| --- | --- | --- |
| `blurAll` / Outside Blur everything | Outside only | Combines list avatars/default icons, names/group names, previews and legacy username labels |
| `blurImage`, `blurName`, `blurMessage`, `blurUsername` | Outside only | Individual list categories |
| `pc_whatsapp_insideAll` / Inside Blur everything | Inside only | Combines header, incoming/outgoing text, media and legacy latest-message controls; defaults false |
| `blurChatImage`, `blurChatName`, `blurChatAllMessages`, `blurChatMedia`, `blurChatLastImage`, `blurChatLastMessage` | Inside only | Independent opened-conversation categories |
| `pc_whatsapp_enabled` | Both | Pauses/resumes the selected configuration without changing any category or master preference |

Every WhatsApp option has an explicit `outside` or `inside` scope. `getActiveOptions` uses the corresponding master only. `getOptionSelectors` guards the final target: outside must be inside a list root and outside `#main`; inside must be inside `#main` and outside list roots. Both scopes share one safe blur/hover rule pair, preserving the comma-selector fix and preventing conflicting category rules.

Turning off Outside Blur everything restores outside individual selections and does not write any inside key. If every individual switch and both masters are off, the owned stylesheet is empty. If an inside switch was explicitly on, it stays on and its blur remains. No storage is cleared or renamed. Existing `blurAll` is deliberately narrowed to the outside scope; the new inside master is not automatically enabled during migration.

Before asynchronous preferences load, known targets in both scopes are temporarily concealed with hover disabled. This is a separate startup safeguard, not the outside master's behavior. Diagnostics label this `loading-concealment` or `storage-error-concealment`, with `ready: false` and `preferences: null`. Once loaded, `phase: configured` applies only the chosen scopes. All-off behavior is verified after preferences load. A loading/error report lasting a minute requires investigation; waiting is not an acceptance result.

## Exact CSS source and count-only diagnostics

The new build labels its engine `2.0.1-whatsapp-scopes` and marks its style element with the same revision. The CSS generator is `public/shared.js:buildCSS`; the owner/controller is `public/content.js`. The single generated DOM stylesheet is `#platform-blur-style`, attached to the document root. The background worker only migrates preferences; it does not produce active blur CSS.

With WhatsApp Web active in the separate test profile, open Privacy Curtain Dev, expand **WhatsApp coverage diagnostics**, and press **Check WhatsApp coverage**. The popup requests an on-demand report from its own content script. It does not reinject scripts or change preferences when checking. Older content scripts that cannot supply the expected revision produce a refresh instruction rather than an apparent successful check.

The report includes:

- Engine revision, `ready`, phase, storage-error flag and load-attempt count.
- Owned style instance count, whether it is mounted, whether revision/CSS match the controller's expected CSS, whether rules are active, and presence of the known old `#whatsapp-blur-style`.
- Applied preference booleans and blur intensity; no account/device/extension IDs or page URL.
- Counts for fixed known roots, row roles, title/direction patterns and the list title/preview test IDs.
- Each static category selector and its guarded CSS target, match counts split between sidebar/header/conversation/other, and direct computed-filter counts. Categories distinguish stored selection from effective master activation.

No matching nodes, text content, actual title/ARIA values, contact names, message/email bodies, IDs from messages, media URLs, HTML snapshots or arbitrary page stylesheet text are returned. Only the extension's own generated stylesheet is compared to its expected CSS; its raw text is not exported. The report is kept in popup memory and is not logged, stored or transmitted to an external service. Diagnostics run only on a button press. Filter/region inspection is bounded to the first 250 matches per selector and explicitly marks truncated samples. Matching itself queries the fixed selectors once per report.

Interpretation:

- `engineRevision` should be `2.0.1-whatsapp-scopes`, `ready` true, and `phase` configured. If not, reload Dev and refresh the page before assessing controls.
- `style.instances` should be 1; `revisionMatches` and `cssMatchesExpected` should be true. A mismatch or known legacy style signals stale/competing rules; no unrelated stylesheet is deleted automatically.
- With only the outside master on, inside categories must have `active: false`; outside CSS targets must have zero header/conversation matches. Opened-conversation matches may still be listed as candidates for inactive inside controls, but should have no filter when all inside settings are off.
- Zero `blurName` / `blurMessage` candidate or guarded sidebar matches indicates that those selector assumptions miss the current layout. Nonzero matches alone are not proof that every live item is concealed; visually verify the list. Direct filter counts do not report an ancestor's filter or native tooltip behavior.
- After turning the outside master off with everything else off, `style.rulesActive` should be false and all categories inactive. If inside elements still appear blurred, investigate stale/other styles or a loading/error report. This tool identifies the owned stylesheet and the known legacy style only; it cannot attribute every unrelated extension/page filter.

You may share the count-only JSON report, preferably before and after turning off the outside master. Do not share raw page DOM, real names/messages, profile files or private screenshots. Counts can establish which candidates match a region; they cannot establish the meaning of unknown DOM structures. Further structural evidence may be needed before changing missed sidebar selectors. No new broad selector has been guessed from the user's text report.

## Safe reload and manual acceptance

1. Use the separate test Chrome profile where **Privacy Curtain Dev** was loaded. Leave the normal profile and installed Privacy Curtain v1.0 unchanged.
2. Open `chrome://extensions` in the test profile and press **Reload** on **Privacy Curtain Dev** only. Its manifest version should be **2.0.1**. The build folder remains `C:\Users\User\Desktop\internship\refactor\privacy-curtain\builds\development-v2`.
3. Close any open extension popup, refresh each WhatsApp Web test tab, then reopen the popup. Reloading an extension does not replace already running content scripts in an existing page; refresh is necessary. Confirm **2.0.1** in the popup.
4. Set Hover to reveal off, platform protection on, outside individual categories off, Outside Blur everything on, Inside Blur everything off, and all inside individual/legacy latest-message switches off. Do not alter a real conversation or share private contents.
5. Check names, group names, previews and avatars in the left list. Header, incoming/outgoing messages and media in the open conversation must stay clear. Search/input/menu/send controls must stay usable.
6. Turn Outside Blur everything off. With all individual categories off, list blur must clear and the opened conversation must remain clear. Run the report in both states if any result differs.
7. Leave outside off and enable each inside switch separately, then Inside Blur everything. Inside protection must work independently and the list must remain clear. Check both masters on and both/all individual controls off; the final all-off state should remove the owned rules.
8. Scroll, switch conversations, refresh and test a second tab. Existing selections remain stored; rebuilding/reloading Dev does not intentionally erase them.

Live compatibility is **pending the user's confirmation**. Synthetic fixtures demonstrate scope isolation, not current WhatsApp selector coverage. Do not treat visible names/previews as fixed simply because the build or tests pass.

## Safety checkpoint and local validation

The isolated branch remains `modernization/privacy-curtain-v2`; baseline for this fix was `e5741dc`. Existing user CSS and the instruction document were preserved.

Before editing, a new complete backup was created at `C:\Users\User\Desktop\internship\refactor\privacy-curtain-backup-scope-fix-2026-10-12T16-44-28-493Z`. Its sibling `.verification.json` records **4,454 files / 232,666,452 bytes**, with matching SHA-256 hashes for every file, including Git metadata, the v2 candidate and builds. No installed extension or user Chrome profile was accessed or changed.

Final local validation: **20 unit tests and 42 headless Chrome browser tests passed**, as did full lint, production build, development build and both build completeness checks. Regression coverage includes independent master routing/persistence, outside-only and inside-only CSS, outside-master removal, individual inside selections surviving outside changes, all-off, misplaced-region negatives, hover isolation, dynamic/navigation behavior, count-only output, startup/error phases and the popup's new controls/diagnostic response. All browser website structures and Chrome extension APIs in these checks are synthetic/mocked; they are not live compatibility verification.

A preservation check verified 20 pre-existing user/document/archive files against the new backup hashes, including the old dist tree, dist.zip, public/assets/popup.css and Privacy_curtain_instruction.md. Build completeness checks verify that each output's shared/content scripts equal the current sources and that every referenced local popup/icon/manifest asset is present.
