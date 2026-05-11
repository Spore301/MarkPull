import { useState, useEffect } from 'react';
import { Bot, ChevronUp } from 'lucide-react';
import copyToAiUrl from './assets/copy-to-ai.svg';
import openaiUrl from './assets/openai.svg';
import claudeUrl from './assets/claude-color.svg';
import deepseekUrl from './assets/deepseek-color.svg';
import geminiUrl from './assets/gemini-color.svg';

const AI_PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', icon: openaiUrl, filterInDark: true },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/', icon: claudeUrl },
  { id: 'deepseek', name: 'Deepseek', url: 'https://chat.deepseek.com/', icon: deepseekUrl },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', icon: geminiUrl }
];

export default function CopyToAI({ markdownOutput }) {
  const [activeAI, setActiveAI] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    const checkTabs = () => {
      chrome.tabs.query({}, (tabs) => {
        let foundTab = null;
        let foundProvider = null;
        
        for (const tab of tabs) {
          if (!tab.url) continue;
          const provider = AI_PROVIDERS.find(p => tab.url.startsWith(p.url));
          if (provider) {
             foundTab = tab;
             foundProvider = provider;
             if (tab.active) break;
          }
        }
        
        if (foundProvider) {
          setActiveAI({ tab: foundTab, provider: foundProvider });
        } else {
          setActiveAI(null);
        }
      });
    };

    checkTabs();

    chrome.tabs.onUpdated.addListener(checkTabs);
    chrome.tabs.onActivated.addListener(checkTabs);
    chrome.tabs.onRemoved.addListener(checkTabs);

    const interval = setInterval(checkTabs, 3000);

    return () => {
      chrome.tabs.onUpdated.removeListener(checkTabs);
      chrome.tabs.onActivated.removeListener(checkTabs);
      chrome.tabs.onRemoved.removeListener(checkTabs);
      clearInterval(interval);
    };
  }, []);

  const handleCopyAndGo = (provider, tabId) => {
    if (!markdownOutput) return;
    
    navigator.clipboard.writeText(markdownOutput).then(() => {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
      
      const injectPasteScript = (targetTabId) => {
        chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          args: [markdownOutput, provider.id],
          func: (text, providerId) => {
            const doPaste = () => {
              const tryPaste = () => {
                let input = null;
                if (providerId === 'chatgpt') input = document.querySelector('#prompt-textarea');
                else if (providerId === 'claude') input = document.querySelector('[data-testid="chat-input"], .ProseMirror');
                else if (providerId === 'deepseek') input = document.querySelector('#chat-input, textarea[name="search"], textarea.ds-textarea');
                else if (providerId === 'gemini') input = document.querySelector('.ql-editor, rich-textarea, [data-placeholder="Ask Gemini"]');
                
                if (!input) input = document.querySelector('textarea, [contenteditable="true"]');

                if (input) {
                  // Ensure it's not disabled by the SPA loading state
                  if (input.disabled || input.readOnly || input.getAttribute('aria-disabled') === 'true' || input.getAttribute('contenteditable') === 'false') {
                    return false; 
                  }

                  input.focus();
                  input.click();
                  
                  const prevText = input.textContent + (input.value || '');

                  if (input.tagName === 'TEXTAREA') {
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                    if (nativeSetter) nativeSetter.call(input, input.value ? input.value + '\n' + text : text);
                    else input.value = input.value ? input.value + '\n' + text : text;
                  } else {
                    const dt = new DataTransfer();
                    dt.setData('text/plain', text);
                    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
                    
                    if (input.textContent === prevText) {
                       document.execCommand('insertText', false, text);
                    }
                    
                    if (input.textContent === prevText) {
                      // Final fallback: innerHTML mutation
                      // Note: For ProseMirror, placing it inside a <p> usually forces the update
                      input.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
                    }
                  }

                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  
                  // For React 16+ on textareas
                  if (input._valueTracker) input._valueTracker.setValue(prevText);

                  const newText = input.textContent + (input.value || '');
                  return newText !== prevText && newText.length > prevText.length;
                }
                return false;
              };

              if (!tryPaste()) {
                let attempts = 0;
                // Poll aggressively every 100ms for up to 20 seconds (200 attempts)
                const interval = setInterval(() => {
                  if (tryPaste() || ++attempts > 200) clearInterval(interval);
                }, 100);
              }
            };

            if (document.readyState === 'complete' || document.readyState === 'interactive') {
              doPaste();
            } else {
              window.addEventListener('DOMContentLoaded', doPaste);
              window.addEventListener('load', doPaste);
            }
          }
        }).catch(err => console.log('Paste error:', err));
      };

      if (tabId) {
        chrome.tabs.update(tabId, { active: true }, (tab) => {
          if (tab && tab.windowId) {
            chrome.windows.update(tab.windowId, { focused: true });
          }
          injectPasteScript(tabId);
        });
      } else {
        chrome.tabs.create({ url: provider.url }, (tab) => {
          chrome.tabs.onUpdated.addListener(function listener(tId, info) {
            if (tId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              injectPasteScript(tab.id);
            }
          });
        });
      }
      setDropdownOpen(false);
    });
  };

  const renderIcon = (p, size=18) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '4px' }}>
        <img src={p.icon} alt={p.name} width={size} height={size} style={{ filter: p.filterInDark ? 'var(--icon-filter, none)' : 'none' }} />
      </div>
    );
  };

  if (!markdownOutput) return null;

  return (
    <div style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 50, display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: 'row-reverse' }}>
      
      <div style={{ position: 'relative' }}>
        <button 
          className="action-button glass-card icon-only"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: '0', borderRadius: '50%', border: '1px solid var(--border-glass)', background: 'var(--bg-card)' }}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title="Select AI Provider"
        >
          <img src={copyToAiUrl} alt="Copy to AI" width="20" height="20" style={{ filter: 'var(--icon-filter, none)' }} />
        </button>
        
        {dropdownOpen && (
          <div className="dropdown-menu glass-card" style={{ bottom: 'calc(100% + 8px)', top: 'auto', right: 0, left: 'auto', minWidth: '150px' }}>
            {AI_PROVIDERS.map(p => (
              <button 
                key={p.id} 
                onClick={() => handleCopyAndGo(p, null)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px' }}
              >
                {renderIcon(p, 16)}
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeAI && (
        <div style={{ position: 'relative' }}>
          <div 
            style={{ 
              position: 'absolute', inset: -4, borderRadius: '50%', 
              background: activeAI.provider.color, opacity: 0.4, 
              filter: 'blur(8px)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
            }} 
          />
          <button 
            className="action-button glass-card icon-only"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: '0', borderRadius: '50%', border: `1px solid ${activeAI.provider.color}40`, background: 'var(--bg-card)' }}
            onClick={() => handleCopyAndGo(activeAI.provider, activeAI.tab?.id)}
            title={`Paste into ${activeAI.provider.name}`}
          >
            {renderIcon(activeAI.provider, 22)}
          </button>
        </div>
      )}

      {justCopied && (
        <div className="glass-card" style={{ padding: '8px 16px', background: 'var(--bg-button)', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', fontWeight: 500, animation: 'fadeIn 0.2s ease-out', display: 'flex', alignItems: 'center' }}>
          Ready to Paste!
        </div>
      )}
    </div>
  );
}
