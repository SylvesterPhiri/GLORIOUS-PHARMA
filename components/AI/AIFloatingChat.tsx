
'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'ai';
  content: string;
  time: string;
}

interface DataSnapshot {
  totalRevenue:    number;
  monthRevenue:    number;
  pendingValue:    number;
  overdueValue:    number;
  netProfit:       number;
  lowStockCount:   number;
  expiryRiskCount: number;
  topProducts:     { name: string; unitsSold: number; revenue: number }[];
  clientStats:     { name: string; totalPaid: number; totalUnpaid: number; overdueCount: number }[];
  lowStock:        { name: string; currentStock: number; reorderLevel: number }[];
  expiryRisk:      { name: string; daysLeft: number; currentStock: number; stockValue: number }[];
  inactiveClients: { name: string }[];
}

const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmt = (n: number) => `ZMW ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const QUICK_QUESTIONS = [
  'What needs my attention today?',
  'Which products are low on stock?',
  'Which clients have overdue invoices?',
  'What is my profit this month?',
  'Which products are expiring soon?',
  'Who are my top clients?',
];

function AIText({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => (
        <p key={i} className={
          line.match(/^\d+\./) ? 'pl-3 border-l-2 border-blue-300 text-gray-700' :
          line.match(/^[-•]/)  ? 'pl-2 text-gray-700' :
          'text-gray-700'
        }>
          {line}
        </p>
      ))}
    </div>
  );
}

export default function AIFloatingChat() {
  const [open,        setOpen]        = useState(false);
  const [tab,         setTab]         = useState<'chat' | 'insights'>('chat');
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [snapshot,    setSnapshot]    = useState<DataSnapshot | null>(null);
  const [insight,     setInsight]     = useState('');
  const [insightLoad, setInsightLoad] = useState(false);
  const [unread,      setUnread]      = useState(0);
  const [initialized, setInitialized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUnread(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && !initialized) {
      setInitialized(true);
      setMessages([{
        role: 'ai',
        content: 'Hi! I have live access to your Glorious Pharma data. Ask me anything about your stock, clients, invoices, or revenue.',
        time: now(),
      }]);
      loadSnapshot();
    }
  }, [open, initialized]);

  const loadSnapshot = async () => {
    try {
      const res  = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'chat', query: 'Give me a one-sentence business status summary.' }),
      });
      const data = await res.json();
      if (data.dataSnapshot) setSnapshot(data.dataSnapshot);
    } catch (_) {}
  };

  const loadInsights = async () => {
    if (insight) return; // already loaded
    setInsightLoad(true);
    try {
      const res  = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'insights' }),
      });
      const data = await res.json();
      setInsight(data.response ?? '');
      if (data.dataSnapshot) setSnapshot(data.dataSnapshot);
    } catch (e: any) {
      setInsight('Failed to load insights. Please try again.');
    } finally {
      setInsightLoad(false);
    }
  };

  const sendMessage = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: q, time: now() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    try {
      const res  = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'chat', query: q }),
      });
      const data = await res.json();
      const reply = data.response ?? data.error ?? 'Sorry, something went wrong.';
      if (data.dataSnapshot) setSnapshot(data.dataSnapshot);
      setMessages(m => [...m, { role: 'ai', content: reply, time: now() }]);
      if (!open) setUnread(n => n + 1);
    } catch (e: any) {
      setMessages(m => [...m, { role: 'ai', content: `Error: ${e.message}`, time: now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
        title="AI Assistant"
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .23 2.7-1.158 2.7H3.956c-1.388 0-2.158-1.7-1.158-2.7L4.2 15.3" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </>
        )}
      </button>

      {}
      <div className={`fixed bottom-24 right-6 z-50 w-96 rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 origin-bottom-right ${
        open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
      }`} style={{ height: '560px', display: 'flex', flexDirection: 'column' }}>

        {}
        <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">🧠</div>
            <div>
              <p className="text-white font-semibold text-sm">Glorious Pharma AI</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-blue-200 text-xs">Live data connected</p>
              </div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {}
        <div className="flex-shrink-0 flex border-b border-gray-100">
          {(['chat', 'insights'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === 'insights') loadInsights(); }}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === t
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'chat' ? '💬 Chat' : '🧠 Insights'}
            </button>
          ))}
        </div>

        {}
        {tab === 'chat' && (
          <>
            {}
            {snapshot && (
              <div className="flex-shrink-0 grid grid-cols-3 gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100">
                {[
                  { label: 'This Month',  value: fmt(snapshot.monthRevenue),  color: 'text-blue-700'   },
                  { label: 'Pending',     value: fmt(snapshot.pendingValue),  color: 'text-yellow-700' },
                  { label: 'Overdue',     value: fmt(snapshot.overdueValue),  color: 'text-red-700'    },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-lg p-1.5 text-center border border-gray-100">
                    <p className={`text-xs font-bold truncate ${k.color}`}>{k.value}</p>
                    <p className="text-gray-400" style={{ fontSize: '9px' }}>{k.label}</p>
                  </div>
                ))}
              </div>
            )}

            {}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>🧠</div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2.5 ${
                    msg.role === 'user'
                      ? 'text-white rounded-tr-sm'
                      : 'bg-gray-50 border border-gray-100 rounded-tl-sm'
                  }`} style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #2563eb, #4f46e5)' } : {}}>
                    {msg.role === 'ai'
                      ? <AIText text={msg.content} />
                      : <p className="text-sm">{msg.content}</p>
                    }
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200 text-right' : 'text-gray-400'}`}>{msg.time}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>🧠</div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {}
            <div className="flex-shrink-0 px-3 py-2 border-t border-gray-100">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    disabled={loading}
                    className="flex-shrink-0 px-2.5 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full border border-blue-100 transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {}
            <div className="flex-shrink-0 px-3 pb-3 pt-1">
              <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask anything about your business..."
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:opacity-80 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {}
        {tab === 'insights' && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {insightLoad && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                <p className="text-gray-500 text-sm text-center">Analysing your live business data...</p>
              </div>
            )}

            {!insightLoad && !insight && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="text-4xl">🧠</div>
                <p className="text-gray-500 text-sm text-center">Click below to generate AI insights from your live data</p>
                <button
                  onClick={loadInsights}
                  className="px-5 py-2.5 text-white text-sm font-medium rounded-xl transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
                >
                  Generate Insights
                </button>
              </div>
            )}

            {!insightLoad && insight && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Business Analysis</p>
                  <button
                    onClick={() => { setInsight(''); loadInsights(); }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    ↻ Refresh
                  </button>
                </div>

                {}
                {snapshot && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Monthly Revenue', value: fmt(snapshot.monthRevenue),          bg: 'bg-blue-50',   text: 'text-blue-700'   },
                      { label: 'Net Profit',       value: fmt(snapshot.netProfit),             bg: 'bg-green-50',  text: 'text-green-700'  },
                      { label: 'Overdue',          value: fmt(snapshot.overdueValue),          bg: 'bg-red-50',    text: 'text-red-700'    },
                      { label: 'Low Stock Items',  value: `${snapshot.lowStockCount} products`, bg: 'bg-orange-50', text: 'text-orange-700' },
                    ].map(k => (
                      <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
                        <p className={`text-sm font-bold ${k.text}`}>{k.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                  <AIText text={insight} />
                </div>

                {}
                {snapshot && snapshot.lowStock.length > 0 && (
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                    <p className="text-xs font-semibold text-orange-700 mb-2">⚠ Low Stock</p>
                    {snapshot.lowStock.slice(0, 4).map((p, i) => (
                      <div key={i} className="flex justify-between text-xs py-0.5">
                        <span className="text-orange-800">{p.name}</span>
                        <span className="font-bold text-orange-700">{p.currentStock} left</span>
                      </div>
                    ))}
                  </div>
                )}

                {}
                {snapshot && snapshot.expiryRisk.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                    <p className="text-xs font-semibold text-red-700 mb-2">🚨 Expiring Soon</p>
                    {snapshot.expiryRisk.slice(0, 4).map((p, i) => (
                      <div key={i} className="flex justify-between text-xs py-0.5">
                        <span className="text-red-800">{p.name}</span>
                        <span className="font-bold text-red-700">{p.daysLeft}d left</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
