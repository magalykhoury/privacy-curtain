import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/shared.js';

const { buildCSS, getActiveOptions, normalize } = globalThis.PrivacyCurtain;
test('outside master with inside switches off must not generate header, message or media rules', () => {
  const css = buildCSS('whatsapp', { blurAll: true });
  assert.ok(css.includes('cell-frame-title'));
  assert.ok(css.includes('cell-frame-secondary'));
  assert.ok(css.includes('default-group'));
  assert.ok(!css.includes('#main header'));
  assert.ok(!css.includes('.selectable-text'));
  assert.ok(!css.includes('video-thumb'));
});

test('both masters are independent and default inside master remains off during migration', () => {
  assert.equal(normalize({ blurAll: true }).pc_whatsapp_insideAll, false);
  assert.ok(getActiveOptions('whatsapp', { blurAll: true }).every(option => option.scope === 'outside'));
  assert.ok(getActiveOptions('whatsapp', { pc_whatsapp_insideAll: true }).every(option => option.scope === 'inside'));
  assert.equal(getActiveOptions('whatsapp', { blurAll: true, pc_whatsapp_insideAll: true }).length, 10);
  assert.equal(buildCSS('whatsapp', { pc_whatsapp_enabled: false, blurAll: true, pc_whatsapp_insideAll: true }), '');
  assert.equal(buildCSS('whatsapp', { blurAll: false, pc_whatsapp_insideAll: false }), '');
});

test('disabling the outside master clears its rules when both scopes have no individual selections', () => {
  assert.equal(buildCSS('whatsapp', { blurAll: false }), '');
});
