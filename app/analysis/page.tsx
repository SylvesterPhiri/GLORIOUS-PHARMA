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

type Tab = 'sales' | 'inventory' | 'products' | 'clients' | 'reports';

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [stats,     setStats]     = useState<AnalysisStats | null>(null);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  useEffect(() => { fetchAll(); }, []);

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

  const filtered = invoices.filter((inv) => {
    const d = new Date(inv.invoiceDate);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo   && d > new Date(dateTo))   return false;
    return true;
  });

  // Monthly revenue (last 6 months)
  const monthlyData = (() => {
    const map: Record<string, number> = {};
    filtered.filter((i) => !i.isHistorical && i.status === 'PAID').forEach((inv) => {
      const key = new Date(inv.invoiceDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      map[key] = (map[key] ?? 0) + inv.total;
    });
    // Sort by date
    const sorted = Object.entries(map)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-6);
    return sorted.map(([month, revenue]) => ({ month, revenue }));
  })();
  const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue), 1);

  // Top products
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

  // Top clients
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

  // Inventory
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const lowStock = products.filter((p) => p.currentStock <= p.minStock);
  const expiring = products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= in30Days);

  const fmt = (n: number) => `K${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'sales',     label: 'Sales & Revenue'  },
    { id: 'inventory', label: 'Inventory Health' },
    { id: 'products',  label: 'Top Products'     },
    { id: 'clients',   label: 'Top Clients'      },
    { id: 'reports',   label: 'Reports'          },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Analysis & Reports</h1>
          <p className="text-gray-600 mt-1">Business intelligence across sales, stock, and clients</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchAll} disabled={loading}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm disabled:opacity-50">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue',     value: fmt(stats?.totalRevenue ?? 0),         color: 'border-green-500',  bg: 'bg-green-50'  },
          { label: 'Total Invoices',    value: String(stats?.totalInvoices   ?? 0),    color: 'border-blue-500',   bg: 'bg-blue-50'   },
          { label: 'Total Clients',     value: String(stats?.totalClients    ?? 0),    color: 'border-purple-500', bg: 'bg-purple-50' },
          { label: 'Products in Stock', value: String(stats?.totalProducts   ?? 0),    color: 'border-orange-500', bg: 'bg-orange-50' },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-lg p-5 border-l-4 ${card.color}`}>
            <p className="text-sm text-gray-600">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Date filter */}
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

          {/* ── SALES & REVENUE ── */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              {/* Invoice summary */}
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

              {/* Monthly chart */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Revenue (Last 6 Months)</h3>
                {monthlyData.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-3xl mb-2">📊</p>
                    <p>No paid invoices found in the selected period.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {monthlyData.map(({ month, revenue }) => (
                      <div key={month} className="flex items-center gap-4">
                        <span className="w-28 text-sm text-gray-600 text-right flex-shrink-0">{month}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${Math.max((revenue / maxRevenue) * 100, 3)}%` }}>
                            <span className="text-xs text-white font-medium whitespace-nowrap">{fmt(revenue)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent invoices table */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Recent Invoices</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Invoice #', 'Client', 'Date', 'Status', 'Total'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filtered.filter((i) => !i.isHistorical).slice(0, 20).map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-blue-600">
                            <Link href={`/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{inv.client?.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                              inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{inv.status}</span>
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{fmt(inv.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.filter((i) => !i.isHistorical).length === 0 && (
                    <p className="text-center py-8 text-gray-400 text-sm">No invoices in this date range.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── INVENTORY HEALTH ── */}
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
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1"><span>⚠</span> Low Stock Alert ({lowStock.length} products)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {lowStock.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.category ?? 'No category'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{p.currentStock} left</p>
                          <p className="text-xs text-gray-400">Min: {p.minStock}</p>
                        </div>
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
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">Stock: {p.currentStock}</p>
                        </div>
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
                      <tr>
                        {['Product', 'Category', 'Stock', 'Min Stock', 'Expiry', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {products.map((p) => {
                        const isLow     = p.currentStock <= p.minStock;
                        const isExpiring = p.expiryDate && new Date(p.expiryDate) <= in30Days;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{p.category ?? '—'}</td>
                            <td className="px-4 py-2 text-sm font-medium">{p.currentStock}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{p.minStock}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                isLow ? 'bg-red-100 text-red-700' :
                                isExpiring ? 'bg-orange-100 text-orange-700' :
                                'bg-green-100 text-green-700'
                              }`}>
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

          {/* ── TOP PRODUCTS ── */}
          {activeTab === 'products' && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
              {topProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">📦</p>
                  <p>No product sales data in the selected period.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-4">
                      <span className="w-6 text-sm text-gray-400 font-medium text-right flex-shrink-0">{i + 1}</span>
                      <div className="w-48 flex-shrink-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.qty} units sold</p>
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max((p.revenue / maxProdRevenue) * 100, 3)}%` }}>
                          <span className="text-xs text-white font-medium whitespace-nowrap">{fmt(p.revenue)}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {((p.revenue / Math.max(topProducts.reduce((s, x) => s + x.revenue, 0), 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TOP CLIENTS ── */}
          {activeTab === 'clients' && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Top Clients by Spend</h3>
              {topClients.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">👥</p>
                  <p>No client spending data in the selected period.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topClients.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-4">
                      <span className="w-6 text-sm text-gray-400 font-medium text-right flex-shrink-0">{i + 1}</span>
                      <div className="w-48 flex-shrink-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.invoices} invoice{c.invoices !== 1 ? 's' : ''} · avg {fmt(c.spend / c.invoices)}</p>
                      </div>
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

          {/* ── REPORTS ── */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-gray-900">Summary Report</h3>

              {/* Revenue summary */}
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
                            <div className={`h-full rounded-full ${
                              status === 'PAID' ? 'bg-green-500' :
                              status === 'OVERDUE' ? 'bg-red-500' :
                              status === 'CANCELLED' ? 'bg-gray-400' : 'bg-yellow-500'
                            }`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Inventory summary */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Inventory Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Products',  value: products.length },
                    { label: 'Low Stock Items', value: lowStock.length },
                    { label: 'Expiring Soon',   value: expiring.length },
                    { label: 'Total Stock Value', value: fmt(products.reduce((s, p) => s + p.currentStock * p.price, 0)) },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export hint */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                💡 To export data, use your browser's print function (Ctrl+P / Cmd+P) and save as PDF.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
