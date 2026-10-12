import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockChrome } from './mock-chrome.js';

const html = await readFile(new URL('../fixtures/mail-teams.html', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../public/shared.js', import.meta.url), 'utf8');
const content = await readFile(new URL('../../public/content.js', import.meta.url), 'utf8');
const targets = {
  gmail: { gmailBlurSender: ['gmail-sender'], gmailBlurSender2: ['gmail-sender2'], gmailBlurSubject: ['gmail-subject', 'gmail-open-subject'], gmailBlurSnippet: ['gmail-preview'], gmailBlurContent: ['gmail-content'] },
  outlook: { outlookBlurSender: ['outlook-sender'], outlookBlurSubject: ['outlook-subject'], outlookBlurPreview: ['outlook-preview'], outlookBlurContent: ['outlook-content'] },
  teams: { teams_blurImage: ['teams-avatar'], teams_blurName: ['teams-name'], teams_blurMessage: ['teams-preview'], teams_blurChatImage: ['teams-header-image'], teams_blurChatName: ['chat-topic-person-fixture'], teams_blurChatAllMessages: ['teams-message'], teams_blurChatLastImage: ['teams-media'] },
};
const hosts = { gmail: 'mail.google.com', outlook: 'outlook.office365.com', teams: 'teams.live.com' };
for (const [platform, options] of Object.entries(targets)) {
  test(`${platform} individual controls and master work on synthetic structures`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
    await page.addInitScript(mockChrome, { prefs: { pc_hoverReveal: false } });
    await page.addInitScript({ content: `${shared}\n${content}` });
    await page.goto(`https://${hosts[platform]}/`);
    await expect.poll(() => page.evaluate(() => __message({ action: 'privacyCurtainStatus' })?.ready)).toBe(true);
    for (const [key, ids] of Object.entries(options)) {
      await page.evaluate(key => __setPrefs({ [key]: true }), key);
      for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
      await page.evaluate(key => __setPrefs({ [key]: false }), key);
      for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'none');
    }
    await page.evaluate(platform => __setPrefs({ [globalThis.PrivacyCurtain.platforms[platform].allKey]: true }), platform);
    for (const id of Object.values(options).flat()) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'blur(5px)');
    for (const id of ['toolbar', 'compose', 'teams-menu', 'teams-unrelated', 'teams-draft']) await expect(page.locator(`#${id}`)).toHaveCSS('filter', 'none');
    expect(errors).toEqual([]);
  });
}
