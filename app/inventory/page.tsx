'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  type: string;
  category: string | null;
  initialStock: number;
  currentStock: number;
  minStock: number;
  reorderLevel: number;
  price: number;
  expiryDate: string;
  manufacturer: {
    name: string;
    motherCompany: string | null;
  } | null;
  stockStatus: 'LOW' | 'MEDIUM' | 'GOOD';
  isExpired: boolean;
  isExpiringSoon: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    fetchProducts(true);
  }, [pagination.page, search, lastRefresh, limit]);

  const fetchProducts = async (force = false) => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams({
        page: pagination.page.toString(),
        limit: limit.toString(),
        _t: force ? Date.now().toString() : '',
        ...(search && { search }),
      }).toString();

      const response = await fetch(`/api/products?${query}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch products');

      const data = await response.json();
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(true);
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'LOW': return 'text-red-600 bg-red-50 border border-red-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border border-yellow-200';
      case 'GOOD': return 'text-green-600 bg-green-50 border border-green-200';
      default: return 'text-gray-600 bg-gray-50 border border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      TABLET: 'bg-blue-100 text-blue-800',
      CAPSULE: 'bg-purple-100 text-purple-800',
      SYRUP: 'bg-green-100 text-green-800',
      INJECTION: 'bg-red-100 text-red-800',
      OINTMENT: 'bg-amber-100 text-amber-800',
      OTHER: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache' },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete product');

      setLastRefresh(Date.now());
      fetchProducts(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product');
      console.error('Delete error:', err);
    }
  };


  const handlePrintPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Glorious Pharma - Inventory</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        .low { color: #dc2626; font-weight: bold; }
        .medium { color: #d97706; font-weight: bold; }
        .good { color: #16a34a; font-weight: bold; }
        .header { display:flex; justify-content:space-between; margin-bottom:20px; border-bottom:2px solid #1e40af; padding-bottom:12px; }
        .company { font-size:20px; font-weight:bold; color:#1e40af; }
        .meta { font-size:11px; color:#666; margin-top:4px; }
      </style></head><body>
      <div class="header">
        <div><div class="company">GLORIOUS PHARMA.CO.LTD</div><div class="meta">Inventory Report</div></div>
        <div class="meta" style="text-align:right">Total: ${pagination.total} | Showing: ${products.length}</div>
      </div>
      <table><thead><tr>
        <th>#</th><th>Product Name</th><th>Generic Name</th><th>Type</th><th>Manufacturer</th>
        <th>Initial Stock</th><th>Current Stock</th><th>Price (K)</th><th>Expiry</th><th>Status</th>
      </tr></thead><tbody>
      ${products.map((p, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.genericName || '—'}</td>
        <td>${p.type?.toLowerCase() || '—'}</td>
        <td>${p.manufacturer?.name || '—'}${p.manufacturer?.motherCompany ? ` (${p.manufacturer.motherCompany})` : ''}</td>
        <td>${p.initialStock} units</td>
        <td class="${p.stockStatus.toLowerCase()}">${p.currentStock} units</td>
        <td>K${p.price.toFixed(2)}</td>
        <td>${new Date(p.expiryDate).toLocaleDateString()}</td>
        <td class="${p.stockStatus.toLowerCase()}">${p.stockStatus}</td>
      </tr>`).join('')}
      </tbody></table></body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header with Dashboard breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Inventory</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Inventory Management
              </h1>
              <p className="text-gray-600 mt-2">Track and manage your medicine stock</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrintPDF}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print / PDF
              </button>
              <button
                onClick={() => setLastRefresh(Date.now())}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <Link
                href="/inventory/add"
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Medicine
              </Link>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
          <form onSubmit={handleSearch}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search Products</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by name, generic name, or batch number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => { setSearch(''); fetchProducts(true); }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Product List</h2>
              <p className="text-sm text-gray-500 mt-1">Total {pagination.total} products found</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Show:</label>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPagination(p => ({ ...p, page: 1 })); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={99999}>All</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading products...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-600 text-lg mb-4">Error: {error}</p>
              <button
                onClick={() => fetchProducts(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
              >
                Retry
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">💊</div>
              <p className="text-gray-500 text-lg mb-4">No products found.</p>
              {search ? (
                <p className="text-gray-400">Try adjusting your search terms</p>
              ) : (
                <Link
                  href="/inventory/add"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Medicine
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Initial Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {product.genericName && <span>{product.genericName}</span>}
                          {product.manufacturer && (
                            <div className="text-xs text-gray-400">
                              {product.manufacturer.name}
                              {product.manufacturer.motherCompany && ` (${product.manufacturer.motherCompany})`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getTypeColor(product.type)}`}>
                          {product.type?.toLowerCase() || 'N/A'}
                        </span>
                        {product.category && (
                          <div className="text-xs text-gray-500 mt-1">{product.category}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{product.initialStock} units</div>
                        <div className="text-xs text-gray-500 mt-1">Original quantity</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStockColor(product.stockStatus)}`}>
                          <span className="w-2 h-2 rounded-full mr-1.5 bg-current"></span>
                          {product.currentStock} units
                        </span>
                        {product.currentStock <= product.minStock && (
                          <div className="text-xs text-red-600 mt-1">Below minimum</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        K{product.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center ${product.isExpired ? 'text-red-600' : product.isExpiringSoon ? 'text-yellow-600' : 'text-green-600'}`}>
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${
                            product.isExpired ? 'bg-red-600' : product.isExpiringSoon ? 'bg-yellow-600' : 'bg-green-600'
                          }`}></span>
                          {new Date(product.expiryDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <Link
                            href={`/inventory/${product.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </Link>
                          <Link
                            href={`/inventory/${product.id}/edit`}
                            className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
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
          )}
        </div>
      </div>
    </div>
  );
}