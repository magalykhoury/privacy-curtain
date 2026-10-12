import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/shared.js';
const { platforms, defaults, normalize, migrationPatch, detectPlatform, createBlurCSS, buildCSS } = globalThis.PrivacyCurtain;

test('selector groups scope reveal to every member, including compound selectors', () => {
  const css = createBlurCSS(['.one, .two', '.three :is(.four, .five)', '[title="a,b"]'], 5, true);
  assert.ok(css.startsWith(':is(.one, .two, .three :is(.four, .five), [title="a,b"]):not('));
  assert.ok(css.includes(' *):hover { filter: none'));
  assert.equal((css.match(/filter: none/g) || []).length, 1);
  assert.match(css, /transition: none/);
  assert.doesNotMatch(createBlurCSS(['.one'], 5, false), /hover|filter: none/);
});
test('platform detection accepts only exact supported HTTPS hosts', () => {
  for (const [key, { hosts }] of Object.entries(platforms)) for (const host of hosts) assert.equal(detectPlatform(`https://${host}/path`), key);
  for (const url of ['invalid', 'chrome://extensions', 'https://web.whatsapp.com.evil.test/', 'https://evil-whatsapp.com/', 'http://mail.google.com/', 'https://example.com/', 'https://whatsapp.com/']) assert.equal(detectPlatform(url), null);
});
for (const [platform, { options, allKey }] of Object.entries(platforms)) {
  test(`${platform}: each toggle, all, pause, and restored settings`, () => {
    assert.equal(buildCSS(platform, defaults), '');
    for (const { key, selectors } of options) {
      const css = buildCSS(platform, { [key]: true, pc_hoverReveal: false });
      for (const selector of selectors) assert.ok(css.includes(selector), `${key}: ${selector}`);
      assert.equal(buildCSS(platform, { [key]: true, [`pc_${platform}_enabled`]: false }), '');
    }
    const all = buildCSS(platform, { [allKey]: true });
    for (const { selectors, scope } of options.filter(option => platform !== 'whatsapp' || option.scope === 'outside')) {
      assert.ok(scope);
      for (const selector of selectors) assert.ok(all.includes(selector));
    }
    assert.equal(buildCSS(platform, { [allKey]: false }), '');
    assert.equal(buildCSS(platform, { ...defaults, [options[0].key]: true }), buildCSS(platform, { [options[0].key]: true }));
  });
}
test('v1 settings retain explicit false and platform independence', () => {
  const raw = { blurAll: false, blurName: true, blurChatLastImage: true, gmailBlurAll: true, outlookBlurAll: false, teams_blurMessage: true, blurEnabled: false, unrelated: 'keep' };
  const prefs = normalize(raw);
  for (const key of ['blurAll', 'blurName', 'blurChatLastImage', 'gmailBlurAll', 'outlookBlurAll', 'teams_blurMessage']) assert.equal(prefs[key], raw[key]);
  assert.equal(prefs.pc_whatsapp_enabled, true);
  assert.equal(prefs.blurChatMedia, false);
  assert.deepEqual(migrationPatch(raw), { pc_settingsVersion: 2 });
  assert.equal(raw.unrelated, 'keep');
});
test('legacy-only blurEnabled migrates once without clearing stored data', () => {
  for (const value of [false, true]) {
    const raw = { blurEnabled: value };
    const patch = migrationPatch(raw);
    assert.equal(patch.blurAll, value);
    assert.equal(patch.pc_whatsapp_enabled, value);
    assert.deepEqual(migrationPatch({ ...raw, ...patch }), {});
  }
  assert.equal(normalize({}).blurAll, false);
});
test('malformed data and unsafe intensity values are validated', () => {
  for (const value of [null, [], 'bad']) assert.deepEqual(normalize(value), defaults);
  for (const value of [null, [], 'bad']) assert.deepEqual(migrationPatch(value), { pc_settingsVersion: 2 });
  assert.equal(normalize({ blurAll: 'false', blurName: 1 }).blurAll, false);
  assert.equal(normalize({ pc_blurIntensity: 0 }).pc_blurIntensity, 3);
  assert.equal(normalize({ pc_blurIntensity: 100 }).pc_blurIntensity, 16);
  assert.equal(normalize({ pc_blurIntensity: '0', pc_theme: 'bad' }).pc_blurIntensity, 5);
  assert.equal(buildCSS('unsupported', { blurAll: true }), '');
});
