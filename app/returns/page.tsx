'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReturnRecord {
  id:         string;
  invoiceId:  string;
  productId:  string;
  quantity:   number;
  reason:     string;
  returnDate: string;
  invoice:    { invoiceNumber: string; client: { name: string } };
  product:    { name: string; price: number };
}

interface ReturnStats {
  total:       number;
  totalValue:  number;
  thisMonth:   number;
}

export default function ReturnsPage() {
  const [returns,  setReturns]  = useState<ReturnRecord[]>([]);
  const [stats,    setStats]    = useState<ReturnStats>({ total: 0, totalValue: 0, thisMonth: 0 });
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [error,    setError]    = useState('');

  useEffect(() => { fetchReturns(); }, []);

  const fetchReturns = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/returns');
      if (!res.ok) throw new Error('Failed to fetch returns');
      const data = await res.json();
      const all: ReturnRecord[] = data.returns ?? data ?? [];
      setReturns(all);

      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setStats({
        total:      all.length,
        totalValue: all.reduce((s, r) => s + r.quantity * (r.product?.price ?? 0), 0),
        thisMonth:  all.filter((r) => new Date(r.returnDate) >= monthStart).length,
      });
    } catch (err: any) {
      setError(err.message ?? 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  const filtered = returns.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.invoice?.invoiceNumber?.toLowerCase().includes(q) ||
      r.invoice?.client?.name?.toLowerCase().includes(q)  ||
      r.product?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      {}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Returns</h1>
          <p className="text-gray-600 mt-1">All product returns processed across invoices</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Dashboard
                      </Link>
          <button onClick={fetchReturns} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">
            Refresh
          </button>
          <Link href="/invoices" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
            Go to Invoices
          </Link>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Returns',       value: String(stats.total),                                                                           color: 'border-orange-500' },
          { label: 'Total Return Value',  value: `K${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,                  color: 'border-red-500'    },
          { label: 'This Month',          value: String(stats.thisMonth),                                                                        color: 'border-blue-500'   },
        ].map((c) => (
          <div key={c.label} className={`bg-white rounded-lg shadow p-5 border-l-4 ${c.color}`}>
            <p className="text-sm text-gray-600">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : c.value}</p>
          </div>
        ))}
      </div>

      {}
      <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
        <strong>How returns work:</strong> Returns are processed from individual invoices.
        Go to an invoice and click <em>Return</em> to process a return for specific items.
        Stock is automatically restored when a return is processed.
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice, client, or product..."
          className="w-full max-w-md p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
        />
      </div>

      {}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            <p className="mt-2 text-gray-500 text-sm">Loading returns...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-medium">{search ? 'No returns match your search.' : 'No returns recorded yet.'}</p>
            <p className="text-sm mt-1">Returns are created from individual invoices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Invoice', 'Client', 'Product', 'Qty', 'Value', 'Reason', 'Date', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">
                      <Link href={`/invoices/${ret.invoiceId}`}>{ret.invoice?.invoiceNumber ?? ret.invoiceId}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ret.invoice?.client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ret.product?.name ?? ret.productId}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{ret.quantity}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600">
                      K{(ret.quantity * (ret.product?.price ?? 0)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{ret.reason}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{new Date(ret.returnDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${ret.invoiceId}`}
                        className="text-sm text-blue-600 hover:text-blue-800">
                        View Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}