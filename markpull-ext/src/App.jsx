import { useState, useEffect } from 'react';
import { extractHtmlToMarkdown } from './extractor';
import { lintMarkdown } from './linter';
import { marked } from 'marked';
import { Columns, FileCode, FileText, Download, Copy, MousePointer2, Sun, Moon, Monitor, ChevronDown, Maximize, ScanText, Save, Library as LibraryIcon, Edit3, MessageSquare, Settings as SettingsIcon, X } from 'lucide-react';
import logoDark from './assets/logo-dark.svg';
import logoLight from './assets/logo-light.svg';
import RawPreview from './RawPreview';
import RenderedPreview from './RenderedPreview';
import StatusBar from './StatusBar';
import Library from './Library';
import ProjectModal from './ProjectModal';
import Chat from './Chat';
import Settings from './Settings';
import CopyToAI from './CopyToAI';
import { Rows2 } from 'lucide-react';


export default function App() {
  const [activeTab, setActiveTab] = useState('extract'); // 'extract', 'library', 'chat', 'settings'
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [theme, setTheme] = useState('system');
  const [viewMode, setViewMode] = useState('split');
  const [filename, setFilename] = useState('export.md');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  
  const [isSystemDark, setIsSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setIsSystemDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDarkTheme = theme === 'dark' || (theme === 'system' && isSystemDark);
  const currentLogo = isDarkTheme ? logoDark : logoLight;

  const syncPickerState = async (tabId, isActive) => {
    chrome.tabs.sendMessage(tabId, { action: 'toggle_picker', isActive }, (res) => {
      if (chrome.runtime.lastError && isActive) {
        const manifest = chrome.runtime.getManifest();
        const contentJs = manifest.content_scripts?.[0]?.js;
        if (contentJs) {
          chrome.scripting.executeScript({ target: { tabId }, files: contentJs })
            .then(() => chrome.tabs.sendMessage(tabId, { action: 'toggle_picker', isActive }))
            .catch(() => {});
        }
      }
    });
  };

  useEffect(() => {
    const updateActiveTab = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) syncPickerState(tab.id, isPickerActive);
    };

    updateActiveTab();

    if (!isPickerActive) {
      chrome.tabs.query({}).then(tabs => {
        tabs.forEach(t => chrome.tabs.sendMessage(t.id, { action: 'toggle_picker', isActive: false }).catch(()=>{}));
      });
      return;
    }

    const handleActivated = () => setIsPickerActive(false);
    const handleUpdated = (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) syncPickerState(tabId, true);
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, [isPickerActive]);

  useEffect(() => {
    const handleMessage = (request) => {
      if (request.action === 'live_selection_updated') {
        if (request.selections && request.selections.length > 0) {
          const rawMd = extractHtmlToMarkdown(request.selections);
          const lintedMd = lintMarkdown(rawMd);
          setMarkdownOutput(lintedMd);
        } else {
          setMarkdownOutput('');
        }
      } else if (request.action === 'picker_stopped_from_page') {
        setIsPickerActive(false);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const showStatus = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const togglePicker = () => {
    setIsPickerActive(!isPickerActive);
  };

  const injectAndRetry = async (tabId, payload, callback) => {
    chrome.tabs.sendMessage(tabId, payload, (res) => {
      if (chrome.runtime.lastError) {
        const manifest = chrome.runtime.getManifest();
        const contentJs = manifest.content_scripts?.[0]?.js;
        if (contentJs) {
          chrome.scripting.executeScript({ target: { tabId }, files: contentJs })
            .then(() => chrome.tabs.sendMessage(tabId, payload, callback))
            .catch(() => showStatus('Error injecting into page.'));
        } else {
          showStatus('Error communicating with page.');
        }
      } else {
        callback(res);
      }
    });
  };

  const extractFullPage = async () => {
    setDropdownOpen(false);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      injectAndRetry(tab.id, { action: 'extract_full_page' }, (response) => {
        if (response && response.selections) {
          const rawMd = extractHtmlToMarkdown(response.selections);
          const lintedMd = lintMarkdown(rawMd);
          setMarkdownOutput(lintedMd);
          showStatus('Extracted full page.');
          setIsPickerActive(false);
        }
      });
    }
  };

  const extractAutoDetect = async () => {
    setDropdownOpen(false);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      injectAndRetry(tab.id, { action: 'extract_auto_detect' }, (response) => {
        if (response && response.selections) {
          const rawMd = extractHtmlToMarkdown(response.selections);
          const lintedMd = lintMarkdown(rawMd);
          setMarkdownOutput(lintedMd);
          showStatus('Auto-detected main content.');
          setIsPickerActive(true);
        }
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(markdownOutput)
      .then(() => showStatus('Copied to clipboard!'))
      .catch(() => showStatus('Failed to copy.'));
  };

  const downloadMarkdown = () => {
    let currentName = filename.trim() || 'export.md';
    const match = currentName.match(/\.(md|pdf|docx|html)$/);
    const format = match ? match[1] : 'md';
    if (!match) currentName += '.md';
    
    let contentBlob;
    if (format === 'html') {
      const htmlContent = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Export</title></head>\n<body>\n${marked.parse(markdownOutput)}</body>\n</html>`;
      contentBlob = new Blob([htmlContent], { type: 'text/html' });
    } else if (format === 'docx') {
      const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>${marked.parse(markdownOutput)}</body></html>`;
      contentBlob = new Blob([htmlContent], { type: 'application/msword' });
    } else if (format === 'pdf') {
      const htmlContent = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Export</title><style>body { font-family: sans-serif; padding: 20px; }</style></head>\n<body>\n${marked.parse(markdownOutput)}</body>\n</html>`;
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(htmlContent);
      iframe.contentDocument.close();
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
      showStatus('Opened print dialog...');
      return;
    } else {
      contentBlob = new Blob([markdownOutput], { type: 'text/markdown' });
    }

    const url = URL.createObjectURL(contentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentName;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Downloaded!');
  };

  const handleSaveClick = () => {
    // ProjectModal now handles the filename enforce!
    setIsProjectModalOpen(true);
  };

  const handleSaveToDrive = (projectName) => {
    setIsProjectModalOpen(false);
    showStatus('Saving...');

    // Extract format from filename if it exists
    const formatMatch = filename.match(/\.(md|pdf|docx|html)$/);
    const savedFormat = formatMatch ? formatMatch[1] : 'md';
    const savedFilename = filename.replace(/\.(md|pdf|docx|html)$/, '') || 'export';
    
    chrome.runtime.sendMessage({
      action: 'save_to_drive',
      projectName: projectName,
      filename: `${savedFilename}.${savedFormat}`,
      format: savedFormat,
      content: markdownOutput
    }, (res) => {
      if (res && res.status === 'ok') {
        showStatus(`Saved to ${projectName}/${savedFilename}.${savedFormat}`);
      } else {
        showStatus('Failed to save: ' + (res?.message || 'Unknown error'));
      }
    });
  };

  return (
    <div className="panel-container">
      <div className="header">
        <img src={currentLogo} alt="MarkPull" className="app-logo" />
        
        <div className="view-selector-pill" style={{ display: 'flex', alignItems: 'stretch', background: 'transparent', borderRadius: 'var(--radius-pill)', padding: '4px', gap: '4px' }}>
          <button 
            className={`tab-button icon-only ${activeTab === 'extract' ? 'active' : ''}`} 
            onClick={() => setActiveTab('extract')} title="Extract">
            <Edit3 size={16} />
          </button>
          <button 
            className={`tab-button icon-only ${activeTab === 'library' ? 'active' : ''}`} 
            onClick={() => setActiveTab('library')} title="Library">
            <LibraryIcon size={16} />
          </button>
          <button 
            className={`tab-button icon-only ${activeTab === 'chat' ? 'active' : ''}`} 
            onClick={() => setActiveTab('chat')} title="Chat (AI)">
            <MessageSquare size={16} />
          </button>
          <button 
            className={`tab-button icon-only ${activeTab === 'settings' ? 'active' : ''}`} 
            onClick={() => setActiveTab('settings')} title="Settings">
            <SettingsIcon size={16} />
          </button>
        </div>

        <div className="header-actions">
          {isPickerActive && (
            <button 
              className="action-button danger" 
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-red, #ef4444)', color: 'white', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => setIsPickerActive(false)}
            >
              <X size={14} />
            </button>
          )}

          <div className="dropdown-container">
            <button className="action-button primary" onClick={() => setDropdownOpen(!dropdownOpen)}>
              Extract <ChevronDown size={14} />
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu glass-card">
                <button onClick={() => { setDropdownOpen(false); togglePicker(); }}>
                  <MousePointer2 size={14} /> {isPickerActive ? 'Stop Picking' : 'Pick Sections'}
                </button>
                <button onClick={extractAutoDetect}>
                  <ScanText size={14} /> Auto Detect
                </button>
                <button onClick={extractFullPage}>
                  <Maximize size={14} /> Full Page
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'settings' ? (
        <Settings theme={theme} setTheme={setTheme} />
      ) : activeTab === 'chat' ? (
        <Chat markdownOutput={markdownOutput} />
      ) : activeTab === 'library' ? (
        <Library 
          onLoadFile={(content) => {
            setMarkdownOutput(content);
            setActiveTab('extract');
          }} 
          onShowStatus={showStatus}
        />
      ) : (
        <>
          <div className="main-content animate-fade-in">
            <div className={`workspace view-${viewMode}`}>
              {viewMode === 'split' && (
                <>
                  <RawPreview markdown={markdownOutput} onChange={setMarkdownOutput} />
                  <RenderedPreview markdown={markdownOutput} />
                </>
              )}
              {viewMode === 'raw' && <RawPreview markdown={markdownOutput} onChange={setMarkdownOutput} />}
              {viewMode === 'rendered' && <RenderedPreview markdown={markdownOutput} />}
              
              <div className="floating-sidebar">
                <button className={`icon-button ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode('split')} title="Split View" aria-label="Split View"><Rows2 size={16}/></button>
                <button className={`icon-button ${viewMode === 'raw' ? 'active' : ''}`} onClick={() => setViewMode('raw')} title="Raw View" aria-label="Raw View"><FileCode size={16}/></button>
                <button className={`icon-button ${viewMode === 'rendered' ? 'active' : ''}`} onClick={() => setViewMode('rendered')} title="Rendered View" aria-label="Rendered View"><FileText size={16}/></button>
              </div>

              <CopyToAI markdownOutput={markdownOutput} />
            </div>
          </div>

          <div className="footer glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', flex: 1, marginRight: '16px' }}>
                <input
                  type="text"
                  className="modal-input"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="Enter the name of the file"
                  style={{ flex: 1, margin: 0, padding: '0 12px', height: '36px' }}
                />
                <select 
                  className="modal-input"
                  style={{ width: '80px', margin: 0, padding: '0 8px', height: '36px' }}
                  onChange={(e) => {
                    const currentBase = filename.replace(/\.(md|pdf|docx|html)$/, '') || 'export';
                    setFilename(`${currentBase}.${e.target.value}`);
                  }}
                  value={filename.match(/\.(md|pdf|docx|html)$/) ? filename.match(/\.(md|pdf|docx|html)$/)[1] : 'md'}
                >
                  <option value="md">.md</option>
                  <option value="html">.html</option>
                  <option value="pdf">.pdf</option>
                  <option value="docx">.docx</option>
                </select>
              </div>

              <div className="footer-actions" style={{ margin: 0 }}>
                <button className="action-button secondary" onClick={copyToClipboard} disabled={!markdownOutput} title="Copy">
                  <Copy size={14} />
                </button>
                <button className="action-button secondary" onClick={downloadMarkdown} disabled={!markdownOutput} title="Download">
                  <Download size={14} />
                </button>
                <button className="action-button primary" onClick={handleSaveClick} disabled={!markdownOutput}>
                  <Save size={14} /> Save
                </button>
              </div>
            </div>
          </div>

          <StatusBar markdown={markdownOutput} />
        </>
      )}

      {statusMessage && (
        <div className="status-container" style={{ position: 'absolute', bottom: '24px', right: '24px', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-card)', zIndex: 1000, animation: 'fadeUp 0.3s forwards ease-out' }}>
          <span className="status-msg" style={{ margin: 0, opacity: 1, transform: 'none', animation: 'none' }}>{statusMessage}</span>
        </div>
      )}

      <ProjectModal 
        isOpen={isProjectModalOpen} 
        onClose={() => setIsProjectModalOpen(false)} 
        onSave={handleSaveToDrive} 
      />
    </div>
  );
}
