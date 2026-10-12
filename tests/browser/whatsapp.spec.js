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

test('Blur Everything combines list, group, header, messages and media without blurring controls', async ({ page }) => {
  await load(page, { blurAll: true, pc_hoverReveal: false });
  for (const id of new Set(Object.values(targets).flat())) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
  for (const id of controls) expect(await effectiveBlur(page, id)).toBe('none');
  await page.evaluate(() => __setPrefs({ pc_whatsapp_enabled: false }));
  for (const id of new Set(Object.values(targets).flat())) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'none');
  await page.evaluate(() => __setPrefs({ pc_whatsapp_enabled: true, pc_blurIntensity: 10 }));
  await expect(page.locator('#name')).toHaveCSS('filter', 'blur(10px)');
});

test('hover reveals only intended elements and re-conceals immediately on leave', async ({ page }) => {
  await load(page, { blurAll: true });
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
  await load(page, { blurAll: true, pc_hoverReveal: false });
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
