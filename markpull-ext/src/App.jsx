import { useState, useEffect } from 'react';
import { extractHtmlToMarkdown } from './extractor';
import { lintMarkdown } from './linter';
import { Columns, FileCode, FileText, Download, Copy, MousePointer2, Sun, Moon, Monitor, ChevronDown, Maximize } from 'lucide-react';
import RawPreview from './RawPreview';
import RenderedPreview from './RenderedPreview';
import StatusBar from './StatusBar';
import './index.css';

function App() {
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [theme, setTheme] = useState('system');
  const [viewMode, setViewMode] = useState('split');
  const [filename, setFilename] = useState('export.md');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab && tab.title) {
        const dateStr = new Date().toISOString().split('T')[0];
        const safeTitle = tab.title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 50);
        setFilename(`${safeTitle}-${dateStr}.md`);
      }
    });
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  // Listen for live updates from content script
  useEffect(() => {
    const handleMessage = (request, sender, sendResponse) => {
      if (request.action === 'live_selection_updated') {
        if (request.selections && request.selections.length > 0) {
          const rawMd = extractHtmlToMarkdown(request.selections);
          const lintedMd = lintMarkdown(rawMd);
          setMarkdownOutput(lintedMd);
          showStatus(`Live: ${request.selections.length} section(s).`);
        } else {
          setMarkdownOutput('');
          showStatus('Selection cleared.');
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const toggleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  const showStatus = (msg) => {
    setStatusMsg(''); // force reset animation
    setTimeout(() => setStatusMsg(msg), 10);
  };

  const togglePicker = async () => {
    const newState = !isPickerActive;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle_picker', isActive: newState }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: Reload page to inject script.');
          return;
        }
        if (response && response.status === 'ok') {
          setIsPickerActive(response.isActive);
          showStatus(newState ? 'Picker active. Click on page.' : 'Picker deactivated.');
        }
      });
    }
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(markdownOutput)
      .then(() => showStatus('Copied to clipboard!'))
      .catch(() => showStatus('Failed to copy.'));
  };

  const downloadFile = () => {
    const blob = new Blob([markdownOutput], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'markpull-export.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('Downloaded successfully.');
  };

  // Close dropdown on outside click (simple naive approach for extension)
  useEffect(() => {
    const closeDropdown = (e) => { if (!e.target.closest('.dropdown-container')) setDropdownOpen(false); };
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);

  const ThemeIcon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;

  return (
    <div className="panel-container">
      <div className="header">
        <h1>MarkPull</h1>
        <div className="header-actions">
          
          <div className="dropdown-container">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
              className={`action-button primary ${isPickerActive ? 'active' : ''}`}
              aria-label="Extraction Options"
            >
              {isPickerActive ? <MousePointer2 size={16}/> : <Maximize size={16}/>}
              <span>{isPickerActive ? 'Picking' : 'Extract'}</span>
              <ChevronDown size={14} />
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu glass-card">
                <button onClick={() => { setDropdownOpen(false); togglePicker(); }}>
                  <MousePointer2 size={14} /> {isPickerActive ? 'Stop Picking' : 'Pick Sections'}
                </button>
                <button onClick={extractFullPage}>
                  <Maximize size={14} /> Full Page
                </button>
              </div>
            )}
          </div>

          <button onClick={toggleTheme} className="icon-button" title={`Theme: ${theme}`}>
            <ThemeIcon size={18} />
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="floating-sidebar">
          <button onClick={() => setViewMode('raw')} className={`icon-button ${viewMode === 'raw' ? 'active' : ''}`} title="Raw Markdown" aria-label="View raw markdown">
            <FileCode size={16} />
          </button>
          <button onClick={() => setViewMode('rendered')} className={`icon-button ${viewMode === 'rendered' ? 'active' : ''}`} title="Rendered HTML" aria-label="View rendered HTML">
            <FileText size={16} />
          </button>
          <button onClick={() => setViewMode('split')} className={`icon-button ${viewMode === 'split' ? 'active' : ''}`} title="Split View" aria-label="View split pane">
            <Columns size={16} />
          </button>
        </div>

        <div className={`workspace view-${viewMode}`}>
          {(viewMode === 'raw' || viewMode === 'split') && (
            <RawPreview markdown={markdownOutput} />
          )}
          {(viewMode === 'split') && <div className="pane-divider"></div>}
          {(viewMode === 'rendered' || viewMode === 'split') && (
            <RenderedPreview markdown={markdownOutput} />
          )}
        </div>
        
        <div className="overlay-statusbar">
          <StatusBar markdown={markdownOutput} />
        </div>
      </div>

      <div className="footer-actions">
        <div className="filename-input-group">
          <input 
            type="text" 
            value={filename} 
            onChange={(e) => setFilename(e.target.value)} 
            placeholder="filename.md"
            className="filename-input"
          />
        </div>
        <div className="action-buttons">
          {statusMsg && <span key={statusMsg} className="status-msg">{statusMsg}</span>}
          <button onClick={copyToClipboard} disabled={!markdownOutput} className="icon-button" title="Copy">
            <Copy size={16} />
          </button>
          <button onClick={downloadFile} disabled={!markdownOutput} className="icon-button primary" title="Download">
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
