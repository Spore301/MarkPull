import { useState, useEffect } from 'react';
import { Send, FileText, ChevronDown, Check, Key } from 'lucide-react';

export default function Chat({ markdownOutput }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can answer questions based on your extracted markdown or any file in your library. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [files, setFiles] = useState([]);
  
  // File Context Selector
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState('current');
  
  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['geminiApiKey'], (res) => {
      if (res.geminiApiKey) setApiKey(res.geminiApiKey);
    });
    chrome.runtime.sendMessage({ action: 'get_library' }, (res) => {
      if (res && res.status === 'ok' && res.data.files) {
        setFiles(res.data.files);
      }
    });
  }, []);

  const saveApiKey = (key) => {
    setApiKey(key);
    chrome.storage.local.set({ geminiApiKey: key });
  };

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

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    if (activeFile && activeFile.id === 'current' && !activeFile.content) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Your current extraction is empty. Please select an area to extract first or choose a file from your library." }]);
      setIsTyping(false);
      return;
    }

    const contextText = activeFile ? activeFile.content : "No context provided.";

    chrome.runtime.sendMessage({
      action: 'ask_ai',
      prompt: userMsg,
      context: contextText,
      apiKey: apiKey
    }, (response) => {
      setIsTyping(false);
      if (chrome.runtime.lastError || !response || response.status === 'error') {
        let errorMsg = response?.message || chrome.runtime.lastError?.message || "Failed to contact AI.";
        if (errorMsg.includes('Quota exceeded')) {
           errorMsg = "Google Cloud Quota Exceeded. To fix this, provide a free Gemini API Key from Google AI Studio by clicking the Key icon above.";
        }
        setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${errorMsg}` }]);
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', text: response.answer }]);
    });
  };

  return (
    <div className="chat-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', gap: '12px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {showKeyInput ? (
           <div style={{ display: 'flex', gap: '8px' }}>
             <input 
               type="password"
               placeholder="Gemini API Key OR Ollama URL (http://localhost:11434)"
               value={apiKey}
               onChange={(e) => saveApiKey(e.target.value.trim())}
               onKeyDown={(e) => { if (e.key === 'Enter') setShowKeyInput(false); }}
               className="modal-input"
               style={{ width: '250px', margin: 0, padding: '4px 8px', fontSize: '0.8rem' }}
             />
             <button className="tab-button" onClick={() => setShowKeyInput(false)} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-button)', border: '1px solid var(--border-glass)' }}>
               Save
             </button>
           </div>
        ) : (
           <button className="tab-button" onClick={() => setShowKeyInput(true)} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-button)', border: '1px solid var(--border-glass)' }}>
             <Key size={12} /> {apiKey ? 'AI Provider Configured' : 'Add API Key / Ollama Host'}
           </button>
        )}
      </div>

      <div className="chat-messages glass-card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-button)',
            color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
            padding: '10px 14px',
            borderRadius: '12px',
            maxWidth: '80%',
            lineHeight: 1.5,
            border: m.role !== 'user' ? '1px solid var(--border-glass)' : 'none',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap'
          }}>
            {m.text}
          </div>
        ))}
        {isTyping && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
            AI is thinking...
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
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question about the document..."
            className="modal-input"
            style={{ flex: 1, margin: 0, padding: '10px 16px' }}
          />
          <button className="action-button primary" onClick={handleSend} disabled={!input.trim() || isTyping} style={{ padding: '0 16px' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
