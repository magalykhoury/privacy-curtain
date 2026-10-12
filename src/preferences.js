import '../public/shared.js';

const { platforms, settingsKeys, normalize, migrationPatch, detectPlatform } = globalThis.PrivacyCurtain;
export { platforms, settingsKeys, normalize, detectPlatform };

export async function loadPreferences(api) {
  const raw = await api.storage.sync.get(settingsKeys);
  const patch = migrationPatch(raw);
  if (Object.keys(patch).length) await api.storage.sync.set(patch);
  return normalize({ ...raw, ...patch });
}

export async function refreshTabs(api, platformKey) {
  const platform = platforms[platformKey];
  if (!platform) throw new Error('Unsupported platform');
  const tabs = await api.tabs.query({ url: platform.hosts.map(host => `https://${host}/*`) });
  const results = await Promise.all(tabs.filter(tab => Number.isInteger(tab.id) && detectPlatform(tab.url) === platformKey).map(async tab => {
    const message = { action: 'privacyCurtainRefresh', platform: platformKey };
    try {
      await api.tabs.sendMessage(tab.id, message);
      return true;
    } catch {
      try {
        await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['shared.js', 'content.js'] });
        await api.tabs.sendMessage(tab.id, message);
        return true;
      } catch { return false; }
    }
  }));
  return results.every(Boolean);
}

export async function savePreferences(api, platformKey, patch) {
  const platform = platforms[platformKey];
  if (!platform) throw new Error('Unsupported platform');
  const allowed = [platform.allKey, ...(platform.insideAllKey ? [platform.insideAllKey] : []), `pc_${platformKey}_enabled`, ...platform.options.map(({ key }) => key), 'pc_hoverReveal', 'pc_blurIntensity', 'pc_theme'];
  const normalized = normalize(patch);
  if (!Object.keys(patch).length || Object.entries(patch).some(([key, value]) => !allowed.includes(key) || normalized[key] !== value)) throw new Error('Invalid preference update');
  await api.storage.sync.set(patch);
  const general = 'pc_hoverReveal' in patch || 'pc_blurIntensity' in patch;
  const targets = general ? Object.keys(platforms) : [platformKey];
  // Preference writes succeed independently of suspended/closing tabs; every tab also listens to storage.
  try {
    return (await Promise.all(targets.map(key => refreshTabs(api, key)))).every(Boolean);
  } catch { return false; }
}
