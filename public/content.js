(() => {
  if (globalThis.__privacyCurtainController || !globalThis.PrivacyCurtain) return;
  const { engineRevision, platforms, settingsKeys, normalize, detectPlatform, getActiveOptions, getOptionSelectors, getBlurTarget, buildCSS } = globalThis.PrivacyCurtain;
  const platform = detectPlatform(location.href);
  if (!platform) return;
  const styleId = 'platform-blur-style';
  let raw = {};
  let revision = 0;
  let ready = false;
  let storageError = false;
  let style;
  let root;
  let loadAttempts = 0;
  // Conceal known targets while async preferences load; never fade private content into view.
  let css = buildCSS(platform, { [platforms[platform].allKey]: true, ...(platforms[platform].insideAllKey ? { [platforms[platform].insideAllKey]: true } : {}), pc_hoverReveal: false });
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
      style.dataset.engineRevision = engineRevision;
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
  globalThis.__privacyCurtainController = { platform, engineRevision };
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
    loadAttempts++;
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

  function diagnostics() {
    const prefs = normalize(raw);
    const active = new Set(getActiveOptions(platform, raw).map(option => option.key));
    const region = element => element.closest('#pane-side, [data-testid="chat-list"]') ? 'sidebar'
      : element.closest('#main header') ? 'header' : element.closest('#main') ? 'conversation' : 'other';
    const counts = selector => {
      const nodes = document.querySelectorAll(selector);
      const matches = { sidebar: 0, header: 0, conversation: 0, other: 0 };
      const filtered = { sidebar: 0, header: 0, conversation: 0, other: 0 };
      // On-demand and bounded; return counts only, never nodes, text or attribute values.
      for (const element of Array.from(nodes).slice(0, 250)) {
        const scope = region(element);
        matches[scope]++;
        if (getComputedStyle(element).filter !== 'none') filtered[scope]++;
      }
      return { total: nodes.length, sampled: Math.min(nodes.length, 250), truncated: nodes.length > 250, matches, filtered };
    };
    const structureSelectors = [
      '#pane-side', '[data-testid="chat-list"]', '#main', '#main header',
      ':is(#pane-side, [data-testid="chat-list"]) [role="row"]',
      ':is(#pane-side, [data-testid="chat-list"]) [role="listitem"]',
      ':is(#pane-side, [data-testid="chat-list"]) [role="gridcell"]',
      ':is(#pane-side, [data-testid="chat-list"]) span[title]',
      ':is(#pane-side, [data-testid="chat-list"]) span[dir="auto"]',
      ':is(#pane-side, [data-testid="chat-list"]) [data-testid="cell-frame-title"]',
      ':is(#pane-side, [data-testid="chat-list"]) [data-testid="cell-frame-secondary"]',
    ];
    return {
      engineRevision, platform, ready, storageError, loadAttempts,
      phase: ready ? 'configured' : storageError ? 'storage-error-concealment' : 'loading-concealment',
      cssSource: 'public/content.js -> public/shared.js:buildCSS',
      style: { id: styleId, instances: document.querySelectorAll('#platform-blur-style').length, mounted: Boolean(style?.isConnected), revisionMatches: style?.dataset.engineRevision === engineRevision, cssMatchesExpected: style?.textContent === css, rulesActive: Boolean(css), legacyStylePresent: Boolean(document.getElementById('whatsapp-blur-style')) },
      preferences: ready ? { platformEnabled: prefs.pc_whatsapp_enabled, outsideAll: prefs.blurAll, insideAll: prefs.pc_whatsapp_insideAll, hoverReveal: prefs.pc_hoverReveal, intensity: prefs.pc_blurIntensity } : null,
      structure: structureSelectors.map(selector => ({ selector, ...counts(selector) })),
      categories: platforms.whatsapp.options.map(option => ({
        key: option.key, scope: option.scope, selected: prefs[option.key], active: ready && active.has(option.key),
        selectors: getOptionSelectors('whatsapp', option).map((selector, index) => ({ candidate: option.selectors[index], candidateMatches: counts(option.selectors[index]), cssTarget: getBlurTarget([selector]), cssMatches: counts(getBlurTarget([selector])) })),
      })),
    };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.action === 'privacyCurtainRefresh' || message?.action === 'updateBlur') {
      // Messages request a reread, never override storage or force another platform.
      if (message.platform && message.platform !== platform) { respond({ success: false }); return; }
      load();
      respond({ success: true, platform });
    } else if (message?.action === 'privacyCurtainStatus') {
      const prefs = normalize(raw);
      respond({ engineRevision, platform, ready, storageError, enabled: prefs[`pc_${platform}_enabled`], rulesActive: Boolean(css) });
    } else if (message?.action === 'privacyCurtainDiagnostics' && platform === 'whatsapp') {
      respond(diagnostics());
    }
  });
})();
