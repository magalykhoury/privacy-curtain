import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const results = resolve(workspace, 'test-results');
await mkdir(results, { recursive: true });
const canonicalWorkspace = await realpath(workspace);
const canonicalResults = await realpath(results);
assert.ok(canonicalResults.startsWith(canonicalWorkspace + sep), 'Test output must stay in the workspace');
const temporary = await mkdtemp(join(canonicalResults, 'native-popup-'));
assert.ok(temporary.startsWith(canonicalResults + sep + 'native-popup-'));
const extension = join(temporary, 'extension');
const profile = join(temporary, 'disposable-profile');
const source = process.argv[2] ? resolve(process.argv[2]) : resolve(workspace, 'builds/development-v2');
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(workspace, '.test-browsers');
const { chromium, expect } = await import('@playwright/test');
let context;

try {
  await cp(source, extension, { recursive: true });
  // Probe only this disposable copy; no instrumentation is added to the deliverable.
  const html = await readFile(join(extension, 'index.html'), 'utf8');
  await writeFile(join(extension, 'index.html'), html.replace('</head>', '<script defer src="layout-probe.js"></script></head>'));
  await writeFile(join(extension, 'layout-probe.js'), `
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 30) { clearInterval(timer); return; }
      if (!document.querySelector('main.popup')) return;
      const elements = Object.fromEntries(['html', 'body', '#root', 'main.popup'].map(selector => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return [selector, {width:rect.width,height:rect.height,cssWidth:style.width,minWidth:style.minWidth,maxWidth:style.maxWidth,display:style.display,visibility:style.visibility,overflowX:style.overflowX,overflowY:style.overflowY,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight}];
      }));
      const link = document.querySelector('link[rel="stylesheet"]');
      chrome.runtime.sendMessage({type:'NATIVE_POPUP_LAYOUT',report:{viewport:{width:innerWidth,height:innerHeight},cssHref:link?.getAttribute('href'),cssLoaded:Boolean(link?.sheet?.cssRules.length),elements}}).catch(() => {});
    }, 100);
  `);
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.route('https://**/*', route => route.abort());
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(() => {
    globalThis.layoutReports = [];
    chrome.runtime.onMessage.addListener(message => {
      if (message.type === 'NATIVE_POPUP_LAYOUT') globalThis.layoutReports.push(message.report);
    });
  });
  await worker.evaluate(() => chrome.action.openPopup());
  await expect.poll(() => worker.evaluate(() => globalThis.layoutReports.length), { timeout: 10000 }).toBeGreaterThan(0);
  // Let native auto-sizing settle; Windows may reserve a system scrollbar gutter.
  await expect.poll(() => worker.evaluate(() => globalThis.layoutReports.length), { timeout: 5000 }).toBeGreaterThan(3);
  const report = await worker.evaluate(() => globalThis.layoutReports.at(-1));
  await writeFile(join(results, 'popup-native-layout.json'), JSON.stringify(report, null, 2));
  await writeFile(join(results, `popup-native-layout-${manifest.version}.json`), JSON.stringify(report, null, 2));
  const popupPage = context.pages().find(page => page.url().startsWith('chrome-extension://') && page.url().endsWith('/index.html'));
  if (popupPage) await popupPage.screenshot({ path: join(results, `popup-native-${manifest.version}.png`) });
  assert.equal(report.cssLoaded, true);
  assert.ok(report.cssHref.startsWith('./assets/') && report.cssHref.endsWith('.css'));
  assert.ok(report.viewport.height > 0 && report.viewport.height <= 600);
  for (const element of Object.values(report.elements)) {
    assert.equal(element.width, 392);
    assert.equal(element.display, 'block');
    assert.equal(element.visibility, 'visible');
  }
  const main = report.elements['main.popup'];
  const allowance = report.viewport.width - report.elements.body.width;
  assert.ok(report.viewport.width >= 392 && report.viewport.width <= 424, 'Native width fits the content with at most 32px browser chrome allowance');
  assert.ok(main.height <= report.viewport.height, 'Scroll container must fit the actual available popup height');
  assert.ok(main.scrollWidth <= main.clientWidth, 'No horizontal overflow');
  assert.equal(report.elements.html.overflowY, 'hidden');
  assert.equal(report.elements.body.overflowY, 'hidden');
  assert.equal(main.overflowY, 'auto');
  console.log(`Native MV3 popup: ${report.viewport.width} x ${report.viewport.height}; local CSS parsed; all roots 392px; native width allowance ${allowance}px; main height ${main.height}px fits viewport; one vertical scroll container.`);
} finally {
  if (context) await context.close();
  // Remove only the unique temporary directory created above, after checking its resolved location.
  const canonicalTemporary = await realpath(temporary);
  assert.ok(canonicalTemporary.startsWith(canonicalResults + sep + 'native-popup-'));
  await rm(canonicalTemporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
