importScripts('shared.js');
chrome.runtime.onInstalled.addListener(() => {
  const { settingsKeys, migrationPatch } = globalThis.PrivacyCurtain;
  chrome.storage.sync.get(settingsKeys, raw => {
    if (chrome.runtime.lastError) { console.warn('Privacy Curtain: preferences could not be loaded.'); return; }
    const patch = migrationPatch(raw || {});
    if (!Object.keys(patch).length) return;
    chrome.storage.sync.set(patch).catch(() => console.warn('Privacy Curtain: migration could not be saved.'));
  });
});
