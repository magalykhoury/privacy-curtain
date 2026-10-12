import { test, expect } from '@playwright/test';
import { mockChrome } from './mock-chrome.js';
import { platforms } from '../../src/preferences.js';

const failures = new WeakMap();
const dimensions = page => page.evaluate(() => Object.fromEntries(['html', 'body', '#root', 'main.popup'].map(selector => {
  const element = document.querySelector(selector);
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return [selector, { width: rect.width, height: rect.height, cssWidth: style.width, minWidth: style.minWidth, maxWidth: style.maxWidth, display: style.display, visibility: style.visibility, overflowX: style.overflowX, overflowY: style.overflowY, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }];
})));
async function open(page, options = {}) {
  const errors = [];
  const external = [];
  failures.set(page, { errors, external });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4179') return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(mockChrome, options);
  await page.goto('http://127.0.0.1:4179/');
  if (!options.failRead) await expect(page.getByRole('status')).toHaveText('Preferences sync across your open tabs.');
}
test.afterEach(async ({ page }) => {
  const result = failures.get(page);
  if (result) { expect(result.errors).toEqual([]); expect(result.external).toEqual([]); }
});

test('detects work/school Outlook and renders the Outlook panel', async ({ page }) => {
  await open(page, { activeUrl: 'https://outlook.office.com/mail/' });
  await expect(page.getByRole('button', { name: 'Outlook', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Outlook privacy controls' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Sender names', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toHaveCount(0);
});

test('platform selection saves Gmail independently while WhatsApp is active', async ({ page }) => {
  await open(page, { tabs: [{ id: 1, url: 'https://web.whatsapp.com/' }, { id: 2, url: 'https://mail.google.com/' }, { id: 3, url: 'https://mail.google.com/mail/u/1/' }] });
  await page.getByRole('button', { name: 'Gmail', exact: true }).click();
  await page.getByRole('switch', { name: /^Blur everything/ }).check();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  expect(await page.evaluate(() => __getPrefs().gmailBlurAll)).toBe(true);
  expect(await page.evaluate(() => __getPrefs().blurAll)).toBeUndefined();
  expect(await page.evaluate(() => __sent.map(item => item.id))).toEqual([2, 3]);
  await page.getByRole('button', { name: 'Outlook', exact: true }).click();
  await expect(page.getByRole('switch', { name: /^Blur everything/ })).not.toBeChecked();
});

test('switches every panel and persists individual controls across popup reopen', async ({ page }) => {
  await open(page, { prefs: { blurAll: false, blurName: true, outlookBlurAll: false, gmailBlurAll: false } });
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toBeChecked();
  for (const label of ['Gmail', 'Outlook', 'Teams', 'WhatsApp']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: `${label === 'Teams' ? 'Microsoft Teams' : label} Blur Settings`, exact: true })).toBeVisible();
  }
  await page.getByRole('switch', { name: 'Conversation previews', exact: true }).check();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  const stored = await page.evaluate(() => __getPrefs());
  await page.addInitScript(mockChrome, { prefs: stored });
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Conversation previews', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toBeChecked();
});

test('platform pause preserves selected categories and current website toggle targets the current site', async ({ page }) => {
  await open(page, { prefs: { blurName: true, gmailBlurAll: true } });
  await page.getByRole('button', { name: 'Gmail', exact: true }).click();
  await page.getByRole('switch', { name: 'Current website protection', exact: true }).uncheck();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  const prefs = await page.evaluate(() => __getPrefs());
  expect(prefs.pc_whatsapp_enabled).toBe(false);
  expect(prefs.pc_gmail_enabled).toBeUndefined();
  expect(prefs.blurName).toBe(true);
  await page.getByRole('button', { name: 'WhatsApp', exact: true }).click();
  await expect(page.getByText('Protection paused', { exact: true }).last()).toBeVisible();
  await page.getByRole('switch', { name: 'WhatsApp protection', exact: true }).check();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toBeChecked();
});

