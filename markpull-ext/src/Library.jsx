import { useState, useEffect } from 'react';
import { Trash2, FileText, RefreshCw, Folder, ChevronLeft, Cloud } from 'lucide-react';

export default function Library({ onLoadFile }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null); // null means root
  const [fileToDelete, setFileToDelete] = useState(null);

  const fetchLibrary = () => {
    setIsLoading(true);
    setError(null);
    chrome.runtime.sendMessage({ action: 'get_library' }, (res) => {
      setIsLoading(false);
      if (res && res.status === 'ok') {
        setFiles(res.data.files);
      } else {
        setError(res?.message || 'Failed to load library or authenticate.');
      }
    });
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const handleDelete = (fileId) => {
    chrome.runtime.sendMessage({ action: 'delete_file', fileId }, (res) => {
      if (res && res.status === 'ok') {
        setFiles(files.filter(f => f.id !== fileId));
      }
    });
  };

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

  const projects = [...new Set(files.map(f => f.project || 'Untitled'))];
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

      {error && <div className="status-msg error">{error}</div>}
      
      {isLoading && !error && <div className="status-msg">Loading files from Google Drive...</div>}

      {!isLoading && !error && files.length === 0 && (
        <div className="empty-state">
          <FileText size={48} />
          <p>No saved exports found.</p>
        </div>
      )}

      {/* ROOT VIEW (FOLDERS) */}
      {!isLoading && !error && files.length > 0 && !currentFolder && (
        <div className="library-list">
          {projects.map(proj => {
            const fileCount = files.filter(f => (f.project || 'Untitled') === proj).length;
            return (
              <div key={proj} className="library-item glass-card" onClick={() => setCurrentFolder(proj)} style={{ cursor: 'pointer' }}>
                <div className="item-info">
                  <span className="item-project" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem' }}>
                    <Folder size={16} /> {proj}
                  </span>
                  <span className="item-date">{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
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
            currentFiles.map(f => (
              <div key={f.id} className="library-item glass-card">
                <div className="item-info" onClick={() => handleLoad(f.id)}>
                  <span className="item-name" style={{ fontWeight: '500' }}>{f.name}</span>
                  <span className="item-date">{new Date(f.createdTime).toLocaleDateString()}</span>
                </div>
                <div className="item-actions">
                  <button 
                    className="icon-button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      chrome.tabs.create({ url: f.webViewLink });
                    }} 
                    title="Open in Drive"
                  >
                    <Cloud size={14} />
                  </button>
                  <button 
                    className="icon-button danger" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileToDelete(f);
                    }} 
                    title="Move to Trash"
                  >
                    <Trash2 size={14} style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* DELETE WARNING MODAL */}
      {fileToDelete && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div className="modal-header">
              <h3>Delete File?</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{fileToDelete.name}</strong>? This will permanently remove it from your Google Drive.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                className="action-button secondary" 
                onClick={() => setFileToDelete(null)}
              >
                Cancel
              </button>
              <button 
                className="action-button" 
                style={{ background: '#ef4444', color: 'white', border: 'none' }}
                onClick={() => {
                  handleDelete(fileToDelete.id);
                  if (currentFiles.length === 1) setCurrentFolder(null);
                  setFileToDelete(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
