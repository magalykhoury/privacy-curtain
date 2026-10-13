import { useEffect, useRef, useState } from 'react';
import { platforms, settingsKeys, normalize, detectPlatform, loadPreferences, savePreferences } from './preferences.js';
import eye from '../public/assets/icon-eye.png';
import whatsappIcon from './icons/whatsapp.svg';
import gmailIcon from './icons/envelope-fill.svg';
import outlookIcon from './icons/envelope-at-fill.svg';
import teamsIcon from './icons/microsoft-teams.svg';
import './popup.css';

const platformIcons = { whatsapp: whatsappIcon, gmail: gmailIcon, outlook: outlookIcon, teams: teamsIcon };

function Switch({ label, checked, disabled, onChange, description }) {
  return <label className="control-row">
    <span className="control-copy"><span>{label}</span>{description && <small>{description}</small>}</span>
    <input className="switch" type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
  </label>;
}

export default function App() {
  const [prefs, setPrefs] = useState(normalize());
  const [platform, setPlatform] = useState('whatsapp');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [diagnosticReport, setDiagnosticReport] = useState(null);
  const [diagnosticError, setDiagnosticError] = useState('');
  const [checkingCoverage, setCheckingCoverage] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    if (!globalThis.chrome?.storage?.sync) { setError('Open Privacy Curtain from the extension toolbar to use saved settings.'); return; }
    const api = globalThis.chrome;
    let alive = true;
    let sequence = 0;
    async function read(migrate = false) {
      const ticket = ++sequence;
      try {
        const data = migrate ? await loadPreferences(api) : normalize(await api.storage.sync.get(settingsKeys));
        if (alive && ticket === sequence) { setPrefs(data); setReady(true); setError(''); }
      } catch {
        if (alive && ticket === sequence) { setReady(false); setError('Preferences could not be loaded. Retry before changing protection.'); }
      }
    }
    const changed = (changes, area) => {
      if (area === 'sync' && settingsKeys.some(key => key in changes)) read();
    };
    api.storage.onChanged.addListener(changed);
    read(true);
    api.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (!alive) return;
      const detected = detectPlatform(tabs[0]?.url);
      if (detected) setPlatform(detected);
    }).catch(() => {});
    return () => { alive = false; api.storage.onChanged.removeListener(changed); };
  }, [attempt]);

  async function save(patch, target = platform) {
    if (saving.current || !ready) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setFeedback('Saving…');
    try {
      const connected = await savePreferences(globalThis.chrome, target, patch);
      setFeedback(connected ? 'Preferences saved' : 'Saved. Refresh any page that has not updated.');
    } catch {
      setError('Preferences were not saved. Your previous settings are still in use.');
      setFeedback('');
    } finally { saving.current = false; setBusy(false); }
  }

  const config = platforms[platform];
  const enabled = prefs[`pc_${platform}_enabled`];
  const all = prefs[config.allKey];
  const insideAll = Boolean(config.insideAllKey && prefs[config.insideAllKey]);
  const selectedCount = config.options.filter(({ key }) => prefs[key]).length;
  const sections = [...new Set(config.options.map(({ section }) => section))];
  const chatLayout = platform === 'whatsapp' || platform === 'teams';
  const disabled = !ready || busy;
  const status = !ready ? 'Loading preferences' : !enabled ? 'Protection paused' : all || insideAll ? (platform === 'whatsapp' ? `${all ? 'Outside' : ''}${all && insideAll ? ' & ' : ''}${insideAll ? 'Inside' : ''} master enabled` : 'All categories selected') : selectedCount ? `${selectedCount} categories selected` : 'No categories selected';

  function renderOptions(section) {
    return config.options.filter(option => option.section === section).map(({ key, label, scope }) => {
      const master = platform === 'whatsapp' && scope === 'inside' ? insideAll : all;
      return <Switch key={key} label={label} checked={master || prefs[key]} disabled={disabled || master} onChange={value => save({ [key]: value })} />;
    });
  }

  async function checkCoverage() {
    setCheckingCoverage(true);
    setDiagnosticReport(null);
    setDiagnosticError('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (detectPlatform(tab?.url) !== 'whatsapp') throw new Error('Wrong page');
      const report = await chrome.tabs.sendMessage(tab.id, { action: 'privacyCurtainDiagnostics' });
      if (report?.engineRevision !== globalThis.PrivacyCurtain.engineRevision || report.platform !== 'whatsapp') throw new Error('Old engine');
      setDiagnosticReport(report);
    } catch {
      setDiagnosticError('Open WhatsApp Web, then refresh it after reloading Privacy Curtain Dev. Retry the coverage check.');
    } finally { setCheckingCoverage(false); }
  }

  return <main className="popup" data-theme={prefs.pc_theme} aria-busy={busy}>
    <header className="brand"><img src={eye} alt="" width="36" height="36" /><div><h1>Privacy Curtain</h1><p>A little more privacy.</p></div><span className="version">2.0.3</span></header>
    <nav className="platform-picker" aria-label="Privacy platforms">
      {Object.entries(platforms).map(([key, { label }]) => <button className="icon-button" type="button" key={key} aria-label={label === 'Microsoft Teams' ? 'Teams' : label} title={label} aria-pressed={platform === key} onClick={() => { setPlatform(key); setFeedback(''); }} disabled={busy}><img src={platformIcons[key]} alt="" width="20" height="20" /></button>)}
    </nav>
    <section className="platform-panel" aria-label={`${config.label} privacy controls`}>
      <div className="panel-heading"><div><h2>{config.label} Blur Settings</h2><p className="protection-state" data-enabled={enabled && (all || selectedCount > 0)}>{status}</p></div><Switch label={`${config.label} protection`} checked={enabled} disabled={disabled} onChange={value => save({ [`pc_${platform}_enabled`]: value })} /></div>
      <div className={`fieldset-container${chatLayout ? ' chat-columns' : ''}`}>
        {sections.filter(section => section !== 'Additional controls').map(section => <fieldset key={section}>
          <legend>{chatLayout ? (section === 'Opened conversation' ? 'Inside Chat Options' : 'Outside Chat Options') : 'Email Options'}</legend>
          {renderOptions(section)}
          {section !== 'Opened conversation' && <>
            <Switch label={platform === 'whatsapp' ? 'Outside Blur everything' : 'Blur everything'} description={platform === 'whatsapp' ? 'Conversation list only: pictures, names and previews' : 'All supported categories on this platform'} checked={all} disabled={disabled} onChange={value => save({ [config.allKey]: value })} />
            {all && <p className="hint">{platform === 'whatsapp' ? 'Inside controls remain independent.' : 'Turn off Blur everything to adjust individual categories.'}</p>}
          </>}
          {config.insideAllKey && section === 'Opened conversation' && <Switch label="Inside Blur everything" description="Opened conversation only" checked={insideAll} disabled={disabled} onChange={value => save({ [config.insideAllKey]: value })} />}
        </fieldset>)}
      </div>
      {sections.includes('Additional controls') && <details className="additional"><summary>Additional controls</summary>{renderOptions('Additional controls')}</details>}
    </section>
    <details className="general-settings"><summary>Reveal & appearance</summary>
      <Switch label="Hover to reveal" description="Reveal only the element under your pointer" checked={prefs.pc_hoverReveal} disabled={disabled} onChange={value => save({ pc_hoverReveal: value })} />
      <label className="select-row"><span>Blur intensity</span><select aria-label="Blur intensity" value={prefs.pc_blurIntensity} disabled={disabled} onChange={event => save({ pc_blurIntensity: Number(event.target.value) })}>{[...new Set([3, 5, 8, 12, 16, prefs.pc_blurIntensity])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} px{value === 5 ? ' · Default' : ''}</option>)}</select></label>
      <label className="select-row"><span>Theme</span><select aria-label="Theme" value={prefs.pc_theme} disabled={disabled} onChange={event => save({ pc_theme: event.target.value })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    </details>
    {platform === 'whatsapp' && <details className="general-settings"><summary>WhatsApp coverage diagnostics</summary>
      <p className="hint">On demand, count-only diagnostics. No names, messages, media URLs or page HTML are read or included.</p>
      <button className="diagnostic-button" type="button" disabled={!ready || checkingCoverage} onClick={checkCoverage}>{checkingCoverage ? 'Checking…' : 'Check WhatsApp coverage'}</button>
      {diagnosticError && <p className="error" role="alert">{diagnosticError}</p>}
      {diagnosticReport && <><p className="hint">Selector matches are diagnostic evidence. Confirm visible coverage yourself.</p><pre className="diagnostic-report" tabIndex="0" aria-label="Count-only WhatsApp diagnostics">{JSON.stringify(diagnosticReport, null, 2)}</pre></>}
    </details>}
    <div className="save-feedback" role="status" aria-live="polite">{feedback || (ready ? 'Preferences sync across your open tabs.' : 'Loading saved preferences…')}</div>
    {error && <div className="error" role="alert"><p>{error}</p>{!ready && <button type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button>}</div>}
    <footer>Visual protection only. Website layouts can change; verify coverage before relying on blur.</footer>
  </main>;
}
