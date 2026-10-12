import test from 'node:test';
import assert from 'node:assert/strict';
import { platforms, savePreferences, refreshTabs, loadPreferences } from '../src/preferences.js';

function mockApi(raw = {}, tabs = []) {
  const stored = { ...raw };
  const sent = [];
  const injected = [];
  const writes = [];
  const api = {
    storage: { sync: {
      async get(keys) { return Object.fromEntries(keys.filter(key => key in stored).map(key => [key, stored[key]])); },
      async set(patch) { writes.push(patch); Object.assign(stored, patch); },
    } },
    tabs: { async query() { return tabs; }, async sendMessage(id, message) { sent.push({ id, message }); } },
    scripting: { async executeScript(details) { injected.push(details); } },
  };
  return { api, stored, sent, injected, writes };
}

test('selected platform settings route to all matching tabs instead of the active WhatsApp tab', async () => {
  const tabs = [{ id: 1, url: 'https://web.whatsapp.com/' }, { id: 2, url: 'https://mail.google.com/mail/u/0/' }, { id: 3, url: 'https://mail.google.com/mail/u/1/' }, { id: 4, url: 'https://mail.google.com.evil.test/' }, { id: 0, url: 'https://outlook.office.com/mail/' }];
  for (const [platform, config] of Object.entries(platforms)) {
    const { api, sent, stored, writes } = mockApi({ blurName: true, unrelated: 'preserved' }, tabs);
    await savePreferences(api, platform, { [config.allKey]: true });
    assert.deepEqual(sent.map(({ id }) => id), platform === 'gmail' ? [2, 3] : platform === 'whatsapp' ? [1] : platform === 'outlook' ? [0] : []);
    assert.ok(sent.every(({ message }) => message.platform === platform && !('prefs' in message)));
    assert.equal(stored.blurName, true);
    assert.equal(stored.unrelated, 'preserved');
    assert.deepEqual(writes, [{ [config.allKey]: true }]);
  }
});

test('general reveal and intensity settings route to every supported platform', async () => {
  const tabs = Object.entries(platforms).map(([, { hosts }], id) => ({ id, url: `https://${hosts[0]}/` }));
  const { api, sent } = mockApi({}, tabs);
  await savePreferences(api, 'gmail', { pc_hoverReveal: false });
  assert.equal(sent.length, 4);
  assert.equal(new Set(sent.map(({ id }) => id)).size, 4);
});

test('outside and inside masters persist independent patches without expanding inside defaults', async () => {
  const { api, stored, writes } = mockApi({ blurChatAllMessages: false, blurChatMedia: false });
  await savePreferences(api, 'whatsapp', { blurAll: true });
  assert.equal(stored.blurChatAllMessages, false);
  assert.equal(stored.blurChatMedia, false);
  assert.equal(stored.pc_whatsapp_insideAll, undefined);
  await savePreferences(api, 'whatsapp', { pc_whatsapp_insideAll: true });
  await savePreferences(api, 'whatsapp', { blurAll: false });
  assert.equal(stored.pc_whatsapp_insideAll, true);
  assert.deepEqual(writes, [{ blurAll: true }, { pc_whatsapp_insideAll: true }, { blurAll: false }]);
  await assert.rejects(savePreferences(api, 'gmail', { pc_whatsapp_insideAll: true }));
});

test('missing content script is injected once with shared definitions and retried', async () => {
  const { api, sent, injected } = mockApi({}, [{ id: 7, url: 'https://web.whatsapp.com/' }]);
  let attempts = 0;
  api.tabs.sendMessage = async (id, message) => { attempts++; if (attempts === 1) throw new Error('Missing listener'); sent.push({ id, message }); };
  assert.equal(await refreshTabs(api, 'whatsapp'), true);
  assert.equal(attempts, 2);
  assert.deepEqual(injected, [{ target: { tabId: 7 }, files: ['shared.js', 'content.js'] }]);
});

test('closed tabs do not undo stored preferences or leak messages to other hosts', async () => {
  const { api, stored } = mockApi({}, [{ id: 2, url: 'https://mail.google.com/' }]);
  api.tabs.sendMessage = async () => { throw new Error('Closed tab'); };
  api.scripting.executeScript = async () => { throw new Error('Closed tab'); };
  assert.equal(await savePreferences(api, 'gmail', { gmailBlurAll: true }), false);
  assert.equal(stored.gmailBlurAll, true);
});

test('write failure keeps previous preferences and does not route messages', async () => {
  const { api, stored, sent } = mockApi({ blurAll: false }, [{ id: 1, url: 'https://web.whatsapp.com/' }]);
  api.storage.sync.set = async () => { throw new Error('Quota exceeded'); };
  await assert.rejects(savePreferences(api, 'whatsapp', { blurAll: true }));
  assert.equal(stored.blurAll, false);
  assert.deepEqual(sent, []);
});

test('validation rejects unknown keys and changes to a different platform', async () => {
  const { api, writes } = mockApi();
  for (const patch of [{ gmailBlurAll: true }, { blurAll: 'false' }, { pc_blurIntensity: 100 }, { unknown: true }, {}]) await assert.rejects(savePreferences(api, 'whatsapp', patch));
  await assert.rejects(refreshTabs(api, 'unknown'));
  assert.deepEqual(writes, []);
});

test('loading preferences persists only an additive, idempotent migration', async () => {
  const { api, stored, writes } = mockApi({ blurEnabled: true, teams_blurAll: false, gmailBlurAll: false, unrelated: 'preserved' });
  const prefs = await loadPreferences(api);
  assert.equal(prefs.blurAll, true);
  assert.equal(prefs.gmailBlurAll, false);
  assert.equal(stored.unrelated, 'preserved');
  await loadPreferences(api);
  assert.equal(writes.length, 1);
  assert.equal(stored.blurEnabled, true);
});
