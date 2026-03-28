'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Invoice {
  id: string; invoiceNumber: string; invoiceDate: string; total: number;
  status: string; isHistorical: boolean;
  client: { name: string };
  items: Array<{ quantity: number; totalPrice: number; unitPrice: number; productId: string | null; product: { name: string } | null; productSnapshot?: string }>;
}

interface Product {
  id: string; name: string; currentStock: number; minStock: number;
  price: number; expiryDate: string; category: string | null;
}

interface AnalysisStats {
  totalRevenue: number; totalProducts: number; totalClients: number;
  totalInvoices: number; paidInvoices: number; pendingInvoices: number;
}

// ── Free Sample types ──────────────────────────────────────────────────────────
interface FreeSampleItem {
  id?: string; productId: string; quantity: number;
  product?: { id: string; name: string; currentStock: number };
}
interface FreeSampleRecord {
  id: string; date: string; notes: string | null; createdAt: string;
  items: FreeSampleItem[];
}

type Tab = 'sales' | 'inventory' | 'products' | 'clients' | 'reports' | 'freesamples';

const EMPTY_FS_ITEM = (): FreeSampleItem => ({ productId: '', quantity: 1 });

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [stats,     setStats]     = useState<AnalysisStats | null>(null);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  // ── Free samples state ───────────────────────────────────────────────────────
  const [fsRecords,    setFsRecords]    = useState<FreeSampleRecord[]>([]);
  const [fsLoading,    setFsLoading]    = useState(false);
  const [fsError,      setFsError]      = useState('');
  const [fsSuccess,    setFsSuccess]    = useState('');
  const [showFsForm,   setShowFsForm]   = useState(false);
  const [editingFs,    setEditingFs]    = useState<FreeSampleRecord | null>(null);
  const [viewingFs,    setViewingFs]    = useState<FreeSampleRecord | null>(null);
  const [deletingFsId, setDeletingFsId] = useState<string | null>(null);

  const [fsForm, setFsForm] = useState({
    date:  new Date().toISOString().split('T')[0],
    notes: '',
    items: [EMPTY_FS_ITEM()],
  });

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (activeTab === 'freesamples') fetchFsRecords(); }, [activeTab]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [invRes, cliRes, prodRes] = await Promise.allSettled([
        fetch('/api/invoices?limit=1000'),
        fetch('/api/clients'),
        fetch('/api/products?limit=1000'),
      ]);
      const invData  = invRes.status  === 'fulfilled' && invRes.value.ok  ? await invRes.value.json()  : { invoices: [] };
      const cliData  = cliRes.status  === 'fulfilled' && cliRes.value.ok  ? await cliRes.value.json()  : [];
      const prodData = prodRes.status === 'fulfilled' && prodRes.value.ok ? await prodRes.value.json() : { products: [] };

      const allInv:  Invoice[] = invData.invoices  ?? [];
      const allProd: Product[] = prodData.products ?? prodData ?? [];
      const clients            = Array.isArray(cliData) ? cliData : (cliData.clients ?? []);
      const live = allInv.filter((i) => !i.isHistorical);

      setInvoices(allInv);
      setProducts(allProd);
      setStats({
        totalRevenue:    live.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0),
        totalProducts:   allProd.length,
        totalClients:    clients.length,
        totalInvoices:   live.length,
        paidInvoices:    live.filter((i) => i.status === 'PAID').length,
        pendingInvoices: live.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE').length,
      });
    } catch (err) {
      console.error('Analysis fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFsRecords = async () => {
    setFsLoading(true);
    try {
      const res  = await fetch('/api/free-samples');
      const data = await res.json();
      setFsRecords(data.records ?? []);
    } catch { setFsError('Failed to load free sample records'); }
    finally  { setFsLoading(false); }
  };

  // ── Free sample form helpers ─────────────────────────────────────────────────
  const openCreateFs = () => {
    setEditingFs(null);
    setFsForm({ date: new Date().toISOString().split('T')[0], notes: '', items: [EMPTY_FS_ITEM()] });
    setFsError(''); setFsSuccess('');
    setShowFsForm(true);
  };

  const openEditFs = (record: FreeSampleRecord) => {
    setEditingFs(record);
    setFsForm({
      date:  record.date.split('T')[0],
      notes: record.notes ?? '',
      items: record.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
    setFsError(''); setFsSuccess('');
    setShowFsForm(true);
    setViewingFs(null);
  };

  const addFsItem    = () => setFsForm((f) => ({ ...f, items: [...f.items, EMPTY_FS_ITEM()] }));
  const removeFsItem = (i: number) => setFsForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateFsItem = (index: number, field: 'productId' | 'quantity', value: string) => {
    setFsForm((f) => {
      const items = [...f.items];
      if (field === 'quantity') items[index].quantity = parseInt(value) || 1;
      else                      items[index].productId = value;
      return { ...f, items };
    });
  };

  const submitFsForm = async () => {
    setFsError(''); setFsSuccess('');
    if (!fsForm.date) { setFsError('Date is required'); return; }
    if (fsForm.items.some((i) => !i.productId)) { setFsError('Please select a product for every row'); return; }
    if (fsForm.items.some((i) => i.quantity < 1)) { setFsError('All quantities must be at least 1'); return; }

    setFsLoading(true);
    try {
      const url    = editingFs ? `/api/free-samples/${editingFs.id}` : '/api/free-samples';
      const method = editingFs ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fsForm) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      setFsSuccess(editingFs ? 'Record updated successfully!' : 'Free sample record created!');
      setShowFsForm(false);
      setEditingFs(null);
      await fetchFsRecords();
    } catch (err: any) {
      setFsError(err.message);
    } finally {
      setFsLoading(false);
    }
  };

  const deleteFs = async (id: string) => {
    setDeletingFsId(id);
    try {
      const res = await fetch(`/api/free-samples/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setFsRecords((r) => r.filter((rec) => rec.id !== id));
      setViewingFs(null);
      setFsSuccess('Record deleted and stock restored.');
    } catch (err: any) {
      setFsError(err.message);
    } finally {
      setDeletingFsId(null);
    }
  };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const filtered = invoices.filter((inv) => {
    const d = new Date(inv.invoiceDate);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo   && d > new Date(dateTo))   return false;
    return true;
  });

  const monthlyData = (() => {
    const map: Record<string, number> = {};
    filtered.filter((i) => !i.isHistorical && i.status === 'PAID').forEach((inv) => {
      const key = new Date(inv.invoiceDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      map[key] = (map[key] ?? 0) + inv.total;
    });
    return Object.entries(map).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).slice(-6)
      .map(([month, revenue]) => ({ month, revenue }));
  })();
  const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue), 1);

  const topProducts = (() => {
    const map: Record<string, { name: string; revenue: number; qty: number }> = {};
    filtered.forEach((inv) => {
      inv.items.forEach((item) => {
        const name = item.product?.name ?? (item.productSnapshot ? (() => { try { return JSON.parse(item.productSnapshot!).name; } catch { return 'Unknown'; } })() : 'Unknown');
        if (!map[name]) map[name] = { name, revenue: 0, qty: 0 };
        map[name].revenue += item.totalPrice;
        map[name].qty     += item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();
  const maxProdRevenue = Math.max(...topProducts.map((p) => p.revenue), 1);

  const topClients = (() => {
    const map: Record<string, { name: string; spend: number; invoices: number }> = {};
    filtered.filter((i) => !i.isHistorical && i.status === 'PAID').forEach((inv) => {
      const name = inv.client?.name ?? 'Unknown';
      if (!map[name]) map[name] = { name, spend: 0, invoices: 0 };
      map[name].spend    += inv.total;
      map[name].invoices += 1;
    });
    return Object.values(map).sort((a, b) => b.spend - a.spend).slice(0, 10);
  })();
  const maxClientSpend = Math.max(...topClients.map((c) => c.spend), 1);

  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const lowStock = products.filter((p) => p.currentStock <= p.minStock);
  const expiring = products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= in30Days);
  const fmt = (n: number) => `K${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Total free samples given out (standalone only)
  const totalFsSamples = fsRecords.reduce((s, r) => s + r.items.reduce((si, i) => si + i.quantity, 0), 0);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'sales',       label: 'Sales & Revenue'  },
    { id: 'inventory',   label: 'Inventory Health' },
    { id: 'products',    label: 'Top Products'     },
    { id: 'clients',     label: 'Top Clients'      },
    { id: 'reports',     label: 'Reports'          },
    { id: 'freesamples', label: '🎁 Free Samples'  },
  ];

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Analysis & Reports</h1>
          <p className="text-gray-600 mt-1">Business intelligence across sales, stock, and clients</p>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm disabled:opacity-50">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue',     value: fmt(stats?.totalRevenue ?? 0),      color: 'border-green-500',  bg: 'bg-green-50'  },
          { label: 'Total Invoices',    value: String(stats?.totalInvoices ?? 0),   color: 'border-blue-500',   bg: 'bg-blue-50'   },
          { label: 'Total Clients',     value: String(stats?.totalClients ?? 0),    color: 'border-purple-500', bg: 'bg-purple-50' },
          { label: 'Products in Stock', value: String(stats?.totalProducts ?? 0),   color: 'border-orange-500', bg: 'bg-orange-50' },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-lg p-5 border-l-4 ${card.color}`}>
            <p className="text-sm text-gray-600">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Date range filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Date range:</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="p-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="p-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
            Clear filter
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ── Sales ─────────────────────────────────────────────────────────── */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Paid Invoices',    value: stats?.paidInvoices    ?? 0, color: 'text-green-600'  },
                  { label: 'Pending Invoices', value: stats?.pendingInvoices ?? 0, color: 'text-orange-600' },
                  { label: 'Total Invoices',   value: stats?.totalInvoices   ?? 0, color: 'text-blue-600'   },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{loading ? '—' : s.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Revenue (Last 6 Months)</h3>
                {monthlyData.length === 0 ? (
                  <div className="text-center py-12 text-gray-400"><p className="text-3xl mb-2">📊</p><p>No paid invoices found.</p></div>
                ) : (
                  <div className="space-y-3">
                    {monthlyData.map(({ month, revenue }) => (
                      <div key={month} className="flex items-center gap-4">
                        <span className="w-28 text-sm text-gray-600 text-right flex-shrink-0">{month}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${Math.max((revenue / maxRevenue) * 100, 3)}%` }}>
                            <span className="text-xs text-white font-medium whitespace-nowrap">{fmt(revenue)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Recent Invoices</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>{['Invoice #', 'Client', 'Date', 'Status', 'Total'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filtered.filter((i) => !i.isHistorical).slice(0, 20).map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-blue-600"><Link href={`/invoices/${inv.id}`}>{inv.invoiceNumber}</Link></td>
                          <td className="px-4 py-2 text-sm text-gray-700">{inv.client?.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${inv.status === 'PAID' ? 'bg-green-100 text-green-700' : inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{inv.status}</span>
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{fmt(inv.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.filter((i) => !i.isHistorical).length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No invoices in this date range.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Inventory ─────────────────────────────────────────────────────── */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Products', value: products.length,  color: 'text-blue-600'   },
                  { label: 'Low Stock',      value: lowStock.length,  color: 'text-red-600'    },
                  { label: 'Expiring Soon',  value: expiring.length,  color: 'text-orange-600' },
                  { label: 'Healthy',        value: products.filter((p) => p.currentStock > p.minStock).length, color: 'text-green-600' },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {lowStock.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">⚠ Low Stock Alert ({lowStock.length} products)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {lowStock.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div><p className="text-sm font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-500">{p.category ?? 'No category'}</p></div>
                        <div className="text-right"><p className="text-sm font-bold text-red-600">{p.currentStock} left</p><p className="text-xs text-gray-400">Min: {p.minStock}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {expiring.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-700 mb-2">⏰ Expiring Within 30 Days ({expiring.length} products)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {expiring.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                        <div><p className="text-sm font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-500">Stock: {p.currentStock}</p></div>
                        <p className="text-sm font-medium text-orange-600">{new Date(p.expiryDate).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">All Products</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>{['Product', 'Category', 'Stock', 'Min Stock', 'Expiry', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {products.map((p) => {
                        const isLow = p.currentStock <= p.minStock;
                        const isExpiring = p.expiryDate && new Date(p.expiryDate) <= in30Days;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{p.category ?? '—'}</td>
                            <td className="px-4 py-2 text-sm font-medium">{p.currentStock}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{p.minStock}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isLow ? 'bg-red-100 text-red-700' : isExpiring ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                {isLow ? 'Low Stock' : isExpiring ? 'Expiring' : 'Healthy'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {products.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No products found.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Top Products ──────────────────────────────────────────────────── */}
          {activeTab === 'products' && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
              {topProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><p className="text-3xl mb-2">📦</p><p>No product sales data in the selected period.</p></div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-4">
                      <span className="w-6 text-sm text-gray-400 font-medium text-right flex-shrink-0">{i + 1}</span>
                      <div className="w-48 flex-shrink-0"><p className="text-sm font-medium text-gray-900 truncate">{p.name}</p><p className="text-xs text-gray-400">{p.qty} units sold</p></div>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max((p.revenue / maxProdRevenue) * 100, 3)}%` }}>
                          <span className="text-xs text-white font-medium whitespace-nowrap">{fmt(p.revenue)}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{((p.revenue / Math.max(topProducts.reduce((s, x) => s + x.revenue, 0), 1)) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Top Clients ───────────────────────────────────────────────────── */}
          {activeTab === 'clients' && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Top Clients by Spend</h3>
              {topClients.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><p className="text-3xl mb-2">👥</p><p>No client spending data in the selected period.</p></div>
              ) : (
                <div className="space-y-3">
                  {topClients.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-4">
                      <span className="w-6 text-sm text-gray-400 font-medium text-right flex-shrink-0">{i + 1}</span>
                      <div className="w-48 flex-shrink-0"><p className="text-sm font-medium text-gray-900 truncate">{c.name}</p><p className="text-xs text-gray-400">{c.invoices} invoice{c.invoices !== 1 ? 's' : ''} · avg {fmt(c.spend / c.invoices)}</p></div>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max((c.spend / maxClientSpend) * 100, 3)}%` }}>
                          <span className="text-xs text-white font-medium whitespace-nowrap">{fmt(c.spend)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Reports ───────────────────────────────────────────────────────── */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-gray-900">Summary Report</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Revenue Breakdown</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Total Revenue (Paid)', value: fmt(stats?.totalRevenue ?? 0), color: 'text-green-600' },
                      { label: 'Pending Revenue',      value: fmt(filtered.filter((i) => !i.isHistorical && (i.status === 'PENDING' || i.status === 'OVERDUE')).reduce((s, i) => s + i.total, 0)), color: 'text-orange-600' },
                      { label: 'Total Invoiced',       value: fmt(filtered.filter((i) => !i.isHistorical).reduce((s, i) => s + i.total, 0)), color: 'text-blue-600' },
                    ].map((r) => (
                      <div key={r.label} className="flex justify-between items-center py-1 border-b border-gray-200 last:border-0">
                        <span className="text-sm text-gray-600">{r.label}</span>
                        <span className={`text-sm font-semibold ${r.color}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Invoice Status Breakdown</h4>
                  <div className="space-y-2">
                    {['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'].map((status) => {
                      const count = filtered.filter((i) => !i.isHistorical && i.status === status).length;
                      const pct   = stats?.totalInvoices ? ((count / stats.totalInvoices) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-24">{status}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className={`h-full rounded-full ${status === 'PAID' ? 'bg-green-500' : status === 'OVERDUE' ? 'bg-red-500' : status === 'CANCELLED' ? 'bg-gray-400' : 'bg-yellow-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Inventory Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Products',    value: products.length },
                    { label: 'Low Stock Items',   value: lowStock.length },
                    { label: 'Expiring Soon',     value: expiring.length },
                    { label: 'Total Stock Value', value: fmt(products.reduce((s, p) => s + p.currentStock * p.price, 0)) },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                💡 To export data, use your browser's print function (Ctrl+P / Cmd+P) and save as PDF.
              </div>
            </div>
          )}

          {/* ── FREE SAMPLES ──────────────────────────────────────────────────── */}
          {activeTab === 'freesamples' && (
            <div className="space-y-6">

              {/* Header + stats */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Standalone Free Sample Records</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Track free samples given to potential new customers. Stock is deducted automatically.</p>
                </div>
                <button onClick={openCreateFs}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  New Record
                </button>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
                  <p className="text-xs text-gray-500">Total Records</p>
                  <p className="text-2xl font-bold text-green-700">{fsRecords.length}</p>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                  <p className="text-xs text-gray-500">Total Units Given</p>
                  <p className="text-2xl font-bold text-blue-700">{totalFsSamples}</p>
                </div>
                <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
                  <p className="text-xs text-gray-500">Unique Products</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {new Set(fsRecords.flatMap((r) => r.items.map((i) => i.productId))).size}
                  </p>
                </div>
              </div>

              {/* Messages */}
              {fsError   && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{fsError}</div>}
              {fsSuccess && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{fsSuccess}</div>}

              {/* Records list */}
              {fsLoading ? (
                <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"/></div>
              ) : fsRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-3">🎁</p>
                  <p className="font-medium">No free sample records yet.</p>
                  <button onClick={openCreateFs} className="mt-3 text-green-600 hover:underline text-sm">Create your first record →</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Date', 'Products', 'Total Units', 'Notes', 'Created', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {fsRecords.map((record) => {
                        const totalUnits = record.items.reduce((s, i) => s + i.quantity, 0);
                        return (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {new Date(record.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              <div className="flex flex-wrap gap-1">
                                {record.items.map((item, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                                    {item.product?.name ?? 'Unknown'} ×{item.quantity}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{totalUnits}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{record.notes || '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(record.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex gap-3">
                                <button onClick={() => { setViewingFs(record); setFsError(''); }}
                                  className="text-blue-600 hover:text-blue-800 font-medium">View</button>
                                <button onClick={() => openEditFs(record)}
                                  className="text-green-600 hover:text-green-800 font-medium">Edit</button>
                                <button onClick={() => deleteFs(record.id)} disabled={deletingFsId === record.id}
                                  className="text-red-600 hover:text-red-800 font-medium disabled:opacity-40">
                                  {deletingFsId === record.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Create / Edit form modal ─────────────────────────────────── */}
              {showFsForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900">{editingFs ? 'Edit Free Sample Record' : 'New Free Sample Record'}</h3>
                      <p className="text-sm text-gray-500 mt-1">Stock will be deducted automatically. No amount charged.</p>
                    </div>
                    <div className="p-6 space-y-5">

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                        <input type="date" value={fsForm.date}
                          onChange={(e) => setFsForm((f) => ({ ...f, date: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-gray-700">Products *</label>
                          <button onClick={addFsItem} type="button"
                            className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                            Add Product
                          </button>
                        </div>
                        <div className="space-y-3">
                          {fsForm.items.map((item, idx) => (
                            <div key={idx} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
                              <select value={item.productId}
                                onChange={(e) => updateFsItem(idx, 'productId', e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500">
                                <option value="">Select product</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock})</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <label className="text-xs text-gray-500">Qty</label>
                                <input type="number" min="1" value={item.quantity}
                                  onChange={(e) => updateFsItem(idx, 'quantity', e.target.value)}
                                  className="w-20 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
                              </div>
                              {fsForm.items.length > 1 && (
                                <button onClick={() => removeFsItem(idx)} type="button"
                                  className="text-red-500 hover:text-red-700 flex-shrink-0">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                        <input type="text" value={fsForm.notes} placeholder="e.g. Given to new pharmacy in Lusaka"
                          onChange={(e) => setFsForm((f) => ({ ...f, notes: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                      </div>

                      {fsError && <p className="text-sm text-red-600">{fsError}</p>}

                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => { setShowFsForm(false); setEditingFs(null); setFsError(''); }}
                          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                        <button onClick={submitFsForm} disabled={fsLoading}
                          className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 text-sm font-medium">
                          {fsLoading ? 'Saving...' : editingFs ? 'Save Changes' : 'Create Record'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── View modal ──────────────────────────────────────────────── */}
              {viewingFs && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Free Sample Record</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{new Date(viewingFs.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                      <button onClick={() => setViewingFs(null)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        {viewingFs.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-900">{item.product?.name ?? 'Unknown'}</span>
                            <span className="text-sm font-bold text-green-700">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Total units</span>
                        <span className="font-bold text-gray-900">{viewingFs.items.reduce((s, i) => s + i.quantity, 0)}</span>
                      </div>
                      {viewingFs.notes && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Notes</p>
                          <p className="text-sm text-gray-700">{viewingFs.notes}</p>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">Created: {new Date(viewingFs.createdAt).toLocaleString()}</div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => openEditFs(viewingFs)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">Edit</button>
                        <button onClick={() => deleteFs(viewingFs.id)} disabled={deletingFsId === viewingFs.id}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm disabled:opacity-40">
                          {deletingFsId === viewingFs.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
