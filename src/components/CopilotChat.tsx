'use client';
import { useState, useRef, useEffect } from 'react';
import type { PlotSettings } from '@/types';
import { parseChatEditWithGemini } from '@/lib/layoutSolver';

interface Message {
  sender: 'user' | 'copilot';
  text: string;
}

interface Props {
  settings: PlotSettings;
  onUpdateSettings: (s: PlotSettings) => void;
  geminiKey: string;
}

const PRESETS = [
  'Make it a 3 BHK',
  'Change style to contemporary',
  'Change budget to 80 lakhs',
  'Set plot to 40×50 ft',
];

export default function CopilotChat({ settings, onUpdateSettings, geminiKey }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'copilot', text: "Hi! I'm your AI Copilot. Tell me any change — e.g. \"Make it 3 BHK\", \"Change to luxury style\", \"Add a balcony\" — and I'll update your plans instantly." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    setMessages(p => [...p, { sender: 'user', text: msg }]);
    setLoading(true);

    try {
      if (!geminiKey) {
        setMessages(p => [...p, { sender: 'copilot', text: 'Please add your Gemini API key in Settings to use AI chat.' }]);
        return;
      }
      const res = await parseChatEditWithGemini(msg, settings, geminiKey);
      onUpdateSettings(res.updatedSettings);
      setMessages(p => [...p, { sender: 'copilot', text: res.message }]);
    } catch {
      setMessages(p => [...p, { sender: 'copilot', text: 'Error connecting to AI. Check your Gemini key.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          backgroundColor: 'var(--blueprint)', color: 'white',
          border: 'none', borderRadius: 100, padding: '12px 20px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(26,39,68,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-body)',
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span> Ask Copilot
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 50,
      width: 320, height: 440, borderRadius: 12,
      border: '1px solid var(--line)',
      backgroundColor: 'white',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 40px rgba(26,39,68,0.18)',
      overflow: 'hidden',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--blueprint)', color: 'white',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
          <span>✦</span> AI Copilot Chat
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            maxWidth: '85%',
            padding: '8px 12px',
            borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
            backgroundColor: m.sender === 'user' ? 'var(--blueprint)' : 'var(--paper-dark)',
            color: m.sender === 'user' ? 'white' : 'var(--ink)',
            fontSize: 12, lineHeight: 1.6,
            alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
            border: m.sender === 'copilot' ? '1px solid var(--line)' : 'none',
          }}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{
            fontSize: 11, color: 'var(--steel)', alignSelf: 'flex-start',
            padding: '8px 12px', backgroundColor: 'var(--paper-dark)',
            border: '1px solid var(--line)', borderRadius: '12px 12px 12px 2px',
          }}>
            Drafting changes...
          </div>
        )}
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => send(p)} style={{
                fontSize: 10, padding: '4px 8px',
                border: '1px solid var(--line)',
                borderRadius: 100, cursor: 'pointer',
                backgroundColor: 'white', color: 'var(--steel)',
                fontFamily: 'var(--font-body)',
              }}>{p}</button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
          placeholder={geminiKey ? "Type a change request..." : "Add Gemini key in Settings..."}
          style={{
            flex: 1, padding: '7px 10px',
            border: '1.5px solid var(--line-strong)',
            borderRadius: 6, fontSize: 12,
            fontFamily: 'var(--font-body)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            padding: '7px 12px', borderRadius: 6, border: 'none',
            backgroundColor: 'var(--blueprint)', color: 'white',
            fontSize: 13, cursor: loading ? 'default' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >→</button>
      </div>
    </div>
  );
}
