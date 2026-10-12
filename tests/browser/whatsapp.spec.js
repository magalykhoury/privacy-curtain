import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockChrome } from './mock-chrome.js';

const html = await readFile(new URL('../fixtures/whatsapp.html', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../public/shared.js', import.meta.url), 'utf8');
const content = await readFile(new URL('../../public/content.js', import.meta.url), 'utf8');
const targets = {
  blurImage: ['avatar', 'group-avatar', 'fallback-avatar'],
  blurName: ['name', 'group-name', 'fallback-name'],
  blurMessage: ['preview', 'group-preview', 'fallback-preview'],
  blurChatImage: ['header-avatar'],
  blurChatName: ['header-name'],
  blurChatAllMessages: ['incoming', 'outgoing', 'new-message', 'latest-text'],
  blurChatMedia: ['incoming-media', 'outgoing-media', 'video', 'canvas', 'latest-media'],
  blurChatLastImage: ['latest-media'],
  blurChatLastMessage: ['latest-text'],
  blurUsername: ['username'],
};
const controls = ['outside-button', 'search', 'row-menu', 'row-control-image', 'header-menu', 'header-control-image', 'composer', 'send', 'unrelated-image', 'unrelated-name'];

async function load(page, prefs, options = {}) {
  await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
  await page.addInitScript(mockChrome, { prefs, ...options });
  await page.addInitScript({ content: `${shared}\n${content}` });
  await page.goto('https://web.whatsapp.com/');
  if (!options.failRead) await expect.poll(() => page.evaluate(() => __message({ action: 'privacyCurtainStatus' })?.ready)).toBe(true);
  await page.mouse.move(890, 790);
}

async function effectiveBlur(page, id) {
  return page.locator(`#${id}`).evaluate(el => {
    for (let node = el; node; node = node.parentElement) if (getComputedStyle(node).filter !== 'none') return getComputedStyle(node).filter;
    return 'none';
  });
}

for (const [key, ids] of Object.entries(targets)) {
  test(`${key} conceals intended WhatsApp targets and leaves other categories and controls clear`, async ({ page }) => {
    await load(page, { [key]: true, pc_hoverReveal: false });
    for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
    for (const other of Object.entries(targets).filter(([otherKey]) => otherKey !== key).flatMap(([, values]) => values)) {
      // Legacy latest controls intentionally overlap their corresponding message/media category.
      if (!ids.includes(other)) expect(await effectiveBlur(page, other)).toBe('none');
    }
    for (const id of controls) expect(await effectiveBlur(page, id)).toBe('none');
    await page.locator(`#${ids[0]}`).hover();
    await expect(page.locator(`#${ids[0]}`)).toHaveCSS('filter', 'blur(5px)');
    await page.evaluate(key => __setPrefs({ [key]: false }), key);
    for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'none');
  });
}

test('outside master protects only the conversation list and switching it off clears unintended inside blur', async ({ page }) => {
  await load(page, { blurAll: true, pc_hoverReveal: false });
  const outside = [...targets.blurImage, ...targets.blurName, ...targets.blurMessage, ...targets.blurUsername];
  const inside = Object.entries(targets).filter(([key]) => !['blurImage', 'blurName', 'blurMessage', 'blurUsername'].includes(key)).flatMap(([, ids]) => ids);
  for (const id of outside) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
  for (const id of inside) expect(await effectiveBlur(page, id)).toBe('none');
  for (const id of controls) expect(await effectiveBlur(page, id)).toBe('none');
  await page.evaluate(() => __setPrefs({ blurAll: false }));
  for (const id of new Set(Object.values(targets).flat())) expect(await effectiveBlur(page, id)).toBe('none');
  expect(await page.locator('#platform-blur-style').textContent()).toBe('');
  await page.evaluate(() => __setPrefs({ blurAll: true }));
  await page.evaluate(() => __setPrefs({ pc_whatsapp_enabled: false }));
  for (const id of new Set(Object.values(targets).flat())) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'none');
  await page.evaluate(() => __setPrefs({ pc_whatsapp_enabled: true, pc_blurIntensity: 10 }));
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(10px)');
});

test('hover reveals only intended elements and re-conceals immediately on leave', async ({ page }) => {
  await load(page, { blurAll: true, pc_whatsapp_insideAll: true });
  for (const id of ['name', 'avatar', 'preview', 'incoming', 'outgoing', 'header-name', 'header-avatar', 'group-name']) {
    await page.locator(`#${id}`).hover();
    await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'none');
    const other = id === 'name' ? 'group-name' : 'name';
    await expect(page.locator(`#${other}`)).toHaveCSS('filter', 'blur(5px)');
    await page.mouse.move(890, 790);
    await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
  }
  await page.evaluate(() => __setPrefs({ pc_hoverReveal: false }));
  await page.locator('#name').hover();
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
});

