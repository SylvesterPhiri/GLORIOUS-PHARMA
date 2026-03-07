// app/ai/page.tsx  — drop in at app/ai/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DataSnapshot {
  totalRevenue:    number;
  monthRevenue:    number;
  pendingValue:    number;
  overdueValue:    number;
  netProfit:       number;
  lowStockCount:   number;
  expiryRiskCount: number;
  topProducts:     { name: string; unitsSold: number; revenue: number; recentUnits: number }[];
  clientStats:     { name: string; type: string; totalPaid: number; totalUnpaid: number; overdueCount: number; creditUtilization: number }[];
  lowStock:        { name: string; currentStock: number; reorderLevel: number }[];
  expiryRisk:      { name: string; daysLeft: number; currentStock: number; stockValue: number }[];
  inactiveClients: { name: string; type: string }[];
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  time: string;
}

type ActiveTab = 'insights' | 'inventory' | 'clients' | 'financial' | 'chat';

// ── API helper ────────────────────────────────────────────────────────────────
async function callAI(type: string, query?: string) {
  const res = await fetch('/api/ai', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, query }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'AI request failed');
  }
  return res.json();
}

// ── Formatting ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `ZMW ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const now  = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ── AI Response renderer ──────────────────────────────────────────────────────
function AIResponse({ text }: { text: string }) {
  // Split into paragraphs/numbered items for readability
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div className="space-y-2 text-gray-700 text-sm leading-relaxed">
      {lines.map((line, i) => (
        <p key={i} className={line.match(/^\d+\./) ? 'pl-2 border-l-2 border-blue-200' : ''}>
          {line}
        </p>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AIDashboard() {
  const [activeTab, setActiveTab]       = useState<ActiveTab>('insights');
  const [loading, setLoading]           = useState(false);
  const [response, setResponse]         = useState('');
  const [snapshot, setSnapshot]         = useState<DataSnapshot | null>(null);
  const [error, setError]               = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: 'Hello! I have access to your live business data. Ask me anything — about your stock, clients, revenue, invoices, or anything else about Glorious Pharma.', time: now() },
  ]);
  const [chatInput, setChatInput]       = useState('');
  const [chatLoading, setChatLoading]   = useState(false);
  const chatEndRef                      = useRef<HTMLDivElement>(null);

  const TABS: { id: ActiveTab; label: string; icon: string; desc: string }[] = [
    { id: 'insights',   label: 'Business Insights', icon: '🧠', desc: 'Overall AI analysis'    },
    { id: 'inventory',  label: 'Inventory',          icon: '📦', desc: 'Stock & expiry risks'   },
    { id: 'clients',    label: 'Clients',            icon: '👥', desc: 'Risk & opportunities'   },
    { id: 'financial',  label: 'Financial',          icon: '💰', desc: 'Revenue & profit health' },
    { id: 'chat',       label: 'Ask AI',             icon: '💬', desc: 'Natural language queries' },
  ];

  // Auto-load insights on mount
  useEffect(() => { runAnalysis('insights'); }, []);

  // Scroll chat to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const runAnalysis = async (type: ActiveTab) => {
    if (type === 'chat') return;
    setLoading(true);
    setError('');
    setResponse('');
    try {
      const data = await callAI(type);
      setResponse(data.response);
      if (data.dataSnapshot) setSnapshot(data.dataSnapshot);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab !== 'chat') runAnalysis(tab);
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setChatMessages(m => [...m, { role: 'user', content: q, time: now() }]);
    setChatLoading(true);
    try {
      const data = await callAI('chat', q);
      setChatMessages(m => [...m, { role: 'ai', content: data.response, time: now() }]);
      if (data.dataSnapshot && !snapshot) setSnapshot(data.dataSnapshot);
    } catch (e: any) {
      setChatMessages(m => [...m, { role: 'ai', content: `Sorry, I encountered an error: ${e.message}`, time: now() }]);
    } finally {
      setChatLoading(false);
    }
  };

  const QUICK_QUESTIONS = [
    'Which products are running low on stock?',
    'Who are my highest risk clients?',
    'What is my profit margin this month?',
    'Which products are expiring soon?',
    'Which clients haven\'t ordered recently?',
    'What is my total outstanding debt?',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg">🧠</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Business Intelligence</h1>
              <p className="text-xs text-gray-500">Powered by Claude · Live data from your database</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-700">Live Data</span>
            </div>
            <Link href="/" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors">
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* ── KPI Strip (from real snapshot data) ── */}
        {snapshot && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Monthly Revenue', value: fmt(snapshot.monthRevenue),    color: 'bg-blue-50 border-blue-200 text-blue-700'    },
              { label: 'Net Profit',      value: fmt(snapshot.netProfit),        color: 'bg-green-50 border-green-200 text-green-700'  },
              { label: 'Pending',         value: fmt(snapshot.pendingValue),     color: 'bg-yellow-50 border-yellow-200 text-yellow-700'},
              { label: 'Overdue',         value: fmt(snapshot.overdueValue),     color: 'bg-red-50 border-red-200 text-red-700'        },
              { label: 'Low Stock',       value: `${snapshot.lowStockCount} products`, color: snapshot.lowStockCount > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-600' },
              { label: 'Expiring Soon',   value: `${snapshot.expiryRiskCount} products`, color: snapshot.expiryRiskCount > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600' },
              { label: 'Inactive Clients',value: `${snapshot.inactiveClients.length}`, color: snapshot.inactiveClients.length > 0 ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-600' },
            ].map(k => (
              <div key={k.label} className={`border rounded-xl p-3 ${k.color}`}>
                <p className="text-xs font-medium opacity-75">{k.label}</p>
                <p className="text-sm font-bold mt-0.5 leading-tight">{k.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Left sidebar: tabs + quick data ── */}
          <div className="space-y-4">
            {/* Tab buttons */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-gray-50 last:border-0 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${activeTab === tab.id ? 'text-white' : 'text-gray-800'}`}>{tab.label}</p>
                    <p className={`text-xs ${activeTab === tab.id ? 'text-blue-200' : 'text-gray-400'}`}>{tab.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick data panels */}
            {snapshot && (
              <>
                {/* Top products */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Products</h3>
                  <div className="space-y-2">
                    {snapshot.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                          <span className="text-xs text-gray-700 truncate">{p.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900 ml-1 flex-shrink-0">{p.unitsSold}u</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Low stock alerts */}
                {snapshot.lowStock.length > 0 && (
                  <div className="bg-orange-50 rounded-2xl border border-orange-200 p-4">
                    <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">⚠ Low Stock</h3>
                    <div className="space-y-2">
                      {snapshot.lowStock.map((p, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-xs text-orange-800 truncate">{p.name}</span>
                          <span className="text-xs font-bold text-orange-700 ml-1">{p.currentStock} left</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expiry risk */}
                {snapshot.expiryRisk.length > 0 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
                    <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-3">🚨 Expiry Risk</h3>
                    <div className="space-y-2">
                      {snapshot.expiryRisk.map((p, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-xs text-red-800 truncate">{p.name}</span>
                          <span className={`text-xs font-bold ml-1 ${p.daysLeft <= 30 ? 'text-red-700' : 'text-orange-600'}`}>{p.daysLeft}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Main content area ── */}
          <div className="lg:col-span-3">

            {/* Analysis tabs */}
            {activeTab !== 'chat' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{TABS.find(t => t.id === activeTab)?.icon}</span>
                    <h2 className="font-semibold text-gray-900">{TABS.find(t => t.id === activeTab)?.label}</h2>
                  </div>
                  <button
                    onClick={() => runAnalysis(activeTab)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {loading ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Analysing...</>
                    ) : (
                      <><span>↻</span> Refresh</>
                    )}
                  </button>
                </div>

                <div className="p-6">
                  {loading && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                      <div className="text-center">
                        <p className="text-gray-700 font-medium">Analysing your live data...</p>
                        <p className="text-gray-400 text-sm mt-1">Claude is reading your database and generating insights</p>
                      </div>
                    </div>
                  )}

                  {error && !loading && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-700 font-medium text-sm">⚠ Error</p>
                      <p className="text-red-600 text-sm mt-1">{error}</p>
                      {error.includes('ANTHROPIC_API_KEY') && (
                        <p className="text-red-500 text-xs mt-2">Add <code className="bg-red-100 px-1 rounded">ANTHROPIC_API_KEY=your_key</code> to your <code className="bg-red-100 px-1 rounded">.env</code> file and restart the server.</p>
                      )}
                    </div>
                  )}

                  {response && !loading && !error && (
                    <div className="space-y-4">
                      {/* AI response text */}
                      <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">🧠</div>
                          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Claude's Analysis</span>
                        </div>
                        <AIResponse text={response} />
                      </div>

                      {/* Supporting data tables */}
                      {activeTab === 'clients' && snapshot && (
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                              <tr>{['Client','Type','Total Paid','Outstanding','Overdue','Credit Used'].map(h => (
                                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                              ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {snapshot.clientStats.map((c, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{c.name}</td>
                                  <td className="px-4 py-2"><span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{c.type}</span></td>
                                  <td className="px-4 py-2 text-sm text-green-700 font-medium">ZMW {c.totalPaid.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-sm text-yellow-700">ZMW {c.totalUnpaid.toFixed(2)}</td>
                                  <td className="px-4 py-2">
                                    {c.overdueCount > 0
                                      ? <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">{c.overdueCount} overdue</span>
                                      : <span className="text-gray-400 text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 rounded-full bg-gray-200">
                                        <div className={`h-1.5 rounded-full ${c.creditUtilization > 80 ? 'bg-red-500' : c.creditUtilization > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(c.creditUtilization, 100)}%` }} />
                                      </div>
                                      <span className="text-xs text-gray-600">{c.creditUtilization}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {activeTab === 'inventory' && snapshot && snapshot.expiryRisk.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                              <tr>{['Product','Days to Expiry','Stock','Value at Risk','Risk'].map(h => (
                                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                              ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {snapshot.expiryRisk.map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.name}</td>
                                  <td className="px-4 py-2 text-sm font-bold" style={{ color: p.daysLeft <= 30 ? '#dc2626' : p.daysLeft <= 90 ? '#d97706' : '#16a34a' }}>{p.daysLeft} days</td>
                                  <td className="px-4 py-2 text-sm text-gray-600">{p.currentStock} units</td>
                                  <td className="px-4 py-2 text-sm text-red-700">ZMW {p.stockValue.toFixed(2)}</td>
                                  <td className="px-4 py-2">
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${p.daysLeft <= 30 ? 'bg-red-100 text-red-700' : p.daysLeft <= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                      {p.daysLeft <= 30 ? 'High' : p.daysLeft <= 90 ? 'Medium' : 'Low'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Chat tab ── */}
            {activeTab === 'chat' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ height: '70vh' }}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💬</span>
                    <h2 className="font-semibold text-gray-900">Ask AI</h2>
                  </div>
                  <span className="text-xs text-gray-400">Ask anything about your business in plain English</span>
                </div>

                {/* Quick questions */}
                <div className="px-6 py-3 border-b border-gray-50 flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setChatInput(q); }}
                      className="px-3 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full transition-colors border border-blue-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'ai' && (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm mr-2 flex-shrink-0 mt-0.5">🧠</div>
                      )}
                      <div className={`max-w-lg rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-100'}`}>
                        {msg.role === 'ai' ? <AIResponse text={msg.content} /> : <p className="text-sm">{msg.content}</p>}
                        <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>{msg.time}</p>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm mr-2 flex-shrink-0">🧠</div>
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="px-6 py-4 border-t border-gray-100">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                      placeholder="e.g. Which products are running low? What is my profit this month?"
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={chatLoading}
                    />
                    <button
                      onClick={sendChat}
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
