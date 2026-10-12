// Only preferences are mocked. Fixtures and network routes contain no real account data.
export function mockChrome({ prefs = {}, activeUrl = 'https://web.whatsapp.com/', tabs, failRead = false, failWrite = false, delayRead = 0, delayMessage = 0, diagnosticResponse } = {}) {
  let stored = { ...prefs };
  const changed = new Set();
  const messages = new Set();
  const installed = new Set();
  const api = {
    runtime: { id: 'synthetic-extension', lastError: undefined, onMessage: { addListener: fn => messages.add(fn) }, onInstalled: { addListener: fn => installed.add(fn) } },
    storage: {
      onChanged: { addListener: fn => changed.add(fn), removeListener: fn => changed.delete(fn) },
      sync: {
        get(keys, callback) {
          const result = Object.fromEntries((Array.isArray(keys) ? keys : Object.keys(stored)).filter(key => key in stored).map(key => [key, stored[key]]));
          if (callback) {
            setTimeout(() => {
              api.runtime.lastError = failRead ? { message: 'Synthetic read failure' } : undefined;
              callback(result);
              api.runtime.lastError = undefined;
            }, delayRead);
          } else return failRead ? Promise.reject(new Error('Synthetic read failure')) : Promise.resolve(result);
        },
        async set(patch) {
          if (failWrite) throw new Error('Synthetic write failure');
          globalThis.__writes.push(patch);
          if (globalThis.__sharedPersist) await globalThis.__sharedPersist(patch);
          else globalThis.__setPrefs(patch);
        },
      },
    },
    tabs: {
      async query(query) {
        const all = tabs ?? [{ id: 1, url: activeUrl }];
        if (query.active) return all.slice(0, 1);
        if (query.url) return all.filter(tab => query.url.some(pattern => tab.url?.startsWith(pattern.slice(0, -1))));
        return all;
      },
      async sendMessage(id, message) {
        globalThis.__sent.push({ id, message });
        if (delayMessage) await new Promise(resolve => setTimeout(resolve, delayMessage));
        if (message.action === 'privacyCurtainDiagnostics') return diagnosticResponse;
        return { success: true, platform: message.platform };
      },
    },
    scripting: { async executeScript(details) { globalThis.__injected.push(details); } },
  };
  globalThis.chrome = api;
  globalThis.__writes = [];
  globalThis.__sent = [];
  globalThis.__injected = [];
  globalThis.__setPrefs = patch => {
    const changes = {};
    for (const [key, newValue] of Object.entries(patch)) {
      changes[key] = { oldValue: stored[key], newValue };
      if (newValue === undefined) delete stored[key];
      else stored[key] = newValue;
    }
    for (const listener of changed) listener(changes, 'sync');
  };
  globalThis.__getPrefs = () => ({ ...stored });
  globalThis.__message = (message, sender = { id: api.runtime.id }) => {
    let result;
    for (const listener of messages) listener(message, sender, value => { result = value; });
    return result;
  };
  globalThis.__install = () => { for (const listener of installed) listener({ reason: 'update' }); };
}