test('virtualized new rows, recycled rows, conversation switching, navigation and refresh stay protected', async ({ page }) => {
  await load(page, { blurAll: true, pc_whatsapp_insideAll: true, pc_hoverReveal: false });
  await page.evaluate(() => {
    const row = document.querySelector('[data-testid="list-item-group"]').cloneNode(true);
    row.querySelectorAll('[id]').forEach(el => { el.id = `dynamic-${el.id}`; });
    document.querySelector('#pane-side [role="grid"]').append(row);
    document.querySelector('#name span').textContent = 'Recycled synthetic row';
    const main = document.querySelector('#main');
    main.replaceWith(main.cloneNode(true));
    history.pushState({}, '', '/?synthetic-navigation=1');
  });
  for (const id of ['dynamic-group-name', 'dynamic-group-avatar', 'dynamic-group-preview', 'name', 'incoming', 'header-name']) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
  await page.reload();
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
});

test('inside master operates independently and all-off removes both scopes', async ({ page }) => {
  await load(page, { blurAll: false, pc_whatsapp_insideAll: true, pc_hoverReveal: false });
  const inside = Object.entries(targets).filter(([key]) => !['blurImage', 'blurName', 'blurMessage', 'blurUsername'].includes(key)).flatMap(([, ids]) => ids);
  for (const id of inside) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
  for (const id of ['avatar', 'name', 'preview', 'group-name', 'group-preview']) expect(await effectiveBlur(page, id)).toBe('none');
  await page.evaluate(() => __setPrefs({ blurAll: true }));
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
  await page.evaluate(() => __setPrefs({ blurAll: false }));
  await expect(page.locator('#incoming')).toHaveCSS('filter', 'blur(5px)');
  await expect(page.locator('#name')).toHaveCSS('filter', 'none');
  await page.evaluate(() => __setPrefs({ pc_whatsapp_insideAll: false }));
  for (const id of new Set(Object.values(targets).flat())) expect(await effectiveBlur(page, id)).toBe('none');
  expect(await page.locator('#platform-blur-style').textContent()).toBe('');
});

test('turning off the outside master preserves explicitly selected inside switches', async ({ page }) => {
  await load(page, { blurAll: true, blurChatAllMessages: true, blurChatMedia: false, pc_hoverReveal: false });
  await page.evaluate(() => __setPrefs({ blurAll: false }));
  await expect(page.locator('#name')).toHaveCSS('filter', 'none');
  await expect(page.locator('#incoming')).toHaveCSS('filter', 'blur(5px)');
  await expect(page.locator('#outgoing')).toHaveCSS('filter', 'blur(5px)');
  await expect(page.locator('#incoming-media')).toHaveCSS('filter', 'none');
  expect(await page.evaluate(() => __getPrefs().blurChatAllMessages)).toBe(true);
});

test('scope guards reject sidebar-shaped elements in the conversation and message-shaped elements in the sidebar', async ({ page }) => {
  await load(page, { blurAll: true, pc_whatsapp_insideAll: true, pc_hoverReveal: false });
  await page.evaluate(() => {
    const fakeList = document.createElement('div');
    fakeList.dataset.testid = 'chat-list';
    fakeList.innerHTML = '<div role="row"><span data-testid="cell-frame-title" id="misplaced-name">Synthetic misplaced name</span></div>';
    document.querySelector('#main').append(fakeList);
    const nested = document.createElement('div');
    nested.id = 'main';
    nested.innerHTML = '<div class="message-in"><span class="selectable-text" id="misplaced-message">Synthetic misplaced message</span></div>';
    document.querySelector('#pane-side').append(nested);
  });
  for (const id of ['misplaced-name', 'misplaced-message']) expect(await effectiveBlur(page, id)).toBe('none');
});

