import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import '../public/shared.js';

for (const mode of ['production-v2', 'development-v2']) {
  const root = new URL(`../builds/${mode}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '2.0.0');
  assert.equal(manifest.name, mode === 'development-v2' ? 'Privacy Curtain Dev' : 'Privacy Curtain');
  assert.ok(!manifest.key && !manifest.update_url);
  assert.deepEqual(manifest.permissions, ['storage', 'scripting', 'activeTab']);
  const hosts = Object.values(globalThis.PrivacyCurtain.platforms).flatMap(({ hosts }) => hosts.map(host => `https://${host}/*`)).sort();
  assert.deepEqual([...manifest.host_permissions].sort(), hosts);
  assert.deepEqual([...manifest.content_scripts[0].matches].sort(), hosts);
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
  assert.deepEqual(manifest.content_scripts[0].js, ['shared.js', 'content.js']);
  assert.ok(manifest.content_security_policy.extension_pages.includes("connect-src 'none'"));
  const files = [manifest.action.default_popup, manifest.background.service_worker, ...manifest.content_scripts[0].js, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
  for (const file of files) await access(new URL(file, root));
  for (const script of ['shared.js', 'content.js', 'background.js']) assert.equal(await readFile(new URL(script, root), 'utf8'), await readFile(new URL(`../public/${script}`, import.meta.url), 'utf8'));
  const html = await readFile(new URL(manifest.action.default_popup, root), 'utf8');
  assert.ok(!/https?:\/\/|<style|onload=/.test(html));
  for (const [, file] of html.matchAll(/(?:src|href)="([^"]+)"/g)) await access(new URL(file, root));
  console.log(`${mode}: manifest, local scripts, popup assets, icons, CSP and exact host coverage verified`);
}
