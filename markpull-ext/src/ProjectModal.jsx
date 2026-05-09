import { useState, useEffect } from 'react';
import { X, FolderPlus } from 'lucide-react';

export default function ProjectModal({ isOpen, onClose, onSave, defaultFilename = '' }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [filename, setFilename] = useState(defaultFilename);
  const [fileFormat, setFileFormat] = useState('md');

  useEffect(() => {
    if (isOpen) {
      setFilename(defaultFilename === 'export.md' ? '' : defaultFilename);
      setIsLoading(true);
      chrome.runtime.sendMessage({ action: 'get_library' }, (res) => {
        setIsLoading(false);
        if (res && res.status === 'ok' && res.data.projects) {
          setProjects(res.data.projects);
          if (res.data.projects.length > 0) {
            setSelectedProject(res.data.projects[0]);
          } else {
            setIsCreatingNew(true);
          }
        } else {
          setIsCreatingNew(true); // Fallback if no projects or error
        }
      });
    }
  }, [isOpen, defaultFilename]);

  if (!isOpen) return null;

  const handleSave = () => {
    const projName = isCreatingNew ? newProjectName : selectedProject;
    if (!projName.trim() || !filename.trim()) return;
    onSave(projName.trim(), filename.trim(), fileFormat);
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-content">
        <div className="modal-header">
          <h3>Save to Google Drive</h3>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        
        <div className="modal-body">
          {isLoading ? (
            <p className="status-msg">Authenticating and fetching projects...</p>
          ) : (
            <>
              <div className="project-selector" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Project Folder:</label>
                {!isCreatingNew && projects.length > 0 && (
                  <select 
                    value={selectedProject} 
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="modal-input"
                    style={{ marginTop: 0 }}
                  >
                    {projects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                
                {isCreatingNew && (
                  <input 
                    type="text" 
                    placeholder="New Project Name..." 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="modal-input"
                    style={{ marginTop: 0 }}
                    autoFocus
                  />
                )}
                
                {projects.length > 0 && (
                  <button 
                    className="action-button secondary mt-2" 
                    onClick={() => setIsCreatingNew(!isCreatingNew)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <FolderPlus size={14} /> 
                    <span>{isCreatingNew ? 'Select Existing' : 'Create New Project'}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        
        <div className="modal-footer" style={{ marginTop: '8px' }}>
          <button className="action-button secondary" onClick={onClose}>Cancel</button>
          <button 
            className="action-button primary" 
            onClick={handleSave} 
            disabled={isLoading || (isCreatingNew && !newProjectName.trim())}
          >
            Save File
          </button>
        </div>
      </div>
    </div>
  );
}
