'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ModelOption {
  id: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-mini');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let sid = localStorage.getItem('chat_session_id');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('chat_session_id', sid);
    }
    setSessionId(sid);

    fetch(`/api/chat/history?sessionId=${encodeURIComponent(sid)}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));

    fetch('/api/models')
      .then(res => res.ok ? res.json() : { data: [] })
      .then(data => {
        if (data.data) setModels(data.data);
      })
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveHistory = useCallback(async (msgs: Message[]) => {
    if (sessionId && msgs.length > 0) {
      try {
        await fetch('/api/chat/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, messages: msgs }),
        });
      } catch (err) {
        console.error("Failed to save history:", err);
      }
    }
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: uuidv4(), role: 'user', content: input };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setIsStreaming(true);

    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `API Error: ${response.status}`);
      }

      if (!response.body) throw new Error('No body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let partialLine = '';
      const assistantMessageId = uuidv4();

      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialLine + chunk).split('\n');
        partialLine = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.choices?.[0]?.delta?.content) {
                assistantMessage += data.choices[0].delta.content;
                setMessages(prev => {
                  const updated = [...prev];
                  const idx = updated.findIndex(m => m.id === assistantMessageId);
                  if (idx !== -1) {
                    updated[idx] = { ...updated[idx], content: assistantMessage };
                  }
                  return updated;
                });
              } else if (data.error) {
                assistantMessage += `\nError: ${data.error}`;
                setMessages(prev => {
                  const updated = [...prev];
                  const idx = updated.findIndex(m => m.id === assistantMessageId);
                  if (idx !== -1) {
                    updated[idx] = { ...updated[idx], content: assistantMessage };
                  }
                  return updated;
                });
              }
            } catch (e) {
              console.error("Error parsing SSE chunk:", e, dataStr);
            }
          }
        }
      }

      const finalAssistantMessage: Message = { id: assistantMessageId, role: 'assistant', content: assistantMessage };
      await saveHistory([...newMessages, finalAssistantMessage]);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const errorMessage: Message = { id: uuidv4(), role: 'assistant', content: `Error: ${message}` };
      const errorMessages: Message[] = [...newMessages, errorMessage];
      setMessages(errorMessages);
      await saveHistory(errorMessages);
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Airforce Proxy Chat</h1>
        <div className="flex gap-4">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="p-2 border rounded"
          >
            {models.length > 0 ? (
              models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)
            ) : (
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            )}
          </select>
          <Link href="/admin/analytics" className="text-blue-500 p-2">Admin</Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-white border-t">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            className="flex-1 p-2 border rounded"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </footer>
    </div>
  );
}
