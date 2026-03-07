'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client  { id: string; name: string; }
interface Product { id: string; name: string; price: number; currentStock: number; }
interface InvoiceItem {
  productId: string; quantity: number; freeSample: number;
  price: number; maxStock: number; productName: string;
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const [clients,  setClients]  = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const [formData, setFormData] = useState({
    clientId:        '',
    invoiceNumber:   '',
    invoiceDate:     new Date().toISOString().split('T')[0],
    dueDate:         new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status:          'UNPAID',
    discount:        '0',
    paymentDate:     '',
    paymentMethod:   '',
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { productId: '', quantity: 1, freeSample: 0, price: 0, maxStock: 0, productName: '' },
  ]);

  const [totals, setTotals] = useState({ subtotal: 0, discount: 0, grandTotal: 0 });

  useEffect(() => { fetchClients(); fetchProducts(); }, []);
  useEffect(() => { calculateTotals(); }, [items, formData.discount]);
  useEffect(() => {
    if (formData.status === 'PAID') {
      setFormData((prev) => ({
        ...prev,
        paymentDate:   prev.paymentDate   || prev.invoiceDate,
        paymentMethod: prev.paymentMethod || 'CASH',
      }));
    }
  }, [formData.status]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : (data.clients ?? []));
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    try {
      let res = await fetch('/api/products?limit=1000');
      if (!res.ok) res = await fetch('/api/inventory?limit=1000');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setProducts(data.products ?? data ?? []);
    } catch (err) { console.error(err); }
  };

  const calculateTotals = () => {
    const subtotal   = items.reduce((sum, item) => sum + (parseInt(String(item.quantity)) || 0) * (parseFloat(String(item.price)) || 0), 0);
    const discount   = parseFloat(formData.discount) || 0;
    const grandTotal = Math.max(subtotal - discount, 0);
    setTotals({ subtotal, discount, grandTotal });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...items];
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        updated[index].price       = product.price;
        updated[index].maxStock    = product.currentStock;
        updated[index].productName = product.name;
        updated[index].quantity    = 1;
        updated[index].freeSample  = 0;
      }
    }
    if ((field === 'quantity' || field === 'freeSample') && updated[index].maxStock) {
      const qty  = field === 'quantity'    ? parseInt(value) || 0 : parseInt(String(updated[index].quantity))   || 0;
      const free = field === 'freeSample'  ? parseInt(value) || 0 : parseInt(String(updated[index].freeSample)) || 0;
      if (qty + free > updated[index].maxStock) {
        setError(`Cannot exceed available stock (${updated[index].maxStock}) for ${updated[index].productName}`);
        setTimeout(() => setError(''), 5000);
        return;
      }
    }
    if (field === 'quantity' || field === 'freeSample') updated[index][field] = parseInt(value) || 0;
    else if (field === 'price')                         updated[index][field] = parseFloat(value) || 0;
    else                                                (updated[index] as any)[field] = value;
    setItems(updated);
    setError('');
  };

  const addItem    = () => setItems([...items, { productId: '', quantity: 1, freeSample: 0, price: 0, maxStock: 0, productName: '' }]);
  const removeItem = (i: number) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');

    try {
      if (!formData.clientId)  throw new Error('Please select a client');
      if (items.some((item) => !item.productId)) throw new Error('Please select products for all items');

      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          const qty  = parseInt(String(item.quantity))   || 0;
          const free = parseInt(String(item.freeSample)) || 0;
          if (qty + free > product.currentStock) {
            throw new Error(`Not enough stock for ${product.name}. Available: ${product.currentStock}, Requested: ${qty + free}`);
          }
        }
      }

      const requestData: any = {
        clientId:     formData.clientId,
        invoiceDate:  formData.invoiceDate,
        dueDate:      formData.dueDate,
        status:       formData.status,
        items: items.map((item) => ({
          productId:  item.productId,
          quantity:   parseInt(String(item.quantity))   || 0,
          freeSample: parseInt(String(item.freeSample)) || 0,
          price:      parseFloat(String(item.price))    || 0,
        })),
      };

      if (formData.invoiceNumber.trim()) {
        const raw = formData.invoiceNumber.trim();
        requestData.invoiceNumber = /^\d+$/.test(raw) ? `INV-${raw}` : raw;
      }

      if (formData.status === 'PAID') {
        requestData.payment = {
          amount:      totals.grandTotal,
          method:      formData.paymentMethod || 'CASH',
          paymentDate: formData.paymentDate   || formData.invoiceDate,
        };
      }

      const res    = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestData) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.details || 'Failed to create invoice');

      setSuccess('Invoice created successfully! Redirecting...');
      setTimeout(() => { router.push('/invoices'); router.refresh(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            <Link href="/" className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">
            Dashboard
          </Link>
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Invoices
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Create New</span>
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              Create New Invoice
            </h1>
            <p className="text-gray-600 mt-2">Fill in the details to create a new invoice</p>
          </div>
        </div>

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

        {success && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-2xl p-6">
            <div className="flex items-center text-green-700">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <form onSubmit={handleSubmit}>
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Client <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="clientId"
                      value={formData.clientId}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    >
                      <option value="">Select client</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    >
                      <option value="UNPAID">Unpaid</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Invoice Number
                      <span className="ml-2 text-xs text-gray-400 font-normal">(optional — leave blank to auto-generate)</span>
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-4 py-3 border-2 border-r-0 border-gray-200 rounded-l-xl bg-gray-50 text-gray-500 text-sm font-medium">
                        INV-
                      </span>
                      <input
                        type="text"
                        name="invoiceNumber"
                        value={formData.invoiceNumber}
                        onChange={handleFormChange}
                        placeholder="e.g. 1042 or leave blank"
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-r-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Enter just the number (e.g. <span className="font-semibold">1042</span>) → saved as <span className="font-semibold">INV-1042</span>. Or type a full custom number.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="invoiceDate"
                      value={formData.invoiceDate}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  {formData.status === 'PAID' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Date</label>
                        <input
                          type="date"
                          name="paymentDate"
                          value={formData.paymentDate}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                        <select
                          name="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        >
                          <option value="CASH">Cash</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Discount (K)</label>
                    <input
                      type="number"
                      name="discount"
                      value={formData.discount}
                      onChange={handleFormChange}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>
                </div>

                {/* Items */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Invoice Items</h2>
                    <button
                      type="button"
                      onClick={addItem}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div key={index} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                        <div className="grid grid-cols-6 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Product *</label>
                            <select
                              value={item.productId}
                              onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                              required
                              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
                            >
                              <option value="">Select product</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.currentStock})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                            <input
                              type="number"
                              value={item.quantity}
                              min="1"
                              required
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Free Sample</label>
                            <input
                              type="number"
                              value={item.freeSample}
                              min="0"
                              onChange={(e) => handleItemChange(index, 'freeSample', e.target.value)}
                              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Price (K)</label>
                            <input
                              type="number"
                              value={item.price}
                              min="0"
                              step="0.01"
                              required
                              onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                            />
                          </div>
                          <div className="flex items-end">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-medium"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                        {item.maxStock > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            Line total: K{(item.quantity * item.price).toFixed(2)} · Free: {item.freeSample} · Stock remaining after: {item.maxStock - (item.quantity + item.freeSample)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                  <Link
                    href="/invoices"
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Invoice
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Summary sidebar */}
          <div>
            <div className="bg-white rounded-2xl shadow-2xl p-6 sticky top-6">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900">Invoice Summary</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-bold text-gray-900">K{totals.subtotal.toFixed(2)}</span>
                  </div>
                </div>
                
                {totals.discount > 0 && (
                  <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-bold text-red-600">-K{totals.discount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border-2 border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Grand Total:</span>
                    <span className="text-lg font-bold text-green-600">K{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Items:</span>
                  <span className="font-semibold text-gray-900">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Total Units:</span>
                  <span className="font-semibold text-gray-900">
                    {items.reduce((s, i) => s + i.quantity + i.freeSample, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Free Samples:</span>
                  <span className="font-semibold text-gray-900">
                    {items.reduce((s, i) => s + i.freeSample, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}