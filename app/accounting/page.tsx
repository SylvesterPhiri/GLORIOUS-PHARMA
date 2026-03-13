'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AccountingStats {
  totalRevenue:    number;
  monthlyRevenue:  number;
  pendingRevenue:  number;
  totalInvoices:   number;
  paidInvoices:    number;
  unpaidInvoices:  number;
  totalRefunds:    number;
  netRevenue:      number;
  totalExpenses:   number;
  netProfit:       number;
  expenses:        Expense[];
}

interface Expense {
  id:          string;
  description: string;
  amount:      number;
  category:    string;
  date:        string;
}

interface ClientInvoice {
  id:            string;
  invoiceNumber: string;
  invoiceDate:   string;
  dueDate:       string;
  status:        string;
  total:         number;
  client:        { name: string };
}

type Tab = 'overview' | 'statements' | 'expenses';

async function generateStatementPDF(
  invoices: ClientInvoice[],
  clientName: string,
  type: 'unpaid' | 'paid',
  dateFrom: string,
  dateTo: string,
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW    = 210;
  const margin   = 20;
  const contentW = pageW - margin * 2;
  const today    = new Date()
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
    .replace(/\//g, '-');

  let logoDataUrl: string | null = null;
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data.settings?.logoUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = data.settings.logoUrl;
        });
        if (img.width) {
          const canvas = document.createElement('canvas');
          canvas.width  = img.width;
          canvas.height = img.height;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          logoDataUrl = canvas.toDataURL('image/png');
        }
      }
    }
  } catch (_) {  }

  let y = 15;

  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', margin, y, 22, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(200, 0, 0);
  doc.text('GLORIOUS PHARMA.CO.LTD', pageW / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('Plot No. 7316, Light Industrial Area, Chibengele Road.',   pageW / 2, y + 14, { align: 'center' });
  doc.text('P. O. Box 37277, Lusaka Zambia.',                          pageW / 2, y + 18, { align: 'center' });
  doc.text('Contacts: 0973828255, 0979600608, 0978169648, 0978345458', pageW / 2, y + 22, { align: 'center' });
  doc.text('Email; gloriouspharmaltd@gmail.com',                       pageW / 2, y + 26, { align: 'center' });

  y += 33;

  doc.setFillColor(34, 139, 34);
  doc.rect(margin, y, contentW, 2.5, 'F');

  y += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Date: ${today}`, margin, y);

  if (dateFrom || dateTo) {
    const fromStr = dateFrom
      ? new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
      : '...';
    const toStr = dateTo
      ? new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
      : '...';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${fromStr} — ${toStr}`, pageW - margin, y, { align: 'right' });
  }

  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('STATEMENT', margin, y);
  const stmtW = doc.getTextWidth('STATEMENT');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 1, margin + stmtW, y + 1);

  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('CLIENT: ', margin, y);
  const labelW = doc.getTextWidth('CLIENT: ');
  doc.setFont('helvetica', 'bold');
  doc.text(clientName.toUpperCase(), margin + labelW, y);

  y += 14;

  const rowH      = 10;
  const colDate   = margin;
  const colInv    = margin + 40;
  const colAmt    = margin + 110;
  const colStatus = margin + 152;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(colDate, y, 40, rowH);
  doc.rect(colInv,  y, 70, rowH);
  doc.rect(colAmt,  y, 42, rowH);
  if (type === 'paid') doc.rect(colStatus, y, 28, rowH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('DATE',           colDate + 2, y + 6);
  doc.text('INVOICE NUMBER', colInv  + 2, y + 6);
  doc.text('TOTAL AMOUNT',   colAmt  + 2, y + 6);
  if (type === 'paid') doc.text('STATUS', colStatus + 2, y + 6);

  y += rowH;

  const rows = invoices.filter((inv) => {
    const matchType = type === 'unpaid' ? inv.status !== 'PAID' : inv.status === 'PAID';
    if (!matchType) return false;
    const d = new Date(inv.invoiceDate);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  rows.forEach((inv) => {
    const dateStr = new Date(inv.invoiceDate)
      .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
      .replace(/\//g, '-');
    const amtStr = `ZMW ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    doc.rect(colDate, y, 40, rowH);
    doc.rect(colInv,  y, 70, rowH);
    doc.rect(colAmt,  y, 42, rowH);
    if (type === 'paid') doc.rect(colStatus, y, 28, rowH);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(dateStr,           colDate + 2, y + 6);
    doc.text(inv.invoiceNumber, colInv  + 2, y + 6);
    doc.text(amtStr,            colAmt  + 2, y + 6);

    if (type === 'paid') {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 130, 0);
      doc.text('PAID', colStatus + 2, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
    }

    y += rowH;
  });

  const balance    = rows.reduce((s, i) => s + i.total, 0);
  const totalLabel = type === 'unpaid' ? 'BALANCE' : 'TOTAL PAID';
  const totalStr   = `ZMW ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  doc.rect(colDate, y, 40, rowH);
  doc.rect(colInv,  y, 70, rowH);
  doc.rect(colAmt,  y, 42, rowH);
  if (type === 'paid') doc.rect(colStatus, y, 28, rowH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(totalLabel, colInv + 2, y + 6);
  doc.text(totalStr,   colAmt + 2, y + 6);

  y += rowH + 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const prepLabel = 'Prepared by : ';
  doc.text(prepLabel, margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text('SYLVESTER PHIRI', margin + doc.getTextWidth(prepLabel), y);

  const safeName   = clientName.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  const typeLabel  = type === 'unpaid' ? 'UNPAID' : 'PAID';
  const periodPart = (dateFrom || dateTo)
    ? `_${(dateFrom || 'START').replace(/-/g, '')}_TO_${(dateTo || 'END').replace(/-/g, '')}`
    : '';
  doc.save(`${safeName}_${typeLabel}_STATEMENT${periodPart}_${today}.pdf`);
}

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats]         = useState<AccountingStats | null>(null);
  const [loading, setLoading]     = useState(true);

  const [searchClient, setSearchClient]       = useState('');
  const [clientInvoices, setClientInvoices]   = useState<ClientInvoice[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [clientError, setClientError]         = useState('');
  const [generatingPdf, setGeneratingPdf]     = useState<'unpaid' | 'paid' | null>(null);
  const [dateFrom, setDateFrom]               = useState('');
  const [dateTo, setDateTo]                   = useState('');

  const [expenseForm, setExpenseForm] = useState({
    description: '', amount: '', category: 'Operations',
    date: new Date().toISOString().split('T')[0],
  });
  const [addingExpense,  setAddingExpense]  = useState(false);
  const [expenseError,   setExpenseError]   = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm,       setEditForm]       = useState({ description: '', amount: '', category: '', date: '' });
  const [savingEdit,     setSavingEdit]     = useState(false);
  const [editError,      setEditError]      = useState('');
  const [confirmDelete,  setConfirmDelete]  = useState<Expense | null>(null);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStats(data.data);
      }
    } catch (err) { console.error('Accounting fetch error:', err); }
    finally { setLoading(false); }
  };

  const searchClientStatement = async () => {
    if (!searchClient.trim()) return;
    setClientSearching(true);
    setClientError('');
    setDateFrom('');
    setDateTo('');
    try {
      const res = await fetch(`/api/invoices?search=${encodeURIComponent(searchClient)}&limit=1000`);
      if (!res.ok) throw new Error('Failed to search');
      const data = await res.json();
      setClientInvoices(data.invoices ?? []);
      if ((data.invoices ?? []).length === 0) setClientError('No invoices found for this client.');
    } catch {
      setClientError('Failed to search. Please try again.');
    } finally {
      setClientSearching(false);
    }
  };

  const filteredInvoices = clientInvoices.filter((inv) => {
    const d = new Date(inv.invoiceDate);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const handleDownloadPdf = async (type: 'unpaid' | 'paid') => {
    if (!clientInvoices.length) return;
    setGeneratingPdf(type);
    try {
      const clientName = clientInvoices[0]?.client?.name ?? searchClient;
      await generateStatementPDF(clientInvoices, clientName, type, dateFrom, dateTo);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      setExpenseError('Description and amount are required.');
      return;
    }
    setAddingExpense(true);
    setExpenseError('');
    try {
      const res = await fetch('/api/accounting/expenses', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...expenseForm, amount: parseFloat(expenseForm.amount) }),
      });
      if (!res.ok) throw new Error('Failed to add expense');
      setExpenseForm({ description: '', amount: '', category: 'Operations', date: new Date().toISOString().split('T')[0] });
      await fetchStats();
    } catch { setExpenseError('Failed to add expense.'); }
    finally { setAddingExpense(false); }
  };

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditForm({ description: exp.description, amount: String(exp.amount), category: exp.category, date: exp.date.split('T')[0] });
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    if (!editForm.description || !editForm.amount) { setEditError('Description and amount are required.'); return; }
    setSavingEdit(true);
    setEditError('');
    try {
      const res = await fetch(`/api/accounting/expenses/${editingExpense.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...editForm, amount: parseFloat(editForm.amount) }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setEditingExpense(null);
      await fetchStats();
    } catch { setEditError('Failed to save changes.'); }
    finally { setSavingEdit(false); }
  };

  const handleDeleteExpense = async (exp: Expense) => {
    setDeletingId(exp.id);
    try {
      const res = await fetch(`/api/accounting/expenses/${exp.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setConfirmDelete(null);
      await fetchStats();
    } catch { alert('Failed to delete expense. Please try again.'); }
    finally { setDeletingId(null); }
  };

  const clientName      = clientInvoices[0]?.client?.name ?? searchClient;
  const isFiltered      = !!(dateFrom || dateTo);
  const filteredTotal   = filteredInvoices.reduce((s, i) => s + i.total, 0);
  const filteredPaid    = filteredInvoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const filteredPending = filteredInvoices.filter((i) => i.status !== 'PAID').reduce((s, i) => s + i.total, 0);
  const unpaidCount     = filteredInvoices.filter((i) => i.status !== 'PAID').length;
  const paidCount       = filteredInvoices.filter((i) => i.status === 'PAID').length;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Financial Overview' },
    { id: 'statements', label: 'Client Statements'  },
    { id: 'expenses',   label: 'Company Expenses'   },
  ];
  const EXPENSE_CATEGORIES = ['Operations','Salaries','Rent','Utilities','Marketing','Transport','Supplies','Other'];

  return (
    <div className="p-6">

      {}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Accounting</h1>
          <p className="text-gray-600 mt-1">Financial management, statements, and expense tracking</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchStats} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Refresh</button>
          <Link href="/" className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Dashboard</Link>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue',   value: `K${(stats?.totalRevenue   ?? 0).toFixed(2)}`, color: 'border-blue-500'   },
          { label: 'Monthly Revenue', value: `K${(stats?.monthlyRevenue ?? 0).toFixed(2)}`, color: 'border-green-500'  },
          { label: 'Pending Revenue', value: `K${(stats?.pendingRevenue ?? 0).toFixed(2)}`, color: 'border-yellow-500' },
          { label: 'Total Expenses',  value: `K${(stats?.totalExpenses  ?? 0).toFixed(2)}`, color: 'border-red-500'    },
        ].map((c) => (
          <div key={c.label} className={`bg-white rounded-lg shadow p-5 border-l-4 ${c.color}`}>
            <p className="text-sm text-gray-600">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : c.value}</p>
          </div>
        ))}
      </div>

      {}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading && activeTab === 'overview' ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {}
              {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-5">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Invoice Summary</h3>
                      <div className="space-y-3">
                        {[
                          { label: 'Total Invoices',  value: String(stats.totalInvoices),  color: 'text-gray-900'   },
                          { label: 'Paid Invoices',   value: String(stats.paidInvoices),   color: 'text-green-600'  },
                          { label: 'Unpaid Invoices', value: String(stats.unpaidInvoices), color: 'text-yellow-600' },
                        ].map((r) => (
                          <div key={r.label} className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{r.label}</span>
                            <span className={`font-bold ${r.color}`}>{r.value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center border-t pt-3">
                          <span className="font-medium text-gray-800">Net Revenue</span>
                          <span className="text-xl font-bold text-blue-600">K{stats.netRevenue.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-5">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Profit & Loss</h3>
                      <div className="space-y-3">
                        {[
                          { label: 'Total Revenue',  value: `K${stats.totalRevenue.toFixed(2)}`,  color: 'text-green-600'  },
                          { label: 'Total Expenses', value: `K${stats.totalExpenses.toFixed(2)}`,  color: 'text-red-600'    },
                          { label: 'Total Refunds',  value: `K${stats.totalRefunds.toFixed(2)}`,   color: 'text-orange-600' },
                        ].map((r) => (
                          <div key={r.label} className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{r.label}</span>
                            <span className={`font-bold ${r.color}`}>{r.value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center border-t pt-3">
                          <span className="font-medium text-gray-800">Net Profit</span>
                          <span className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            K{stats.netProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {}
              {activeTab === 'statements' && (
                <div className="space-y-5">

                  {}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Search Client</h3>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={searchClient}
                        onChange={(e) => setSearchClient(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchClientStatement()}
                        placeholder="Type client name..."
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button onClick={searchClientStatement} disabled={clientSearching}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                        {clientSearching ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                    {clientError && <p className="text-red-600 text-sm mt-2">{clientError}</p>}
                  </div>

                  {}
                  {clientInvoices.length > 0 && (
                    <div className="flex flex-wrap items-end gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <CalendarIcon />
                        <span className="text-sm font-semibold text-blue-800">Filter by Date Range</span>
                        {isFiltered && (
                          <span className="ml-1 px-2 py-0.5 text-xs bg-blue-200 text-blue-800 rounded-full font-medium">Active</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-3 sm:ml-auto">
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">From</label>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="p-2 border border-blue-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-400 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">To</label>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="p-2 border border-blue-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-400 text-sm"
                          />
                        </div>
                        {isFiltered && (
                          <button
                            onClick={() => { setDateFrom(''); setDateTo(''); }}
                            className="px-3 py-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {isFiltered && (
                        <p className="w-full text-xs text-blue-600 -mt-1">
                          Showing {filteredInvoices.length} of {clientInvoices.length} invoices — PDF will only include this period
                        </p>
                      )}
                    </div>
                  )}

                  {filteredInvoices.length > 0 && (
                    <>
                      {}
                      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-gray-100">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">{clientName}</h2>
                          <p className="text-sm text-gray-500">
                            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
                            {isFiltered && <span className="ml-1 text-blue-600 font-medium">(filtered period)</span>}
                            {unpaidCount > 0 && <span className="ml-2 text-yellow-600">· {unpaidCount} unpaid</span>}
                            {paidCount   > 0 && <span className="ml-2 text-green-600">· {paidCount} paid</span>}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {unpaidCount > 0 && (
                            <button
                              onClick={() => handleDownloadPdf('unpaid')}
                              disabled={generatingPdf !== null}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-all shadow-sm"
                            >
                              {generatingPdf === 'unpaid'
                                ? <><SpinnerIcon /> Generating...</>
                                : <><DownloadIcon /> Unpaid Statement ({unpaidCount})</>}
                            </button>
                          )}
                          {paidCount > 0 && (
                            <button
                              onClick={() => handleDownloadPdf('paid')}
                              disabled={generatingPdf !== null}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-all shadow-sm"
                            >
                              {generatingPdf === 'paid'
                                ? <><SpinnerIcon /> Generating...</>
                                : <><DownloadIcon /> Paid Statement ({paidCount})</>}
                            </button>
                          )}
                        </div>
                      </div>

                      {}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Total Invoiced', value: `K${filteredTotal.toFixed(2)}`,   color: 'border-blue-500'   },
                          { label: 'Total Paid',     value: `K${filteredPaid.toFixed(2)}`,    color: 'border-green-500'  },
                          { label: 'Outstanding',    value: `K${filteredPending.toFixed(2)}`, color: 'border-yellow-500' },
                        ].map((c) => (
                          <div key={c.label} className={`bg-white border-l-4 ${c.color} rounded-lg p-4 shadow-sm`}>
                            <p className="text-xs text-gray-500">{c.label}</p>
                            <p className="text-lg font-bold text-gray-900 mt-0.5">{c.value}</p>
                          </div>
                        ))}
                      </div>

                      {}
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {['Invoice #', 'Client', 'Date', 'Due Date', 'Total', 'Status'].map((h) => (
                                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredInvoices.map((inv) => (
                              <tr key={inv.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm font-medium text-blue-600">
                                  <Link href={`/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">{inv.client.name}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{new Date(inv.dueDate).toLocaleDateString()}</td>
                                <td className="px-4 py-2 text-sm font-semibold text-gray-900">K{inv.total.toFixed(2)}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                    inv.status === 'PAID'    ? 'bg-green-100 text-green-800'   :
                                    inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>{inv.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {}
                  {clientInvoices.length > 0 && filteredInvoices.length === 0 && isFiltered && (
                    <div className="text-center py-10 text-gray-400">
                      <p className="text-sm">No invoices in the selected date range.</p>
                      <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="mt-2 text-blue-500 text-sm hover:underline">
                        Clear filter to see all {clientInvoices.length} invoices
                      </button>
                    </div>
                  )}
                </div>
              )}

              {}
              {activeTab === 'expenses' && (
                <div className="space-y-6">

                  {}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Record New Expense</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                        <input type="text" value={expenseForm.description}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="e.g. Office rent – March"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount (K) *</label>
                        <input type="number" value={expenseForm.amount} min="0" step="0.01"
                          onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                        <select value={expenseForm.category}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                          {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                        <input type="date" value={expenseForm.date}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                      </div>
                    </div>
                    {expenseError && <p className="text-red-600 text-sm mt-2">{expenseError}</p>}
                    <button onClick={handleAddExpense} disabled={addingExpense}
                      className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 text-sm">
                      {addingExpense ? 'Saving...' : 'Add Expense'}
                    </button>
                  </div>

                  {}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Recorded Expenses</h3>
                    {!stats?.expenses?.length ? (
                      <p className="text-gray-400 text-sm">No expenses recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {['Date', 'Description', 'Category', 'Amount', 'Actions'].map((h) => (
                                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {stats.expenses.map((exp) => (
                              <tr key={exp.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{exp.description}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{exp.category}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-red-600 whitespace-nowrap">K{exp.amount.toFixed(2)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => openEdit(exp)}
                                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                                    >
                                      <EditIcon /> Edit
                                    </button>
                                    <button
                                      onClick={() => setConfirmDelete(exp)}
                                      className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium transition-colors"
                                    >
                                      <TrashIcon /> Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {}
      {editingExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">Edit Expense</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                <input type="text" value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (K) *</label>
                  <input type="number" value={editForm.amount} min="0" step="0.01"
                    onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={editForm.date}
                    onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select value={editForm.category}
                  onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                  {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {editError && <p className="text-red-600 text-sm">{editError}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingExpense(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium">
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <TrashIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Expense</h3>
                <p className="text-sm text-gray-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-5">
              <p className="text-sm font-semibold text-gray-800">{confirmDelete.description}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                K{confirmDelete.amount.toFixed(2)} · {confirmDelete.category} · {new Date(confirmDelete.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={() => handleDeleteExpense(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {deletingId === confirmDelete.id ? <><SpinnerIcon /> Deleting...</> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
function TrashIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}