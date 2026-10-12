(() => {
  const list = ':is(#pane-side, [data-testid="chat-list"])';
  const row = `${list} :is([role="row"], [role="listitem"], [data-testid="cell-frame-container"])`;
  const messages = '#main :is(.message-in, .message-out, [data-testid="msg-container"])';
  const latest = '#main :is(.message-in, .message-out, [data-testid="msg-container"]):not(:has(~ :is(.message-in, .message-out, [data-testid="msg-container"])))';
  const engineRevision = '2.0.1-whatsapp-scopes';
  const option = (key, label, section, selectors, scope = 'platform') => ({ key, label, section, selectors, scope });
  const platforms = {
    whatsapp: {
      label: 'WhatsApp', hosts: ['web.whatsapp.com'], allKey: 'blurAll', insideAllKey: 'pc_whatsapp_insideAll',
      options: [
        option('blurImage', 'Profile pictures', 'Conversation list', [
          `${row} img:not(.emoji):not([data-plain-text]):not([data-testid="cell-frame-secondary"] img)`,
          `${row} :is([data-icon="default-user"], [data-icon="default-group"], [data-testid="avatar"])`,
        ], 'outside'),
        option('blurName', 'Contact and group names', 'Conversation list', [
          `${row} [data-testid="cell-frame-title"]`, `${row} [data-testid="cell-frame-label"]`,
          `${row} span[title][dir="auto"]:not([data-testid="cell-frame-title"] span):not([data-testid="cell-frame-secondary"] span)`,
        ], 'outside'),
        option('blurMessage', 'Conversation previews', 'Conversation list', [
          `${row} [data-testid="cell-frame-secondary"]`, `${row} [data-testid="chat-list-item-preview"]`, `${row} ._ak8k span[dir="auto"]`,
        ], 'outside'),
        option('blurChatImage', 'Header picture', 'Opened conversation', [
          '#main header img:not(.emoji):not([data-plain-text])',
          '#main header :is([data-icon="default-user"], [data-icon="default-group"], [data-testid="avatar"])',
        ], 'inside'),
        option('blurChatName', 'Header name', 'Opened conversation', [
          '#main header [data-testid="conversation-info-header-chat-title"]',
          '#main header span[title][dir="auto"]:not([data-testid="conversation-info-header-chat-title"] span)',
        ], 'inside'),
        option('blurChatAllMessages', 'Incoming and outgoing messages', 'Opened conversation', [
          `${messages} .selectable-text`, `${messages} [data-testid="msg-text"]:not(.selectable-text)`,
        ], 'inside'),
        option('blurChatMedia', 'Images and media', 'Opened conversation', [
          `${messages} :is(img:not(.emoji):not([data-plain-text]), video, canvas, [data-testid="image-thumb"], [data-testid="video-thumb"])`,
        ], 'inside'),
        option('blurChatLastImage', 'Latest message images (legacy)', 'Additional controls', [`${latest} img:not(.emoji):not([data-plain-text])`], 'inside'),
        option('blurChatLastMessage', 'Latest message text (legacy)', 'Additional controls', [`${latest} .selectable-text`], 'inside'),
        option('blurUsername', 'Legacy username labels', 'Additional controls', [`${row} span._1wjpf`], 'outside'),
      ],
    },
    gmail: {
      label: 'Gmail', hosts: ['mail.google.com'], allKey: 'gmailBlurAll',
      options: [
        option('gmailBlurSender', 'Sender names', 'Email', ['tr.zA .yW span[email]', 'span.bA4 span[email]', '.gD']),
        option('gmailBlurSender2', 'Additional sender labels', 'Email', ['tr.zA .yW span[name]', '.bog span[name]']),
        option('gmailBlurSubject', 'Email subjects', 'Email', ['tr.zA .bog', '.ha h2.hP']),
        option('gmailBlurSnippet', 'Email previews', 'Email', ['tr.zA .y2']),
        option('gmailBlurContent', 'Email content', 'Email', ['.a3s.aiL']),
      ], allSelectors: ['tr.zA'],
    },
    outlook: {
      label: 'Outlook', hosts: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'outlook.cloud.microsoft'], allKey: 'outlookBlurAll',
      options: [
        option('outlookBlurSender', 'Sender names', 'Email', ['div.XG5Jd.TszOG [role="gridcell"] span[title]', 'div.XG5Jd.TszOG .ms-List-cell [title]']),
        option('outlookBlurSubject', 'Email subjects', 'Email', ['div.XG5Jd.TszOG [role="gridcell"] span:not([title])', 'div.XG5Jd.TszOG .ms-List-cell span:not([title])']),
        option('outlookBlurPreview', 'Email previews', 'Email', ['div.XG5Jd.TszOG .ms-Button-label']),
        option('outlookBlurContent', 'Email content', 'Email', ['[role="document"][aria-label]']),
      ], allSelectors: ['div.XG5Jd.TszOG'],
    },
    teams: {
      label: 'Microsoft Teams', hosts: ['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'], allKey: 'teams_blurAll',
      options: [
        option('teams_blurImage', 'Profile images', 'Conversations', ['[data-tid="chat-list"] .fui-Avatar img', '[data-tid="chat-list-item"] .fui-Avatar img']),
        option('teams_blurName', 'Contact and chat names', 'Conversations', ['[data-tid="chat-list-item-title"]']),
        option('teams_blurMessage', 'Conversation previews', 'Conversations', ['[data-tid="chat-list-item-preview-message"]']),
        option('teams_blurChatImage', 'Header picture', 'Opened conversation', ['[data-tid="chat-header"] .fui-Avatar img']),
        option('teams_blurChatName', 'Header name', 'Opened conversation', ['[id^="chat-topic-person-"]']),
        option('teams_blurChatAllMessages', 'Messages', 'Opened conversation', ['[data-tid^="message-body-content"]']),
        option('teams_blurChatLastImage', 'Images and media', 'Opened conversation', ['img[data-tid^="lazy-image"]']),
      ],
    },
  };
  function detectPlatform(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return null;
      return Object.keys(platforms).find(key => platforms[key].hosts.includes(parsed.hostname)) ?? null;
    } catch { return null; }
  }
  const defaults = { pc_hoverReveal: true, pc_blurIntensity: 5, pc_theme: 'system', pc_settingsVersion: 2, pc_whatsapp_insideAll: false };
  for (const [key, platform] of Object.entries(platforms)) {
    defaults[`pc_${key}_enabled`] = true;
    defaults[platform.allKey] = false;
    for (const { key: optionKey } of platform.options) defaults[optionKey] = false;
  }
  const settingsKeys = [...Object.keys(defaults), 'blurEnabled'];
  const hasWhatsAppPrefs = raw => platforms.whatsapp.options.some(({ key }) => typeof raw[key] === 'boolean') || typeof raw.blurAll === 'boolean';
  function normalize(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    const prefs = { ...defaults };
    for (const [key, value] of Object.entries(defaults)) {
      if (typeof value === 'boolean' && typeof raw[key] === 'boolean') prefs[key] = raw[key];
    }
    if (Number.isFinite(raw.pc_blurIntensity)) prefs.pc_blurIntensity = Math.min(16, Math.max(3, raw.pc_blurIntensity));
    if (['system', 'light', 'dark'].includes(raw.pc_theme)) prefs.pc_theme = raw.pc_theme;
    // The legacy action was unreachable with default_popup. Honor it only for legacy-only profiles.
    if (!hasWhatsAppPrefs(raw) && typeof raw.blurEnabled === 'boolean') {
      prefs.blurAll = raw.blurEnabled;
      if (typeof raw.pc_whatsapp_enabled !== 'boolean') prefs.pc_whatsapp_enabled = raw.blurEnabled;
    }
    return prefs;
  }
  function migrationPatch(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    const prefs = normalize(raw);
    const patch = {};
    if (raw.pc_settingsVersion !== 2) patch.pc_settingsVersion = 2;
    if (!hasWhatsAppPrefs(raw) && typeof raw.blurEnabled === 'boolean') {
      patch.blurAll = prefs.blurAll;
      if (typeof raw.pc_whatsapp_enabled !== 'boolean') patch.pc_whatsapp_enabled = prefs.pc_whatsapp_enabled;
    }
    return patch;
  }
  function getBlurTarget(selectors) {
    // :is() scopes :hover to EVERY member, including nested selector lists.
    return `:is(${[...new Set(selectors)].join(', ')}):not(button, button *, input, textarea, select, [contenteditable="true"], [contenteditable="true"] *, [role="button"][aria-haspopup], [role="button"][aria-haspopup] *)`;
  }
  function createBlurCSS(selectors, intensity, reveal) {
    if (!selectors.length) return '';
    const target = getBlurTarget(selectors);
    const blur = `${target} { filter: blur(${intensity}px) !important; transition: none !important; }`;
    return reveal ? `${blur}\n${target}:hover { filter: none !important; }` : blur;
  }
  function getActiveOptions(platformKey, raw) {
    const platform = platforms[platformKey];
    const prefs = normalize(raw);
    if (!platform || !prefs[`pc_${platformKey}_enabled`]) return [];
    return platform.options.filter(option => {
      const master = platformKey === 'whatsapp' && option.scope === 'inside' ? platform.insideAllKey : platform.allKey;
      return prefs[option.key] || prefs[master];
    });
  }
  function getOptionSelectors(platformKey, option) {
    if (platformKey !== 'whatsapp') return option.selectors;
    const guard = option.scope === 'outside'
      ? `:where(${list} *):not(#main, #main *)`
      : `:where(#main *):not(${list}, ${list} *)`;
    // Guard the final target as well as the selector's ancestor path.
    return option.selectors.map(selector => `:is(${selector})${guard}`);
  }
  function buildCSS(platformKey, raw) {
    const platform = platforms[platformKey];
    const prefs = normalize(raw);
    if (!platform || !prefs[`pc_${platformKey}_enabled`]) return '';
    const all = prefs[platform.allKey];
    const selectors = getActiveOptions(platformKey, prefs).flatMap(option => getOptionSelectors(platformKey, option));
    if (all) selectors.push(...(platform.allSelectors ?? []));
    // One rule pair prevents specificity conflicts between overlapping categories.
    return createBlurCSS(selectors, prefs.pc_blurIntensity, prefs.pc_hoverReveal);
  }
  globalThis.PrivacyCurtain = Object.freeze({ engineRevision, platforms, defaults, settingsKeys, normalize, migrationPatch, detectPlatform, getBlurTarget, createBlurCSS, getActiveOptions, getOptionSelectors, buildCSS });
})();