test('master switch preserves individual preferences when switched off', async ({ page }) => {
  await open(page, { prefs: { blurName: true, blurImage: false } });
  await page.getByRole('switch', { name: /^Outside Blur everything/ }).check();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await expect(page.getByRole('switch', { name: 'Profile pictures', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Profile pictures', exact: true })).toBeDisabled();
  await page.getByRole('switch', { name: /^Outside Blur everything/ }).uncheck();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await expect(page.getByRole('switch', { name: 'Profile pictures', exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toBeChecked();
});

test('general settings save theme, blur intensity and reveal behavior', async ({ page }) => {
  await open(page);
  await page.getByText('Reveal & appearance', { exact: true }).click();
  await page.getByRole('switch', { name: /^Hover to reveal/ }).uncheck();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await page.getByLabel('Blur intensity', { exact: true }).selectOption('12');
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('main')).toHaveAttribute('data-theme', 'dark');
  const prefs = await page.evaluate(() => __getPrefs());
  expect(prefs.pc_blurIntensity).toBe(12);
  expect(prefs.pc_hoverReveal).toBe(false);
  expect(prefs.pc_theme).toBe('dark');
});

test('external storage changes update the open panel', async ({ page }) => {
  await open(page);
  await page.evaluate(() => __setPrefs({ blurName: true, pc_whatsapp_enabled: false }));
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'WhatsApp protection', exact: true })).not.toBeChecked();
});

test('a newer storage change remains authoritative while tab refresh messaging is delayed', async ({ page }) => {
  await open(page, { prefs: { blurName: false }, delayMessage: 300 });
  await page.getByRole('switch', { name: 'Contact and group names', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toBeChecked();
  await page.evaluate(() => __setPrefs({ blurName: false }));
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).not.toBeChecked();
});

test('failed saving displays an error and preserves the switch state', async ({ page }) => {
  await open(page, { prefs: { pc_settingsVersion: 2, blurName: false }, failWrite: true });
  await page.getByRole('switch', { name: 'Contact and group names', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Preferences were not saved');
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).not.toBeChecked();
  expect(await page.evaluate(() => __getPrefs().blurName)).toBe(false);
});

test('failed loading disables controls and presents a retry action', async ({ page }) => {
  await open(page, { failRead: true });
  await expect(page.getByRole('alert')).toContainText('Preferences could not be loaded');
  await expect(page.getByRole('switch', { name: /^Outside Blur everything/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('WhatsApp outside and inside masters affect only their own controls and storage keys', async ({ page }) => {
  await open(page, { prefs: { blurAll: true, blurChatAllMessages: false, blurChatMedia: false } });
  const messages = page.getByRole('switch', { name: 'Incoming and outgoing messages', exact: true });
  await expect(messages).not.toBeChecked();
  await expect(messages).toBeEnabled();
  await expect(page.getByRole('switch', { name: 'Header picture', exact: true })).not.toBeChecked();
  await messages.check();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await page.getByRole('switch', { name: /^Outside Blur everything/ }).uncheck();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await expect(messages).toBeChecked();
  await page.getByRole('switch', { name: /^Inside Blur everything/ }).check();
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await expect(page.getByRole('switch', { name: 'Images and media', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Contact and group names', exact: true })).toBeEnabled();
  const prefs = await page.evaluate(() => __getPrefs());
  expect(prefs.blurAll).toBe(false);
  expect(prefs.pc_whatsapp_insideAll).toBe(true);
  expect(prefs.blurChatAllMessages).toBe(true);
  expect(prefs.blurChatMedia).toBe(false);
});

test('coverage diagnostics request a refresh when an older content engine is present', async ({ page }) => {
  await open(page);
  await page.getByText('WhatsApp coverage diagnostics', { exact: true }).click();
  await page.getByRole('button', { name: 'Check WhatsApp coverage' }).click();
  await expect(page.getByRole('alert')).toContainText('refresh it after reloading Privacy Curtain Dev');
});

test('coverage diagnostics render the current engine count report without writing preferences', async ({ page }) => {
  await open(page, { prefs: { pc_settingsVersion: 2 }, diagnosticResponse: { engineRevision: '2.0.1-whatsapp-scopes', platform: 'whatsapp', ready: true, structure: [{ selector: '#pane-side', total: 1 }] } });
  await page.getByText('WhatsApp coverage diagnostics', { exact: true }).click();
  await page.getByRole('button', { name: 'Check WhatsApp coverage' }).click();
  await expect(page.getByLabel('Count-only WhatsApp diagnostics')).toContainText('2.0.1-whatsapp-scopes');
  expect(await page.evaluate(() => __writes)).toEqual([]);
  expect(await page.evaluate(() => __sent)).toEqual([{ id: 1, message: { action: 'privacyCurtainDiagnostics' } }]);
});

test('unsupported page keeps platform settings available without claiming current-page protection', async ({ page }) => {
  await open(page, { activeUrl: 'chrome://newtab/' });
  await expect(page.getByText('Unsupported website', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Current website protection', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'WhatsApp', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard switches, focus visibility, reduced motion and compact width', async ({ page }) => {
  await open(page);
  const name = page.getByRole('switch', { name: 'Contact and group names', exact: true });
  await name.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toHaveText('Preferences saved');
  await expect(name).toBeChecked();
  await expect(name).toHaveCSS('outline-style', 'solid');
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  expect(await name.evaluate(el => getComputedStyle(el, '::after').transitionDuration)).toBe('0s');
  await page.setViewportSize({ width: 320, height: 800 });
  // A temporary narrow viewport must not cap the extension's preferred intrinsic width.
  expect(await page.locator('html').evaluate(el => el.getBoundingClientRect().width)).toBe(640);
});

test('light and dark popup renders stay legible with restrained motion', async ({ page }) => {
  await open(page, { prefs: { blurName: true, blurImage: true, blurMessage: true, pc_theme: 'light' } });
  await page.setViewportSize({ width: 640, height: 600 });
  expect(await page.locator('main').evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(600);
  await page.screenshot({ path: 'test-results/popup-light.png', fullPage: true });
  await page.evaluate(() => __setPrefs({ pc_theme: 'dark' }));
  await expect(page.locator('main')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/popup-dark.png', fullPage: true });
  expect(await page.locator('main').evaluate(el => getComputedStyle(el).color)).toBe('rgb(239, 244, 241)');
});

for (const width of [25, 120, 320, 640]) {
  test(`popup keeps its intrinsic width from an initial ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    const stylesheets = [];
    page.on('response', response => { if (response.request().resourceType() === 'stylesheet') stylesheets.push({ url: response.url(), status: response.status() }); });
    await open(page);
    const measured = await dimensions(page);
    await test.info().attach('popup-dimensions.json', { body: JSON.stringify({ viewportWidth: width, stylesheets, measured }, null, 2), contentType: 'application/json' });
    expect(stylesheets).toHaveLength(1);
    expect(stylesheets[0].status).toBe(200);
    expect(new URL(stylesheets[0].url).pathname).toMatch(/^\/assets\/.*\.css$/);
    for (const selector of ['html', 'body', '#root', 'main.popup']) {
      expect(measured[selector].width).toBe(640);
      expect(measured[selector].display).toBe('block');
      expect(measured[selector].visibility).toBe('visible');
    }
    expect(measured.body.maxWidth).toBe('none');
    expect(measured['main.popup'].height).toBeLessThanOrEqual(600);
    expect(measured['main.popup'].scrollWidth).toBeLessThanOrEqual(measured['main.popup'].clientWidth);
  });
}

test('popup has one vertical scroll container and none when its content is short', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 600 });
  await open(page);
  await page.getByText('Reveal & appearance', { exact: true }).click();
  await page.getByText('WhatsApp coverage diagnostics', { exact: true }).click();
  const measured = await dimensions(page);
  expect(measured.html.overflowY).toBe('hidden');
  expect(measured.body.overflowY).toBe('hidden');
  expect(measured['#root'].overflowY).toBe('visible');
  expect(measured['main.popup'].overflowY).toBe('auto');
  expect(measured['main.popup'].scrollHeight).toBeGreaterThan(measured['main.popup'].clientHeight);
  await page.evaluate(() => { document.querySelector('main.popup').replaceChildren(document.createElement('p')); });
  const short = await dimensions(page);
  expect(short['main.popup'].scrollHeight).toBe(short['main.popup'].clientHeight);
});

test('original blue styling, white switch handles and four local platform icons render', async ({ page }) => {
  await open(page, { prefs: { pc_theme: 'light', blurName: true } });
  await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCSS('color', 'rgb(62, 80, 161)');
  const toggle = page.getByRole('switch', { name: 'Contact and group names', exact: true });
  await expect(toggle).toHaveCSS('background-color', 'rgb(62, 80, 161)');
  await expect(toggle).toHaveCSS('width', '54px');
  await expect(toggle).toHaveCSS('height', '28px');
  expect(await toggle.evaluate(element => getComputedStyle(element, '::after').backgroundColor)).toBe('rgb(255, 255, 255)');
  const buttons = page.getByRole('navigation', { name: 'Privacy platforms' }).getByRole('button');
  await expect(buttons).toHaveCount(4);
  for (const label of ['WhatsApp', 'Gmail', 'Outlook', 'Teams']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toHaveCSS('width', '36px');
    expect(await button.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
});

for (const label of ['WhatsApp', 'Teams']) {
  test(`${label} has outside controls on the left and inside controls on the right`, async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 600 });
    await open(page);
    await page.getByRole('button', { name: label, exact: true }).click();
    const outside = page.getByRole('group', { name: 'Outside Chat Options', exact: true });
    const inside = page.getByRole('group', { name: 'Inside Chat Options', exact: true });
    await expect(outside.getByRole('switch', { name: 'Conversation previews', exact: true })).toBeVisible();
    await expect(inside.getByRole('switch', { name: 'Header picture', exact: true })).toBeVisible();
    const left = await outside.boundingBox();
    const right = await inside.boundingBox();
    expect(left.x + left.width).toBeLessThan(right.x);
    expect(Math.abs(left.y - right.y)).toBeLessThan(1);
    expect(right.x + right.width).toBeLessThanOrEqual(640);
    expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

for (const [key, config] of Object.entries(platforms)) {
  test(`${config.label} retains every setting and its exact storage mapping in the blue UI`, async ({ page }) => {
    const tabs = Object.values(platforms).map((platform, index) => ({ id: index + 1, url: `https://${platform.hosts[0]}/` }));
    await open(page, { prefs: { pc_settingsVersion: 2 }, tabs });
    await page.getByRole('button', { name: key === 'teams' ? 'Teams' : config.label, exact: true }).click();
    if (key === 'whatsapp') await page.getByText('Additional controls', { exact: true }).click();
    if (key === 'gmail' || key === 'outlook') {
      await expect(page.getByRole('group', { name: 'Email Options', exact: true })).toHaveCount(1);
      await expect(page.locator('.chat-columns')).toHaveCount(0);
    }
    const controls = [
      ...config.options,
      { key: config.allKey, label: key === 'whatsapp' ? /^Outside Blur everything/ : /^Blur everything/ },
      ...(config.insideAllKey ? [{ key: config.insideAllKey, label: /^Inside Blur everything/ }] : []),
    ];
    for (const control of controls) {
      const toggle = page.getByRole('switch', { name: control.label, exact: typeof control.label === 'string' });
      await toggle.check();
      await expect(page.getByRole('status')).toHaveText('Preferences saved');
      expect(await page.evaluate(() => __writes.at(-1))).toEqual({ [control.key]: true });
      expect(await page.evaluate(() => __sent.at(-1))).toEqual({ id: Object.keys(platforms).indexOf(key) + 1, message: { action: 'privacyCurtainRefresh', platform: key } });
      await toggle.uncheck();
      await expect(page.getByRole('status')).toHaveText('Preferences saved');
      expect(await page.evaluate(() => __writes.at(-1))).toEqual({ [control.key]: false });
    }
    expect(await page.evaluate(() => Object.entries(__getPrefs()).filter(([name, value]) => name !== 'pc_settingsVersion' && value !== false))).toEqual([]);
  });
}

test('popup scrolling fits a smaller height constraint without clipping the final controls', async ({ page }) => {
  await page.setViewportSize({ width: 655, height: 510 });
  await open(page);
  const measured = await dimensions(page);
  expect(measured['main.popup'].height).toBe(510);
  expect(measured['main.popup'].scrollWidth).toBe(measured['main.popup'].clientWidth);
  await page.locator('footer').scrollIntoViewIfNeeded();
  const footer = await page.locator('footer').boundingBox();
  expect(footer.y).toBeGreaterThanOrEqual(0);
  expect(footer.y + footer.height).toBeLessThanOrEqual(510);
});
