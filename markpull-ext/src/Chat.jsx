import { useState, useEffect } from 'react';
import { Send, FileText, ChevronDown, Check, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useRef } from 'react';

export default function Chat({ markdownOutput }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can answer questions based on your extracted markdown or any file in your library. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [typingState, setTypingState] = useState(''); // '' means not typing. Otherwise holds the status string.
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);
  
  // File Context Selector
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState('current');
  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'get_library' }, (res) => {
      if (res && res.status === 'ok' && res.data.files) {
        setFiles(res.data.files);
      }
    });
  }, []);

  const availableFiles = [
    { id: 'current', name: 'Current Extraction', content: markdownOutput, project: 'Active' },
    ...files.map(f => ({ id: f.id, name: f.name, content: f.content || '(File content needs to be downloaded)', project: f.project || 'Uncategorized' }))
  ];

  const groupedFiles = availableFiles.reduce((acc, f) => {
    if (!acc[f.project]) acc[f.project] = [];
    acc[f.project].push(f);
    return acc;
  }, {});

  const activeFile = availableFiles.find(f => f.id === selectedFileId);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setTypingState('Analyzing...');

    if (activeFile && activeFile.id === 'current' && !activeFile.content) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Your current extraction is empty. Please select an area to extract first or choose a file from your library." }]);
      setTypingState('');
      return;
    }

    setTypingState('Reading document...');
    let contextText = activeFile ? activeFile.content : "No context provided.";
    const refFileName = activeFile ? activeFile.name : null;

    if (contextText === '(File content needs to be downloaded)') {
      setTypingState(`Downloading ${activeFile.name}...`);
      try {
        const fileContentRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'download_file', fileId: activeFile.id }, resolve);
        });
        if (fileContentRes && fileContentRes.status === 'ok') {
          contextText = fileContentRes.content;
          setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content: contextText } : f));
        } else {
           throw new Error(fileContentRes?.message || 'Failed to download file');
        }
      } catch (err) {
         setMessages(prev => [...prev, { role: 'assistant', text: `Error reading file: ${err.message}` }]);
         setTypingState('');
         return;
      }
    }

    setTypingState('Generating response...');

    chrome.runtime.sendMessage({
      action: 'ask_ai',
      prompt: userMsg,
      context: contextText
    }, (response) => {
      setTypingState('');
      if (chrome.runtime.lastError || !response || response.status === 'error') {
        let errorMsg = response?.message || chrome.runtime.lastError?.message || "Failed to contact AI.";
        if (errorMsg.includes('Quota exceeded')) {
           errorMsg = "Quota Exceeded. Please check your AI provider settings.";
        }
        setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${errorMsg}` }]);
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', text: response.answer, referencedFile: refFileName }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    });
  };

  return (
    <div className="chat-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '12px' }}>
      <div className="chat-messages glass-card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            {m.referencedFile && (
              <div style={{ alignSelf: 'flex-start', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-button)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                <FileText size={10} /> Referenced: {m.referencedFile}
              </div>
            )}
            <div style={{ 
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-button)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              padding: '10px 14px',
              borderRadius: '12px',
              lineHeight: 1.5,
              border: m.role !== 'user' ? '1px solid var(--border-glass)' : 'none',
              wordBreak: 'break-word',
              overflowX: 'auto'
            }}>
              {m.role === 'user' ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              ) : (
                <ReactMarkdown className="markdown-body" style={{ background: 'transparent' }}>{m.text}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {typingState && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Loader2 size={14} className="animate-spin" /> {typingState}
          </div>
        )}
      </div>

      <div className="chat-input-area glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* File Context Selector inside Typing Interface */}
        <div style={{ position: 'relative' }}>
          <button 
            className="tab-button" 
            style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-button)', border: '1px solid var(--border-glass)' }}
            onClick={() => setShowFileSelector(!showFileSelector)}
          >
            <FileText size={12} /> Reference: {activeFile?.name || 'None'} <ChevronDown size={12} />
          </button>
          
          {showFileSelector && (
            <div className="dropdown-menu glass-card" style={{ bottom: '100%', top: 'auto', left: 0, marginBottom: '8px', maxHeight: '200px', overflowY: 'auto', padding: '8px', minWidth: '180px' }}>
              {Object.entries(groupedFiles).map(([project, projectFiles]) => (
                <div key={project} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px', fontWeight: 600 }}>
                    {project}
                  </div>
                  {projectFiles.map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => { setSelectedFileId(f.id); setShowFileSelector(false); }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', width: '100%', textAlign: 'left', borderRadius: '4px' }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{f.name}</span>
                      {selectedFileId === f.id && <Check size={12} />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            ref={inputRef}
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question about the document..."
            className="modal-input"
            autoFocus
            style={{ flex: 1, margin: 0, padding: '10px 16px' }}
          />
          <button className="action-button primary" onClick={handleSend} disabled={!input.trim() || !!typingState} style={{ padding: '0 16px' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
