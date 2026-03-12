'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Payment {
  id: string; amount: number; method: string;
  paymentDate: string; chequeNumber: string | null; bankName: string | null; notes: string | null;
}

interface InvoiceItem {
  id: string; quantity: number; freeSamples: number; unitPrice: number; totalPrice: number;
  productId: string | null; productSnapshot: string | null;
  product: { id: string; name: string; genericName: string | null; type: string; unit: string } | null;
}

interface Return {
  id: string; quantity: number; reason: string; returnDate: string;
  product: { id: string; name: string };
}

interface Invoice {
  id: string; invoiceNumber: string; invoiceDate: string; dueDate: string;
  status: string; subTotal: number; tax: number; total: number;
  notes: string | null; hasReturns: boolean; isHistorical: boolean;
  createdAt: string;
  client: { id: string; name: string; email: string | null; phone: string | null; address: string | null };
  items:    InvoiceItem[];
  payments: Payment[];
  returns:  Return[];
}

const STATUS_COLORS: Record<string, string> = {
  PAID:      'bg-green-100 text-green-800 border border-green-200',
  PENDING:   'bg-yellow-100 text-yellow-800 border border-yellow-200',
  OVERDUE:   'bg-red-100 text-red-800 border border-red-200',
  DRAFT:     'bg-gray-100 text-gray-600 border border-gray-200',
  CANCELLED: 'bg-red-50 text-red-400 border border-red-100',
};

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Paid', PENDING: 'Unpaid', OVERDUE: 'Overdue', DRAFT: 'Draft', CANCELLED: 'Cancelled',
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [invoice,  setInvoice]  = useState<Invoice | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '', method: 'CASH', paymentDate: new Date().toISOString().split('T')[0],
    chequeNumber: '', bankName: '', notes: '',
  });
  const [paying,    setPaying]    = useState(false);
  const [payError,  setPayError]  = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  useEffect(() => { if (id) fetchInvoice(); }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) throw new Error('Invoice not found');
      const data = await res.json();
      setInvoice(data);
      setPayForm((p) => ({ ...p, amount: String(data.total) }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!payForm.amount) { setPayError('Amount is required'); return; }
    setPaying(true); setPayError('');
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:       'mark_paid',
          amount:       payForm.amount,
          method:       payForm.method,
          paymentDate:  payForm.paymentDate,
          chequeNumber: payForm.chequeNumber || null,
          bankName:     payForm.bankName     || null,
          notes:        payForm.notes        || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as paid');
      setShowPayModal(false);
      await fetchInvoice();
    } catch (err: any) {
      setPayError(err.message);
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      router.push('/invoices');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (n: number) => `K${n.toFixed(2)}`;

  const getProductName = (item: InvoiceItem) => {
    if (item.product) return item.product.name;
    if (item.productSnapshot) {
      try { return JSON.parse(item.productSnapshot).name; } catch {}
    }
    return 'Unknown Product';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-4">
            <div className="flex items-center text-red-700">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error || 'Invoice not found'}
            </div>
          </div>
          <Link href="/invoices" className="text-blue-600 hover:text-blue-800 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const isPaid    = invoice.status === 'PAID';
  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/invoices" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Invoices
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">{invoice.invoiceNumber}</span>
          </div>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                {invoice.invoiceNumber}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${STATUS_COLORS[invoice.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABELS[invoice.status] ?? invoice.status}
                </span>
                {invoice.isHistorical && (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    Historical
                  </span>
                )}
                {invoice.hasReturns && (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                    Has Returns
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              {!isPaid && invoice.status !== 'CANCELLED' && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Mark as Paid
                </button>
              )}
              <Link
                href={`/invoices/${id}/return`}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Process Return
              </Link>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-pink-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

          {}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Client</h3>
            </div>
            <p className="font-semibold text-gray-900 text-lg">{invoice.client.name}</p>
            {invoice.client.email   && <p className="text-sm text-gray-500 mt-2">{invoice.client.email}</p>}
            {invoice.client.phone   && <p className="text-sm text-gray-500">{invoice.client.phone}</p>}
            {invoice.client.address && <p className="text-sm text-gray-400 mt-2">{invoice.client.address}</p>}
          </div>

          {}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Dates</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Invoice Date</span>
                <span className="text-sm font-semibold text-gray-900">{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Due Date</span>
                <span className="text-sm font-semibold text-gray-900">{new Date(invoice.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm font-semibold text-gray-900">{new Date(invoice.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-blue-100">Subtotal</span>
                <span className="text-sm font-semibold">{fmt(invoice.subTotal)}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-blue-100">Tax</span>
                  <span className="text-sm font-semibold">{fmt(invoice.tax)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-white/20">
                <span className="font-bold">Total</span>
                <span className="font-bold">{fmt(invoice.total)}</span>
              </div>
              {isPaid && (
                <div className="flex justify-between">
                  <span className="text-sm text-blue-100">Amount Paid</span>
                  <span className="text-sm font-semibold text-green-300">{fmt(totalPaid)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Invoice Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Qty', 'Free', 'Unit Price', 'Total'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {invoice.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{getProductName(item)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.quantity}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.freeSamples || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{fmt(item.unitPrice)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{fmt(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {}
        {invoice.payments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Method', 'Amount', 'Reference', 'Notes'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-700">{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{p.method}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">{fmt(p.amount)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.chequeNumber || p.bankName || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {}
        {invoice.returns.length > 0 && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Returns</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Product', 'Qty Returned', 'Reason', 'Date'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {invoice.returns.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{r.product.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{r.quantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{r.reason}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{new Date(r.returnDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {invoice.notes && (
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Notes</h3>
            <p className="text-sm text-gray-700">{invoice.notes}</p>
          </div>
        )}

        {}
        {showPayModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Mark Invoice as Paid</h3>
                  <p className="text-sm text-gray-500">{invoice.invoiceNumber} — {invoice.client.name}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amount Received *</label>
                    <input
                      type="number"
                      value={payForm.amount}
                      step="0.01"
                      onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Date *</label>
                    <input
                      type="date"
                      value={payForm.paymentDate}
                      onChange={(e) => setPayForm((p) => ({ ...p, paymentDate: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                  <select
                    value={payForm.method}
                    onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                {payForm.method === 'CHEQUE' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cheque Number</label>
                    <input
                      type="text"
                      value={payForm.chequeNumber}
                      onChange={(e) => setPayForm((p) => ({ ...p, chequeNumber: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                    />
                  </div>
                )}

                {payForm.method === 'BANK_TRANSFER' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={payForm.bankName}
                      onChange={(e) => setPayForm((p) => ({ ...p, bankName: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (optional)</label>
                  <input
                    type="text"
                    value={payForm.notes}
                    placeholder="e.g. Receipt #123"
                    onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  />
                </div>

                {payError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-600">{payError}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowPayModal(false)}
                    className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkPaid}
                    disabled={paying}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {paying ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Confirm Payment'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Delete Invoice</h3>
              </div>

              <p className="text-gray-600 mb-4">
                Are you sure you want to delete invoice <span className="font-semibold">#{invoice.invoiceNumber}</span>?
              </p>

              {invoice.status === 'PAID' && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Warning: This is a paid invoice!
                  </p>
                </div>
              )}

              {invoice.hasReturns && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-sm text-orange-700 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This invoice has associated returns.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}