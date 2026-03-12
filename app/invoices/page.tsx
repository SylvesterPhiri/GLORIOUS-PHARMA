'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface InvoiceItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productId: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  total: number;
  subTotal: number;
  tax: number;
  hasReturns: boolean;
  isHistorical: boolean;
  createdAt: string;
  client: Client;
  items: InvoiceItem[];
  returns?: Array<{ id: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [pagination.page, statusFilter]);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/invoices?${params}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch invoices');
      }

      const data = await response.json();
      setInvoices(data.invoices ?? []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
      console.error('Error fetching invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchInvoices();
  };

  const handleDelete = async (invoice: Invoice) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete invoice');
      }

      setInvoices(invoices.filter((inv) => inv.id !== invoice.id));
      setDeleteConfirm(null);
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete invoice');
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':      return 'bg-green-100 text-green-800 border border-green-200';
      case 'PENDING':   return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'OVERDUE':   return 'bg-red-100 text-red-800 border border-red-200';
      case 'DRAFT':     return 'bg-gray-100 text-gray-600 border border-gray-200';
      case 'CANCELLED': return 'bg-red-50 text-red-400 border border-red-100';
      default:          return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':   return 'Unpaid';
      case 'PAID':      return 'Paid';
      case 'OVERDUE':   return 'Overdue';
      case 'DRAFT':     return 'Draft';
      case 'CANCELLED': return 'Cancelled';
      default:          return status;
    }
  };

  const calculateStats = () => {
    return {
      total: pagination.total,
      paid:    invoices.filter((inv) => inv.status.toUpperCase() === 'PAID').length,
      unpaid:  invoices.filter((inv) => inv.status.toUpperCase() === 'PENDING').length,
      revenue: invoices.reduce((sum, inv) => sum + (inv.total ?? 0), 0),
    };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Invoices</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Invoice Management
              </h1>
              <p className="text-gray-600 mt-2">View and manage all your invoices</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/invoices/add"
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Invoice
              </Link>
              <Link
                href="/invoices/historical"
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Import Historical
              </Link>
            </div>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Invoices</div>
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Paid</div>
                <div className="text-2xl font-bold text-gray-900">{stats.paid}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Unpaid</div>
                <div className="text-2xl font-bold text-gray-900">{stats.unpaid}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-purple-100">Total Revenue</div>
                <div className="text-2xl font-bold">K{stats.revenue.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
          <form onSubmit={handleSearch}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search Invoices</label>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by invoice number or client name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              >
                <option value="">All Status</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Unpaid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-6">
            <div className="flex items-center text-red-700">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Invoice List</h2>
            <p className="text-sm text-gray-500 mt-1">Total {pagination.total} invoices found</p>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-gray-500 text-lg mb-4">No invoices found.</p>
              {search || statusFilter ? (
                <p className="text-gray-400">Try adjusting your search filters</p>
              ) : (
                <Link
                  href="/invoices/add"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First Invoice
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{invoice.invoiceNumber}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{invoice.items?.length ?? 0} items</span>
                            {invoice.isHistorical && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                Historical
                              </span>
                            )}
                            {invoice.hasReturns && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                Returns
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{invoice.client.name}</div>
                          {invoice.client.phone && (
                            <div className="text-xs text-gray-500 mt-1">{invoice.client.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{new Date(invoice.invoiceDate).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500 mt-1">Due: {new Date(invoice.dueDate).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">K{invoice.total.toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                            {getStatusLabel(invoice.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </Link>
                            <Link
                              href={`/invoices/${invoice.id}/return`}
                              className="text-orange-600 hover:text-orange-800 font-medium text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Return
                            </Link>
                            <button
                              onClick={() => setDeleteConfirm(invoice)}
                              className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {}
              {pagination.pages > 1 && (
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border-2 border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="px-4 py-2 border-2 border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

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
                Are you sure you want to delete invoice <span className="font-semibold">#{deleteConfirm.invoiceNumber}</span>?
              </p>
              
              {deleteConfirm.status.toUpperCase() === 'PAID' && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Warning: This is a paid invoice!
                  </p>
                </div>
              )}
              
              {deleteConfirm.hasReturns && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-sm text-orange-700 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This invoice has returns associated with it.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                  disabled={deleting}
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