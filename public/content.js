(() => {
  if (globalThis.__privacyCurtainController || !globalThis.PrivacyCurtain) return;
  const { platforms, settingsKeys, normalize, detectPlatform, buildCSS } = globalThis.PrivacyCurtain;
  const platform = detectPlatform(location.href);
  if (!platform) return;
  const styleId = 'platform-blur-style';
  let raw = {};
  let revision = 0;
  let ready = false;
  let storageError = false;
  let style;
  let root;
  // Conceal known targets while async preferences load; never fade private content into view.
  let css = buildCSS(platform, { [platforms[platform].allKey]: true, pc_hoverReveal: false });
  function mount() {
    if (!document.documentElement) return;
    if (root !== document.documentElement) {
      root = document.documentElement;
      observer.disconnect();
      observer.observe(document, { childList: true });
      observer.observe(root, { childList: true });
    }
    if (!style?.isConnected) {
      style = document.getElementById(styleId) ?? document.createElement('style');
      style.id = styleId;
      style.dataset.platform = platform;
      root.appendChild(style);
      observer.observe(style, { childList: true, subtree: true, characterData: true });
    }
    if (style.textContent !== css) style.textContent = css;
  }
  function apply() {
    css = buildCSS(platform, raw);
    mount();
  }
  const observer = new MutationObserver(mount);
  observer.observe(document, { childList: true });
  mount();
  globalThis.__privacyCurtainController = { platform };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !settingsKeys.some(key => key in changes)) return;
    revision++;
    for (const key of settingsKeys) {
      if (key in changes) {
        if (changes[key].newValue === undefined) delete raw[key];
        else raw[key] = changes[key].newValue;
      }
    }
    // Changes during initial load are reread before applying a complete snapshot.
    if (ready) apply();
  });
  function load() {
    const started = revision;
    chrome.storage.sync.get(settingsKeys, prefs => {
      if (chrome.runtime.lastError) { storageError = true; return; }
      storageError = false;
      if (started !== revision) { load(); return; }
      raw = prefs || {};
      ready = true;
      apply();
    });
  }
  load();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.action === 'privacyCurtainRefresh' || message?.action === 'updateBlur') {
      // Messages request a reread, never override storage or force another platform.
      if (message.platform && message.platform !== platform) { respond({ success: false }); return; }
      load();
      respond({ success: true, platform });
    } else if (message?.action === 'privacyCurtainStatus') {
      const prefs = normalize(raw);
      respond({ platform, ready, storageError, enabled: prefs[`pc_${platform}_enabled`], rulesActive: Boolean(css) });
    }
  });
})();
