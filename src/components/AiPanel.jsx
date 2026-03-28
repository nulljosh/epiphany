import { useState, useRef, useEffect } from 'react';
import { useAi } from '../hooks/useAi';

const QUICK_ACTIONS = [
  'What\'s happening in markets today?',
  'Analyze my portfolio',
  'Any news I should know about?',
  'What\'s my financial situation?',
];

export default function AiPanel({ open, onClose }) {
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearConversation } = useAi();
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleQuickAction = (text) => {
    sendMessage(text);
  };

  if (!open) return null;

  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={e => e.stopPropagation()}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <span className="ai-panel-icon">M</span>
            Monica AI
          </div>
          <div className="ai-panel-actions">
            {messages.length > 0 && (
              <button className="ai-btn-ghost" onClick={clearConversation} title="Clear conversation">
                Clear
              </button>
            )}
            <button className="ai-btn-ghost" onClick={onClose}>
              &times;
            </button>
          </div>
        </div>

        <div className="ai-panel-messages" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="ai-empty-state">
              <div className="ai-empty-title">Ask Monica anything</div>
              <div className="ai-empty-subtitle">
                Portfolio analysis, market insights, news briefings, and more.
              </div>
              <div className="ai-quick-actions">
                {QUICK_ACTIONS.map((text) => (
                  <button key={text} className="ai-quick-chip" onClick={() => handleQuickAction(text)}>
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`ai-message ai-message-${msg.role}`}>
                {msg.role === 'assistant' && msg.tools?.length > 0 && (
                  <div className="ai-tool-indicator">
                    {msg.tools.map((t, j) => (
                      <span key={j} className="ai-tool-badge">{formatToolName(t)}</span>
                    ))}
                  </div>
                )}
                <div className="ai-message-content">
                  {msg.content || (msg.role === 'assistant' && isStreaming && i === messages.length - 1 ? (
                    <span className="ai-typing">Thinking...</span>
                  ) : null)}
                </div>
              </div>
            ))
          )}
          {error && <div className="ai-error">{error}</div>}
        </div>

        <form className="ai-input-bar" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="ai-input"
            placeholder="Ask Monica..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button type="button" className="ai-send-btn" onClick={stopStreaming}>Stop</button>
          ) : (
            <button type="submit" className="ai-send-btn" disabled={!input.trim()}>Send</button>
          )}
        </form>
      </div>
    </div>
  );
}

function formatToolName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
