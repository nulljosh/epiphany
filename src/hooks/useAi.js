import { useState, useCallback, useRef } from 'react';

const CONV_KEY = 'monica_ai_conv';

export function useAi() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const convIdRef = useRef(localStorage.getItem(CONV_KEY) || null);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantMsg = { role: 'assistant', content: '', ts: Date.now(), tools: [] };
    setMessages(prev => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, conversationId: convIdRef.current }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6);
          try {
            const event = JSON.parse(json);
            if (event.type === 'text') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + event.text };
                }
                return updated;
              });
            } else if (event.type === 'tool_start') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, tools: [...(last.tools || []), event.name] };
                }
                return updated;
              });
            } else if (event.type === 'done') {
              convIdRef.current = event.conversationId;
              localStorage.setItem(CONV_KEY, event.conversationId);
            } else if (event.type === 'error') {
              setError(event.message);
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setMessages(prev => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1]?.content) {
            updated.pop();
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    convIdRef.current = null;
    localStorage.removeItem(CONV_KEY);
    setError(null);
  }, []);

  return { messages, isStreaming, error, sendMessage, stopStreaming, clearConversation };
}
