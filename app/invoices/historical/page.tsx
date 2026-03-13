'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  currentStock: number;
}

interface HistoricalItem {

  useExisting:  boolean;
  productId:    string;   // used when useExisting = true
  productName:  string;   // used when useExisting = false (or as display name)
  productSku:   string;   // optional reference
  quantity:     number;
  unitPrice:    number;
  freeSamples:  number;
}

export default function ImportHistoricalInvoicePage() {
  const router = useRouter();

  const [clients,  setClients]  = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const [formData, setFormData] = useState({
    invoiceNumber:  `HIST-${Date.now()}`,
    clientId:       '',
    invoiceDate:    new Date().toISOString().split('T')[0],
    dueDate:        new Date().toISOString().split('T')[0],
    status:         'PAID',
    paymentDate:    new Date().toISOString().split('T')[0],
    paymentMethod:  'CASH',
    historicalNote: '',
    notes:          '',
  });

  const [items, setItems] = useState<HistoricalItem[]>([
    {
      useExisting: false,
      productId:   '',
      productName: '',
      productSku:  '',
      quantity:    1,
      unitPrice:   0,
      freeSamples: 0,
    },
  ]);

  const [totals, setTotals] = useState({ subtotal: 0, grandTotal: 0 });

  useEffect(() => {
    fetchClients();
    fetchProducts();
  }, []);

  useEffect(() => {
    const subtotal = items.reduce((sum, item) => {
      const paid = (parseInt(String(item.quantity)) || 0) - (parseInt(String(item.freeSamples)) || 0);
      return sum + Math.max(paid, 0) * (parseFloat(String(item.unitPrice)) || 0);
    }, 0);
    setTotals({ subtotal, grandTotal: subtotal });
  }, [items]);

  const fetchClients = async () => {
    try {
      const res  = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res  = await fetch('/api/products?limit=1000');
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: string | boolean) => {
    const updated = [...items];

    if (field === 'useExisting') {

      updated[index] = {
        ...updated[index],
        useExisting:  value as boolean,
        productId:    '',
        productName:  '',
        productSku:   '',
        unitPrice:    0,
      };
    } else if (field === 'productId' && value) {

      const product = products.find((p) => p.id === value);
      if (product) {
        updated[index].productId   = product.id;
        updated[index].productName = product.name;
        updated[index].unitPrice   = product.price;
      }
    } else if (field === 'quantity' || field === 'freeSamples') {
      (updated[index] as any)[field] = parseInt(String(value)) || 0;
    } else if (field === 'unitPrice') {
      updated[index].unitPrice = parseFloat(String(value)) || 0;
    } else {
      (updated[index] as any)[field] = value;
    }

    setItems(updated);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        useExisting: false,
        productId:   '',
        productName: '',
        productSku:  '',
        quantity:    1,
        unitPrice:   0,
        freeSamples: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {

      if (!formData.clientId) throw new Error('Please select a client');
      if (!formData.invoiceDate || !formData.dueDate)
        throw new Error('Invoice date and due date are required');

      for (const item of items) {
        const name = item.useExisting ? item.productName : item.productName.trim();
        if (!name) throw new Error('Every item must have a product name');
        if ((parseInt(String(item.quantity)) || 0) < 1)
          throw new Error(`Quantity must be at least 1 for: ${name}`);
      }

      const payload = {
        invoiceNumber:  formData.invoiceNumber,
        clientId:       formData.clientId,
        invoiceDate:    formData.invoiceDate,
        dueDate:        formData.dueDate,
        status:         formData.status,
        historicalNote: formData.historicalNote || null,
        notes:          formData.notes          || null,

        payment:
          formData.status === 'PAID'
            ? {
                amount:      totals.grandTotal,
                method:      formData.paymentMethod,
                paymentDate: formData.paymentDate,
              }
            : undefined,
        items: items.map((item) => ({
          productId:    item.useExisting ? item.productId : null,
          productName:  item.productName.trim(),
          productSku:   item.productSku.trim() || null,
          quantity:     parseInt(String(item.quantity))    || 1,
          unitPrice:    parseFloat(String(item.unitPrice)) || 0,
          freeSamples:  parseInt(String(item.freeSamples)) || 0,
        })),
      };

      const res = await fetch('/api/invoices/historical', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Failed to import historical invoice');

      setSuccess(
        `Historical invoice ${result.invoiceNumber} imported successfully. Inventory was NOT affected.`
      );
      setTimeout(() => router.push('/invoices'), 2500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">

      {}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-4xl font-bold text-gray-900">Import Historical Invoice</h1>
          <div className="flex gap-3">
            <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <Link
              href="/invoices"
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Back to Invoices
            </Link>
          </div>
        </div>
        <p className="text-gray-600">
          Archive past invoices for reporting purposes.{' '}
          <strong>Inventory will not be affected.</strong>
        </p>
      </div>

      {}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">This is a Historical / Archived Invoice</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Appears in client history and all revenue reports</li>
              <li>Stock quantities will <strong>not</strong> be changed</li>
              <li>You can type product names freely for products no longer in your system</li>
              <li>Or toggle to link an item to an existing product</li>
            </ul>
          </div>
        </div>
      </div>

      {}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">

            {}
            <div>
              <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={handleFormChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Prefixed with HIST- to distinguish from live invoices
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client *
                  </label>
                  <select
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleFormChange}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Date * <span className="text-amber-600 text-xs">(original date)</span>
                  </label>
                  <input
                    type="date"
                    name="invoiceDate"
                    value={formData.invoiceDate}
                    onChange={handleFormChange}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleFormChange}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Unpaid</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                {formData.status === 'PAID' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        name="paymentDate"
                        value={formData.paymentDate}
                        onChange={handleFormChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        name="paymentMethod"
                        value={formData.paymentMethod}
                        onChange={handleFormChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="CASH">Cash</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Archive Note{' '}
                    <span className="text-gray-400 font-normal text-xs">
                      (why is this being imported?)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="historicalNote"
                    value={formData.historicalNote}
                    onChange={handleFormChange}
                    placeholder="e.g. Migrated from paper records — 2022 consignment sales"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              </div>
            </div>

            {}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Products / Line Items</h2>
                <button
                  type="button"
                  onClick={addItem}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border border-amber-200 bg-amber-50 rounded-lg p-4">

                    {}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Item #{index + 1}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs text-gray-500">
                          {item.useExisting ? 'Linked to existing product' : 'Free-text (archived product)'}
                        </span>
                        <div
                          role="checkbox"
                          aria-checked={item.useExisting}
                          onClick={() => handleItemChange(index, 'useExisting', !item.useExisting)}
                          className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors ${
                            item.useExisting ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              item.useExisting ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </label>
                    </div>

                    <div className="grid grid-cols-6 gap-3">

                      {}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Product *
                        </label>
                        {item.useExisting ? (
                          <select
                            value={item.productId}
                            onChange={(e) =>
                              handleItemChange(index, 'productId', e.target.value)
                            }
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (K{p.price})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. Amoxicillin 500mg"
                            value={item.productName}
                            onChange={(e) =>
                              handleItemChange(index, 'productName', e.target.value)
                            }
                            required
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        )}
                      </div>

                      {}
                      {!item.useExisting && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            SKU
                          </label>
                          <input
                            type="text"
                            placeholder="Optional"
                            value={item.productSku}
                            onChange={(e) =>
                              handleItemChange(index, 'productSku', e.target.value)
                            }
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      )}

                      {}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Qty *
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', e.target.value)
                          }
                          min="1"
                          required
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Price (K) *
                        </label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(index, 'unitPrice', e.target.value)
                          }
                          min="0"
                          step="0.01"
                          required
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Free
                        </label>
                        <input
                          type="number"
                          value={item.freeSamples}
                          onChange={(e) =>
                            handleItemChange(index, 'freeSamples', e.target.value)
                          }
                          min="0"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {}
                      <div className="flex items-end">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {}
                    {(item.productName || item.productId) && (
                      <div className="mt-2 text-xs text-gray-500">
                        Line total: K
                        {(
                          Math.max(
                            (parseInt(String(item.quantity)) || 0) -
                            (parseInt(String(item.freeSamples)) || 0),
                            0
                          ) * (parseFloat(String(item.unitPrice)) || 0)
                        ).toFixed(2)}
                        {item.freeSamples > 0 && ` · Free samples: ${item.freeSamples}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Link
                href="/invoices"
                className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-amber-300"
              >
                {loading ? 'Importing...' : 'Import Historical Invoice'}
              </button>
            </div>

          </form>
        </div>

        {}
        <div className="space-y-6">

          {}
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-bold">K{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-lg font-bold text-green-600">
                  K{totals.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Quick Stats</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Line items:</span>
                  <span>{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total qty:</span>
                  <span>
                    {items.reduce((s, i) => s + (parseInt(String(i.quantity)) || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Free samples:</span>
                  <span>
                    {items.reduce((s, i) => s + (parseInt(String(i.freeSamples)) || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3">What gets saved</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Invoice linked to client
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Full product-level line items
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Visible in all revenue reports
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Shows in client purchase history
              </li>
              <li className="flex items-start gap-2 text-red-600">
                <span className="font-bold">✗</span>
                <strong>Stock quantities NOT touched</strong>
              </li>
              <li className="flex items-start gap-2 text-red-600">
                <span className="font-bold">✗</span>
                <strong>No stock validation run</strong>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}