test('count-only diagnostics attribute the expected CSS and never include fixture content or attribute values', async ({ page }) => {
  await load(page, { blurAll: true, pc_hoverReveal: false });
  const report = await page.evaluate(() => __message({ action: 'privacyCurtainDiagnostics' }));
  expect(report.engineRevision).toBe('2.0.1-whatsapp-scopes');
  expect(report.ready).toBe(true);
  expect(report.phase).toBe('configured');
  expect(report.style.cssMatchesExpected).toBe(true);
  expect(report.style.revisionMatches).toBe(true);
  expect(report.style.instances).toBe(1);
  expect(report.preferences).toMatchObject({ outsideAll: true, insideAll: false });
  for (const category of report.categories) {
    expect(category.active).toBe(category.scope === 'outside');
    for (const selector of category.selectors) {
      if (category.scope === 'outside') {
        expect(selector.cssMatches.matches.header).toBe(0);
        expect(selector.cssMatches.matches.conversation).toBe(0);
      } else expect(selector.cssMatches.matches.sidebar).toBe(0);
    }
  }
  expect(JSON.stringify(report)).not.toMatch(/Fixture Person|Fixture Group|Synthetic incoming|Synthetic preview|data:image|synthetic-extension/);
  await page.evaluate(() => __setPrefs({ blurAll: false }));
  const off = await page.evaluate(() => __message({ action: 'privacyCurtainDiagnostics' }));
  expect(off.style.rulesActive).toBe(false);
  expect(off.categories.every(category => !category.active)).toBe(true);
  await page.evaluate(() => { const legacy = document.createElement('style'); legacy.id = 'whatsapp-blur-style'; document.head.append(legacy); });
  expect(await page.evaluate(() => __message({ action: 'privacyCurtainDiagnostics' }).style.legacyStylePresent)).toBe(true);
});

test('style deletion or replacement is repaired without a body subtree observer or duplicate listeners', async ({ page }) => {
  await load(page, { blurName: true, pc_hoverReveal: false });
  await page.evaluate(() => document.querySelector('#platform-blur-style').remove());
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
  await page.evaluate(() => { document.querySelector('#platform-blur-style').textContent = ''; });
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
  await page.addScriptTag({ content });
  await expect(page.locator('#platform-blur-style')).toHaveCount(1);
  await page.evaluate(() => __setPrefs({ blurName: false }));
  await expect(page.locator('#name')).toHaveCSS('filter', 'none');
});

test('storage load failure stays concealed and messages cannot force another platform or reveal preferences', async ({ page }) => {
  await load(page, {}, { failRead: true });
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
  await expect.poll(() => page.evaluate(() => __message({ action: 'privacyCurtainDiagnostics' }).phase)).toBe('storage-error-concealment');
  expect(await page.evaluate(() => __message({ action: 'privacyCurtainDiagnostics' }).preferences)).toBeNull();
  await page.locator('#name').hover();
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
  expect(await page.evaluate(() => __message({ action: 'updateBlur', platform: 'gmail', prefs: { blurAll: false } }))).toEqual({ success: false });
  expect(await page.evaluate(() => __message({ action: 'updateBlur', prefs: { blurAll: false } }, { id: 'other-extension' }))).toBeUndefined();
});

test('initial preference loading conceals targets and merges concurrent changes', async ({ page }) => {
  await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
  await page.addInitScript(mockChrome, { prefs: { blurName: true, pc_hoverReveal: false }, delayRead: 200 });
  await page.addInitScript({ content: `${shared}\n${content}` });
  await page.goto('https://web.whatsapp.com/');
  expect(await page.evaluate(() => __message({ action: 'privacyCurtainStatus' }).ready)).toBe(false);
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
  await page.evaluate(() => __setPrefs({ blurMessage: true }));
  await expect.poll(() => page.evaluate(() => __message({ action: 'privacyCurtainStatus' }).ready)).toBe(true);
  await expect(page.locator('#preview')).toHaveCSS('filter', 'blur(5px)');
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(5px)');
});

test('comma-separated and compound selector regression uses real CSS cascade and hover', async ({ page }) => {
  await page.setContent('<div class="first" title="a,b">Synthetic first</div><div class="second">Synthetic second</div><div class="compound"><span class="nested">Synthetic nested</span></div>');
  await page.addScriptTag({ content: shared });
  await page.mouse.move(890, 790);
  await page.addStyleTag({ content: '.first, .second {filter:blur(5px)!important} .first, .second:hover {filter:none!important}' });
  await expect(page.locator('.first')).toHaveCSS('filter', 'none');
  await page.evaluate(() => {
    document.querySelectorAll('style').forEach(style => style.remove());
    const style = document.createElement('style');
    style.textContent = globalThis.PrivacyCurtain.createBlurCSS(['.first, .second', '.compound :is(.nested, [title="a,b"])'], 5, true);
    document.head.append(style);
  });
  for (const selector of ['.first', '.second', '.nested']) await expect(page.locator(selector)).toHaveCSS('filter', 'blur(5px)');
  await page.locator('.first').hover();
  await expect(page.locator('.first')).toHaveCSS('filter', 'none');
  await expect(page.locator('.second')).toHaveCSS('filter', 'blur(5px)');
  await expect(page.locator('.nested')).toHaveCSS('filter', 'blur(5px)');
});

test('unsupported hosts produce no styles or listeners', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.addInitScript(mockChrome, { prefs: { blurAll: true } });
  await page.addInitScript({ content: `${shared}\n${content}` });
  await page.goto('https://example.com/');
  await expect(page.locator('#platform-blur-style')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__privacyCurtainController)).toBeUndefined();
});
