import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockChrome } from './mock-chrome.js';

const whatsapp = await readFile(new URL('../fixtures/whatsapp.html', import.meta.url), 'utf8');
const mail = await readFile(new URL('../fixtures/mail-teams.html', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../public/shared.js', import.meta.url), 'utf8');
const content = await readFile(new URL('../../public/content.js', import.meta.url), 'utf8');

test('a shared simulated storage event synchronizes two WhatsApp tabs and an independent Gmail tab', async ({ context }) => {
  await context.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: new URL(route.request().url()).hostname === 'mail.google.com' ? mail : whatsapp }) : route.abort());
  await context.exposeBinding('__sharedPersist', async (_, patch) => {
    await Promise.all(context.pages().map(page => page.evaluate(patch => __setPrefs(patch), patch)));
  });
  await context.addInitScript(mockChrome, { prefs: { blurName: true, gmailBlurSender: true, pc_hoverReveal: false } });
  await context.addInitScript({ content: `${shared}\n${content}` });
  const first = await context.newPage();
  const second = await context.newPage();
  const gmail = await context.newPage();
  await Promise.all([first.goto('https://web.whatsapp.com/'), second.goto('https://web.whatsapp.com/?second'), gmail.goto('https://mail.google.com/')]);
  for (const page of [first, second, gmail]) await expect.poll(() => page.evaluate(() => __message({ action: 'privacyCurtainStatus' })?.ready)).toBe(true);
  await first.evaluate(() => chrome.storage.sync.set({ blurName: false, blurMessage: true }));
  for (const page of [first, second]) {
    await expect(page.locator('#name')).toHaveCSS('filter', 'none');
    await expect(page.locator('#preview')).toHaveCSS('filter', 'blur(5px)');
  }
  await expect(gmail.locator('#gmail-sender')).toHaveCSS('filter', 'blur(5px)');
  await first.evaluate(() => chrome.storage.sync.set({ pc_blurIntensity: 8 }));
  await expect(second.locator('#preview')).toHaveCSS('filter', 'blur(8px)');
  await expect(gmail.locator('#gmail-sender')).toHaveCSS('filter', 'blur(8px)');
});
