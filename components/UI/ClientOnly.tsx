// components/UI/ClientOnly.tsx
"use client"

import { ReactNode, useEffect, useState } from 'react'

interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
'@ | Out-File -FilePath components\UI\ClientOnly.tsx -Encoding utf8 -Force

echo "✅ Created ClientOnly component"

# Now update your inventory page
PS C:\glorious> Set-Content -Path "app\inventory\page.tsx" -Value @'
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClientOnly from '@/components/UI/ClientOnly';

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  type: string;
  category: string | null;
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
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    console.log('InventoryPage mounted, forcing fresh data load');
    fetchProducts(true);
  }, [pagination.page, search, lastRefresh]);

  const fetchProducts = async (force = false) => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        _t: force ? Date.now().toString() : '', // Cache busting parameter
        ...(search && { search }),
      }).toString();

      console.log('Fetching fresh product data...');
      const response = await fetch(`/api/inventory?${query}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();
      console.log(`Loaded ${data.products.length} products`);
      
      // Verify we have real product IDs
      data.products.forEach((p: Product, i: number) => {
        if (!p.id || p.id.length < 10) {
          console.error(`Invalid product ID at index ${i}:`, p.id);
        }
      });
      
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
      case 'LOW': return 'text-red-600 bg-red-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'GOOD': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleDelete = async (id: string, name: string) => {
    console.log('Attempting to delete:', { id, name });
    
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete product');
      }

      alert(`Product "${name}" deleted successfully!`);
      
      // Force complete refresh
      setLastRefresh(Date.now());
      fetchProducts(true);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete product';
      alert(errorMessage);
      console.error('Delete error:', err);
    }
  };

  const handleForceRefresh = () => {
    console.log('Manual force refresh triggered');
    setLastRefresh(Date.now());
  };

  // Don't render anything sensitive until mounted on client
  if (!hasMounted) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventory Management</h1>
        <div className="flex gap-3">
          <button
            onClick={handleForceRefresh}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Refresh Data
          </button>
          <Link
            href="/inventory/add"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add New Medicine
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Debug info - CLIENT ONLY */}
      <ClientOnly>
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            <strong>Debug:</strong> Last refresh: {new Date(lastRefresh).toLocaleTimeString()} | 
            Products loaded: {products.length} | 
            <button 
              onClick={() => {
                console.log('Current products:', products);
                navigator.clipboard.writeText(JSON.stringify(products.map(p => ({id: p.id, name: p.name})), null, 2));
                alert('Product data copied to console and clipboard');
              }}
              className="ml-2 text-blue-600 hover:underline"
            >
              View Data
            </button>
          </p>
        </div>
      </ClientOnly>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name, generic name, or batch number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => { setSearch(''); fetchProducts(true); }}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Clear
          </button>
        </form>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2">Loading fresh product data...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <p>Error: {error}</p>
            <button
              onClick={() => fetchProducts(true)}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No products found.</p>
            <Link href="/inventory/add" className="text-blue-600 hover:underline">
              Add your first medicine
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.category}</div>
                        <div className="text-xs text-gray-400">ID: {product.id.substring(0, 12)}...</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {product.type?.toLowerCase() || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockColor(product.stockStatus)}`}>
                          {product.currentStock}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">${product.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <ClientOnly>
                        <span className={`${product.isExpired ? 'text-red-600' : product.isExpiringSoon ? 'text-yellow-600' : 'text-green-600'}`}>
                          {new Date(product.expiryDate).toLocaleDateString()}
                        </span>
                      </ClientOnly>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/inventory/${product.id}`}
                          className="text-blue-600 hover:text-blue-900"
                          onClick={(e) => {
                            console.log('Navigating to product:', product.id);
                          }}
                        >
                          View
                        </Link>
                        <Link
                          href={`/inventory/${product.id}/edit`}
                          className="text-green-600 hover:text-green-900"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          className="text-red-600 hover:text-red-900"
                        >
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
  );
}