'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ProductType } from '@/types';

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  type: ProductType;
  category: string | null;
  batchNumber: string;
  expiryDate: string;
  unit: string;
  price: number;
  initialStock: number;
  currentStock: number;
  minStock: number;
  reorderLevel: number;
  createdAt: string;
  updatedAt: string;
  manufacturer: {
    id: string;
    name: string;
    motherCompany: string | null;
  } | null;
  stockStatus: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchProduct(); }, [id]);

  const fetchProduct = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      const data = await response.json();
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete product');
      }
      router.push('/inventory');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'LOW': return 'bg-red-100 text-red-800 border border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'GOOD': return 'bg-green-100 text-green-800 border border-green-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getProductTypeLabel = (type: ProductType) => {
    const labels = {
      TABLET: 'Tablet', CAPSULE: 'Capsule', SYRUP: 'Syrup',
      INJECTION: 'Injection', OINTMENT: 'Ointment', OTHER: 'Other'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: ProductType) => {
    const colors = {
      TABLET: 'bg-blue-100 text-blue-800',
      CAPSULE: 'bg-purple-100 text-purple-800',
      SYRUP: 'bg-green-100 text-green-800',
      INJECTION: 'bg-red-100 text-red-800',
      OINTMENT: 'bg-amber-100 text-amber-800',
      OTHER: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto bg-red-50 border-2 border-red-200 rounded-2xl p-6">
          <div className="flex items-center text-red-700">
            <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">💊</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Product Not Found</h1>
          <Link href="/inventory" className="text-blue-600 hover:text-blue-800">
            ← Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/inventory" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Inventory
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">{product.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                {product.name}
              </h1>
              <p className="text-gray-600 mt-2">
                {product.genericName && <span>Generic: {product.genericName} • </span>}
                Product ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{product.id}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/inventory/${id}/edit`}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
              <button
                onClick={handleDelete}
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

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Basic Info */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Product Information</h2>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Type</div>
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getTypeColor(product.type)}`}>
                      {getProductTypeLabel(product.type)}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Category</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{product.category || 'N/A'}</div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Batch Number</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{product.batchNumber}</div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Unit</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{product.unit}</div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Manufacturer</div>
                  <div className="mt-1">
                    {product.manufacturer ? (
                      <>
                        <div className="text-lg font-semibold text-gray-900">{product.manufacturer.name}</div>
                        {product.manufacturer.motherCompany && (
                          <div className="text-sm text-gray-500">({product.manufacturer.motherCompany})</div>
                        )}
                      </>
                    ) : 'N/A'}
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Price</div>
                  <div className="mt-1 text-2xl font-bold text-blue-600">K{product.price.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Stock Information */}
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Stock Information</h2>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Current Stock</div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${getStockColor(product.stockStatus)}`}>
                        <span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
                        {product.currentStock} units
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Initial Stock</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{product.initialStock}</div>
                    </div>
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Minimum Stock</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{product.minStock}</div>
                    </div>
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Reorder Level</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{product.reorderLevel}</div>
                    </div>
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Sold</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {product.initialStock - product.currentStock}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                  {product.stockStatus === 'LOW' && (
                    <div className="text-center">
                      <div className="text-5xl mb-3">⚠️</div>
                      <p className="text-red-600 font-semibold">Stock is below minimum level!</p>
                      <p className="text-sm text-gray-600 mt-2">Time to reorder</p>
                    </div>
                  )}
                  {product.stockStatus === 'MEDIUM' && (
                    <div className="text-center">
                      <div className="text-5xl mb-3">📊</div>
                      <p className="text-yellow-600 font-semibold">Stock is at medium level</p>
                      <p className="text-sm text-gray-600 mt-2">Consider restocking soon</p>
                    </div>
                  )}
                  {product.stockStatus === 'GOOD' && (
                    <div className="text-center">
                      <div className="text-5xl mb-3">✅</div>
                      <p className="text-green-600 font-semibold">Stock level is good</p>
                      <p className="text-sm text-gray-600 mt-2">No action needed</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-100 to-yellow-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Expiry Information</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Expiry Date</div>
                  <div className={`mt-1 text-2xl font-bold ${
                    product.isExpired ? 'text-red-600' : product.isExpiringSoon ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {new Date(product.expiryDate).toLocaleDateString()}
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${
                  product.isExpired ? 'bg-red-50 border border-red-200' : 
                  product.isExpiringSoon ? 'bg-yellow-50 border border-yellow-200' : 
                  'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      product.isExpired ? 'bg-red-600' : 
                      product.isExpiringSoon ? 'bg-yellow-600' : 
                      'bg-green-600'
                    }`}></span>
                    <span className={`font-medium ${
                      product.isExpired ? 'text-red-700' : 
                      product.isExpiringSoon ? 'text-yellow-700' : 
                      'text-green-700'
                    }`}>
                      {product.isExpired ? 'Expired' : 
                       product.isExpiringSoon ? 'Expiring within 30 days' : 
                       'Valid'}
                    </span>
                  </div>
                </div>

                {product.isExpired && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-700">
                      This product has expired and should not be sold or used.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Timeline</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Created On</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {new Date(product.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Time</div>
                      <div className="text-sm text-gray-600">
                        {new Date(product.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Last Updated</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {new Date(product.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Time</div>
                      <div className="text-sm text-gray-600">
                        {new Date(product.updatedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href={`/invoices/add?product=${id}`}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span>Sell This Product</span>
                  </div>
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                <Link
                  href={`/inventory/${id}/edit`}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <span>Edit Product</span>
                  </div>
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                <button
                  onClick={handleDelete}
                  className="w-full flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <span>Delete Product</span>
                  </div>
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}