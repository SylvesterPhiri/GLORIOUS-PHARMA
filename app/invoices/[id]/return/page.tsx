'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
}

interface InvoiceItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: Product;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  client: Client;
  items: InvoiceItem[];
}

interface ReturnItem {
  productId: string;
  productName: string;
  maxQuantity: number;
  quantity: number;
  reason: string;
  price: number;
}

export default function ReturnInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  useEffect(() => {
    if (invoice && invoice.items) {
      setReturnItems(
        invoice.items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          maxQuantity: item.quantity,
          quantity: 0,
          reason: '',
          price: item.unitPrice,
        }))
      );
    }
  }, [invoice]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const data = await response.json();
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
      console.error('Error fetching invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...returnItems];
    const numValue = parseInt(value) || 0;
    newItems[index].quantity = Math.max(
      0,
      Math.min(numValue, newItems[index].maxQuantity)
    );
    setReturnItems(newItems);
  };

  const handleReasonChange = (index: number, value: string) => {
    const newItems = [...returnItems];
    newItems[index].reason = value;
    setReturnItems(newItems);
  };

  const calculateReturnTotal = () => {
    return returnItems.reduce((sum, item) => {
      return sum + item.quantity * item.price;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const itemsToReturn = returnItems.filter((item) => item.quantity > 0);

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToReturn.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            reason: item.reason,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process return');
      }

      setSuccess('Return processed successfully! Redirecting...');

      setTimeout(() => {
        router.push(`/invoices/${id}`);
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process return');
      console.error('Error processing return:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Invoice Not Found</h2>
          <p className="text-red-700 mb-4">
            {error || 'The requested invoice could not be found.'}
          </p>
          <Link
            href="/invoices"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block"
          >
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Process Return for Invoice #{invoice.invoiceNumber}
        </h1>
        <p className="text-gray-600">Client: {invoice.client.name}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Select Items to Return</h2>

          {returnItems.length === 0 ? (
            <p className="text-gray-500">No items available for return.</p>
          ) : (
            <div className="space-y-4">
              {returnItems.map((item, index) => (
                <div key={item.productId} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-medium text-gray-900">{item.productName}</span>
                      <div className="text-sm text-gray-600">
                        Price: K{item.price.toFixed(2)} per unit
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">
                        Available to return: {item.maxQuantity}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity to Return
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={item.maxQuantity}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                      {item.quantity > 0 && (
                        <p className="mt-1 text-sm text-gray-600">
                          Return value: K{(item.quantity * item.price).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason (Optional)
                      </label>
                      <input
                        type="text"
                        value={item.reason}
                        onChange={(e) => handleReasonChange(index, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Damaged, Wrong item"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {}
        {returnItems.some((item) => item.quantity > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-4">Return Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-800">Items to return:</span>
                <span className="font-medium text-blue-900">
                  {returnItems.filter((item) => item.quantity > 0).length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-800">Total units:</span>
                <span className="font-medium text-blue-900">
                  {returnItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-blue-300">
                <span className="text-blue-900">Return Amount:</span>
                <span className="text-blue-900">K{calculateReturnTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-800">New Invoice Total:</span>
                <span className="font-medium text-blue-900">
                  K{(invoice.totalAmount - calculateReturnTotal()).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between gap-3">
          <Link
            href={`/invoices/${id}`}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed"
            disabled={
              submitting ||
              returnItems.length === 0 ||
              !returnItems.some((item) => item.quantity > 0)
            }
          >
            {submitting ? 'Processing...' : 'Process Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
