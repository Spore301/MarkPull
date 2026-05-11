import { useState, useEffect } from 'react';
import { Trash2, FileText, RefreshCw, Folder, ChevronLeft, Cloud, Edit3, MoreVertical, Share2 } from 'lucide-react';

export default function Library({ onLoadFile, onShowStatus }) {
  const [files, setFiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null); // null means root
  
  const [openDropdown, setOpenDropdown] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, type: null, target: null, inputValue: '' });

  const fetchLibrary = () => {
    setIsLoading(true);
    setError(null);
    chrome.runtime.sendMessage({ action: 'get_library', forceRefresh: true }, (res) => {
      setIsLoading(false);
      if (res && res.status === 'ok') {
        setFiles(res.data.files);
        setProjects(res.data.projects || []);
      } else {
        setError(res?.message || 'Failed to load library or authenticate.');
      }
    });
  };

  useEffect(() => {
    fetchLibrary();
    const closeDropdown = () => setOpenDropdown(null);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);

  const toggleDropdown = (e, id) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === id ? null : id);
  };

  const handleShare = (link) => {
    if (!link) return;
    navigator.clipboard.writeText(link)
      .then(() => {
        if (onShowStatus) onShowStatus('Link copied to clipboard!');
      })
      .catch(() => {
        if (onShowStatus) onShowStatus('Failed to copy link.');
      });
  };

  const executeModalAction = () => {
    const { type, target, inputValue } = modalState;
    if (type === 'delete_file') {
      chrome.runtime.sendMessage({ action: 'delete_file', fileId: target.id }, (res) => {
        if (res && res.status === 'ok') {
          setFiles(files.filter(f => f.id !== target.id));
          const updatedFiles = files.filter(f => f.id !== target.id);
          if (updatedFiles.filter(f => (f.project || 'Untitled') === currentFolder).length === 0) setCurrentFolder(null);
        }
      });
    } else if (type === 'delete_folder') {
      chrome.runtime.sendMessage({ action: 'delete_folder', fileId: target.id }, (res) => {
        if (res && res.status === 'ok') {
          setProjects(projects.filter(p => p.id !== target.id));
          setFiles(files.filter(f => f.projectId !== target.id));
          if (currentFolder === target.name) setCurrentFolder(null);
        }
      });
    } else if (type === 'rename_file') {
      if (!inputValue || inputValue === target.name) return closeMenu();
      chrome.runtime.sendMessage({ action: 'rename_file', fileId: target.id, newName: inputValue }, (res) => {
        if (res && res.status === 'ok') setFiles(files.map(f => f.id === target.id ? { ...f, name: inputValue } : f));
      });
    } else if (type === 'rename_folder') {
      if (!inputValue || inputValue === target.name) return closeMenu();
      chrome.runtime.sendMessage({ action: 'rename_folder', fileId: target.id, newName: inputValue }, (res) => {
        if (res && res.status === 'ok') {
          setProjects(projects.map(p => p.id === target.id ? { ...p, name: inputValue } : p));
          setFiles(files.map(f => f.projectId === target.id ? { ...f, project: inputValue } : f));
          if (currentFolder === target.name) setCurrentFolder(inputValue);
        }
      });
    }
    closeMenu();
  };

  const closeMenu = () => setModalState({ isOpen: false, type: null, target: null, inputValue: '' });

  const handleLoad = (fileId) => {
    setIsLoading(true);
    chrome.runtime.sendMessage({ action: 'download_file', fileId }, (res) => {
      setIsLoading(false);
      if (res && res.status === 'ok') {
        onLoadFile(res.content);
      } else {
        setError('Failed to download file content.');
      }
    });
  };

  const currentFiles = currentFolder 
    ? files.filter(f => (f.project || 'Untitled') === currentFolder)
    : [];

  return (
    <div className="library-container animate-fade-in">
      <div className="library-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentFolder && (
            <button className="icon-button" onClick={() => setCurrentFolder(null)} title="Back to Projects">
              <ChevronLeft size={18} />
            </button>
          )}
          <h2>{currentFolder ? currentFolder : 'Your Projects'}</h2>
        </div>
        <button className="icon-button" onClick={fetchLibrary} title="Refresh">
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="status-msg error" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          {error}
          <button 
            className="action-button primary" 
            onClick={() => chrome.runtime.sendMessage({ action: 'login_drive' }, () => fetchLibrary())}
          >
            Sign in to Google Drive
          </button>
        </div>
      )}
      
      {isLoading && !error && <div className="status-msg">Loading files from Google Drive...</div>}

      {!isLoading && !error && files.length === 0 && (
        <div className="empty-state">
          <FileText size={48} />
          <p>No saved exports found.</p>
        </div>
      )}

      {/* ROOT VIEW (FOLDERS) */}
      {!isLoading && !error && projects.length > 0 && !currentFolder && (
        <div className="library-grid">
          {projects.map(proj => {
            const fileCount = files.filter(f => f.projectId === proj.id).length;
            const isDropdownOpen = openDropdown === proj.id;
            return (
              <div 
                key={proj.id} 
                className={`folder-item ${isDropdownOpen ? 'dropdown-open' : ''}`} 
                onClick={() => setCurrentFolder(proj.name)}
              >
                <div className="action-menu-container" style={{ position: 'absolute', top: '4px', right: '4px' }} onClick={e => e.stopPropagation()}>
                  <button className="folder-options-btn" onClick={(e) => toggleDropdown(e, proj.id)}>
                    <MoreVertical size={16} />
                  </button>
                  {isDropdownOpen && (
                    <div className="action-menu-dropdown folder-menu" style={{ left: 0, top: '100%' }}>
                      <button className="action-menu-item" onClick={() => { if(proj.webViewLink) chrome.tabs.create({ url: proj.webViewLink }) }}><Cloud size={14}/> Open in Drive</button>
                      <button className="action-menu-item" onClick={() => handleShare(proj.webViewLink)}><Share2 size={14}/> Share Link</button>
                      <button className="action-menu-item" onClick={() => { setModalState({ isOpen: true, type: 'rename_folder', target: proj, inputValue: proj.name }); setOpenDropdown(null); }}><Edit3 size={14}/> Rename</button>
                      <button className="action-menu-item danger" onClick={() => { setModalState({ isOpen: true, type: 'delete_folder', target: proj, inputValue: '' }); setOpenDropdown(null); }}><Trash2 size={14}/> Delete</button>
                    </div>
                  )}
                </div>

                <div className="folder-icon-wrapper">
                  <Folder size={42} fill="currentColor" strokeWidth={1} />
                  <span className="folder-icon-number">{fileCount}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                  <span className="item-name" title={proj.name}>{proj.name}</span>
                  {proj.createdTime && <span className="item-date" style={{ fontSize: '0.65rem', opacity: 0.7 }}>{new Date(proj.createdTime).toLocaleDateString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOLDER VIEW (FILES) */}
      {!isLoading && !error && currentFolder && (
        <div className="library-list">
          {currentFiles.length === 0 ? (
            <div className="empty-state"><p>No files in this project.</p></div>
          ) : (
            currentFiles.map(f => {
              const isDropdownOpen = openDropdown === f.id;
              return (
                <div key={f.id} className={`library-item ${isDropdownOpen ? 'dropdown-open' : ''}`}>
                  <div className="item-info" onClick={() => handleLoad(f.id)}>
                    <span className="item-name" style={{ fontWeight: '500' }}>{f.name}</span>
                    <span className="item-date">{new Date(f.createdTime).toLocaleDateString()}</span>
                  </div>
                  <div className="action-menu-container" onClick={e => e.stopPropagation()}>
                    <button className="icon-button" onClick={(e) => toggleDropdown(e, f.id)}>
                      <MoreVertical size={16} />
                    </button>
                    {isDropdownOpen && (
                      <div className="action-menu-dropdown file-menu" style={{ right: 0, top: '100%' }}>
                        <button className="action-menu-item" onClick={() => { if(f.webViewLink) chrome.tabs.create({ url: f.webViewLink }) }}><Cloud size={14}/> Open in Drive</button>
                        <button className="action-menu-item" onClick={() => handleShare(f.webViewLink)}><Share2 size={14}/> Share Link</button>
                        <button className="action-menu-item" onClick={() => { setModalState({ isOpen: true, type: 'rename_file', target: f, inputValue: f.name }); setOpenDropdown(null); }}><Edit3 size={14}/> Rename</button>
                        <button className="action-menu-item danger" onClick={() => { setModalState({ isOpen: true, type: 'delete_file', target: f, inputValue: '' }); setOpenDropdown(null); }}><Trash2 size={14}/> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* GENERIC ACTION MODAL */}
      {modalState.isOpen && (
        <div className="modal-overlay" onClick={closeMenu}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalState.type.includes('rename') ? 'Rename' : 'Confirm Delete'}
              </h3>
            </div>
            <div className="modal-body">
              {modalState.type.includes('rename') ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>Enter a new name for <strong>{modalState.target.name}</strong>:</p>
                  <input 
                    type="text" 
                    className="modal-input" 
                    value={modalState.inputValue} 
                    onChange={e => setModalState({ ...modalState, inputValue: e.target.value })} 
                    onKeyDown={e => e.key === 'Enter' && modalState.inputValue.trim() && executeModalAction()}
                    autoFocus
                  />
                </div>
              ) : (
                <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete <strong>{modalState.target.name}</strong> from Google Drive?
                  {modalState.type === 'delete_folder' && " This will delete all files inside it."}
                </p>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button className="action-button secondary" onClick={closeMenu}>Cancel</button>
              <button 
                className="action-button" 
                style={{ background: modalState.type.includes('delete') ? '#ef4444' : 'var(--accent)', color: 'white', border: 'none' }}
                onClick={executeModalAction}
                disabled={modalState.type.includes('rename') && !modalState.inputValue.trim()}
              >
                {modalState.type.includes('rename') ? 'Save' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
