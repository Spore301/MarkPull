import { useState, useEffect } from 'react';
import { extractHtmlToMarkdown } from './extractor';
import { lintMarkdown } from './linter';
import { Columns, FileCode, FileText, Download, Copy, MousePointer2, Sun, Moon, Monitor, ChevronDown, Maximize, ScanText, Save, Library as LibraryIcon, Edit3, MessageSquare } from 'lucide-react';
import logoDark from './assets/logo-dark.svg';
import logoLight from './assets/logo-light.svg';
import RawPreview from './RawPreview';
import RenderedPreview from './RenderedPreview';
import StatusBar from './StatusBar';
import Library from './Library';
import ProjectModal from './ProjectModal';
import Chat from './Chat';

export default function App() {
  const [activeTab, setActiveTab] = useState('extract'); // 'extract', 'library', 'chat'
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

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'toggle_picker', isActive: isPickerActive }).catch(() => {});
      }
    });
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

  const extractFullPage = async () => {
    setDropdownOpen(false);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'extract_full_page' }, (response) => {
        if (chrome.runtime.lastError) {
           showStatus('Error communicating with page.');
           return;
        }
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
      chrome.tabs.sendMessage(tab.id, { action: 'extract_auto_detect' }, (response) => {
        if (chrome.runtime.lastError) {
           showStatus('Error communicating with page.');
           return;
        }
        if (response && response.selections) {
          const rawMd = extractHtmlToMarkdown(response.selections);
          const lintedMd = lintMarkdown(rawMd);
          setMarkdownOutput(lintedMd);
          showStatus('Auto-detected main content.');
          setIsPickerActive(true); // Now we drop them into active picker mode!
        }
      });
    }
  };

  const enforceFilename = () => {
    let currentName = filename.trim();
    if (!currentName || currentName === 'export.md') {
      const newName = window.prompt('Please enter a file name for this document:', currentName || 'export.md');
      if (!newName || !newName.trim()) return null;
      currentName = newName.trim();
      if (!currentName.endsWith('.md')) currentName += '.md';
      setFilename(currentName);
    } else {
      if (!currentName.endsWith('.md')) {
        currentName += '.md';
        setFilename(currentName);
      }
    }
    return currentName;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(markdownOutput)
      .then(() => showStatus('Copied to clipboard!'))
      .catch(() => showStatus('Failed to copy.'));
  };

  const downloadMarkdown = () => {
    const finalName = enforceFilename();
    if (!finalName) return;
    const blob = new Blob([markdownOutput], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Downloaded!');
  };

  const handleSaveClick = () => {
    // ProjectModal now handles the filename enforce!
    setIsProjectModalOpen(true);
  };

  const handleSaveToDrive = (projectName, savedFilename, savedFormat) => {
    setIsProjectModalOpen(false);
    showStatus('Saving to Drive...');
    chrome.runtime.sendMessage({
      action: 'save_to_drive',
      projectName,
      filename: savedFilename,
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

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="panel-container">
      <div className="header">
        <img src={currentLogo} alt="MarkPull" className="app-logo" />
        
        <div className="view-selector-pill" style={{ display: 'flex', background: 'transparent', borderRadius: 'var(--radius-pill)', padding: '4px', gap: '4px' }}>
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
        </div>

        <div className="header-actions">
          {activeTab === 'extract' && (
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
          )}
          
          <button className="icon-button" onClick={() => setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light')} title="Toggle Theme" aria-label="Toggle Theme">
            <ThemeIcon size={16} />
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <Chat markdownOutput={markdownOutput} />
      ) : activeTab === 'library' ? (
        <Library onLoadFile={(content) => {
          setMarkdownOutput(content);
          setActiveTab('extract');
        }} />
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
                <button className={`icon-button ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode('split')} title="Split View" aria-label="Split View"><Columns size={16}/></button>
                <button className={`icon-button ${viewMode === 'raw' ? 'active' : ''}`} onClick={() => setViewMode('raw')} title="Raw View" aria-label="Raw View"><FileCode size={16}/></button>
                <button className={`icon-button ${viewMode === 'rendered' ? 'active' : ''}`} onClick={() => setViewMode('rendered')} title="Rendered View" aria-label="Rendered View"><FileText size={16}/></button>
              </div>
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
                  style={{ flex: 1, margin: 0, padding: '8px 12px' }}
                />
                <select 
                  className="modal-input"
                  style={{ width: '80px', margin: 0, padding: '8px' }}
                  onChange={(e) => {
                    // Update filename extension if format changes
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
                <button className="action-button secondary" onClick={copyToClipboard} disabled={!markdownOutput}>
                  <Copy size={14} /> Copy
                </button>
                <button className="action-button secondary" onClick={downloadMarkdown} disabled={!markdownOutput}>
                  <Download size={14} /> Download
                </button>
                <button className="action-button primary" onClick={handleSaveClick} disabled={!markdownOutput}>
                  <Save size={14} /> Save
                </button>
              </div>
            </div>
            {statusMessage && (
              <div className="status-container" style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: '16px', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-card)', zIndex: 10 }}>
                <span className="status-msg" style={{ margin: 0 }}>{statusMessage}</span>
              </div>
            )}
          </div>

          <StatusBar markdown={markdownOutput} />
        </>
      )}

      <ProjectModal 
        isOpen={isProjectModalOpen} 
        onClose={() => setIsProjectModalOpen(false)} 
        onSave={handleSaveToDrive} 
      />
    </div>
  );
}
