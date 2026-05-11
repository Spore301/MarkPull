import { useState, useEffect } from 'react';
import { getAiConfig, setAiConfig } from './storage';
import { CheckCircle2, Server, Cloud, Sun, Moon, Monitor, Palette } from 'lucide-react';

export default function Settings({ theme, setTheme }) {
  const [config, setConfig] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  const [quota, setQuota] = useState(null);

  useEffect(() => {
    getAiConfig().then(setConfig);
    chrome.runtime.sendMessage({ action: 'get_drive_quota' }, (res) => {
      if (res && res.status === 'ok') setQuota(res.quota);
    });
  }, []);

  const handleDriveLogin = () => {
    chrome.runtime.sendMessage({ action: 'login_drive' }, () => {
      chrome.runtime.sendMessage({ action: 'get_drive_quota' }, (res) => {
        if (res && res.status === 'ok') setQuota(res.quota);
      });
    });
  };

  const handleDriveLogout = () => {
    chrome.runtime.sendMessage({ action: 'logout_drive' }, () => {
      setQuota(null);
    });
  };

  const handleVendorChange = (vendorId) => {
    const newConfig = { ...config, activeVendor: vendorId };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleInputChange = (vendorId, field, value) => {
    const newConfig = {
      ...config,
      vendors: {
        ...config.vendors,
        [vendorId]: {
          ...config.vendors[vendorId],
          [field]: value
        }
      }
    };
    setConfig(newConfig);
  };

  const handleBlur = () => {
    saveConfig(config);
  };

  const saveConfig = async (newConfig) => {
    await setAiConfig(newConfig);
    setSaveStatus('Saved!');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  if (!config) return <div style={{ padding: '20px' }}>Loading settings...</div>;

  const vendorsList = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'ollama', name: 'Ollama (Local)' }
  ];

  const themes = [
    { id: 'light', name: 'Light', icon: Sun },
    { id: 'dark', name: 'Dark', icon: Moon },
    { id: 'system', name: 'System', icon: Monitor }
  ];

  return (
    <div className="panel-container animate-fade-in" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Palette size={18} /> Appearance
        </h2>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {themes.map(t => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <button 
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`action-button ${isActive ? 'primary' : 'secondary'}`}
                style={{ flex: 1, gap: '6px', fontSize: '0.8rem', padding: '8px 4px' }}
              >
                <Icon size={14} />
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} /> AI Provider Settings
        </h2>
        {saveStatus && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> {saveStatus}</span>}
      </div>
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Cloud size={16} /> Google Drive</h3>
          {quota ? (
            <button className="action-button secondary" onClick={handleDriveLogout} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>Log Out</button>
          ) : (
            <button className="action-button primary" onClick={handleDriveLogin} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>Log In</button>
          )}
        </div>
        {quota && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Storage Used: {(quota.usage / (1024 ** 3)).toFixed(2)} GB</span>
              <span>Total: {(quota.limit / (1024 ** 3)).toFixed(2)} GB</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-button)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent)', width: `${(quota.usage / quota.limit) * 100}%` }}></div>
            </div>
          </div>
        )}
      </div>
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Select an AI provider and configure it to use the Chat feature with your extracted markdown.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {vendorsList.map(vendor => (
            <div 
              key={vendor.id}
              style={{
                border: config.activeVendor === vendor.id ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
                borderRadius: '8px',
                padding: '12px',
                background: config.activeVendor === vendor.id ? 'var(--bg-button)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: config.activeVendor === vendor.id ? '12px' : '0' }}
                onClick={() => handleVendorChange(vendor.id)}
              >
                <input 
                  type="radio" 
                  checked={config.activeVendor === vendor.id}
                  onChange={() => handleVendorChange(vendor.id)}
                  style={{ margin: 0, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: config.activeVendor === vendor.id ? 600 : 400 }}>{vendor.name}</span>
              </div>

              {config.activeVendor === vendor.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {vendor.id === 'ollama' ? 'Local Host URL' : 'API Key'}
                    </label>
                    <input 
                      type={vendor.id === 'ollama' ? 'text' : 'password'}
                      className="modal-input"
                      value={config.vendors[vendor.id].apiKey}
                      onChange={(e) => handleInputChange(vendor.id, 'apiKey', e.target.value)}
                      onBlur={handleBlur}
                      placeholder={vendor.id === 'ollama' ? 'http://localhost:11434' : 'Paste your API key here'}
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Model Name</label>
                    <input 
                      type="text"
                      className="modal-input"
                      value={config.vendors[vendor.id].model}
                      onChange={(e) => handleInputChange(vendor.id, 'model', e.target.value)}
                      onBlur={handleBlur}
                      placeholder="e.g. gpt-4o, claude-3-5-sonnet, llama3"
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
