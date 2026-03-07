'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

enum ProductType {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  SYRUP = 'SYRUP',
  INJECTION = 'INJECTION',
  OINTMENT = 'OINTMENT',
  OTHER = 'OTHER'
}

interface Manufacturer {
  id: string;
  name: string;
  motherCompany: string | null;
}

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  type: ProductType;
  category: string | null;
  manufacturerId: string;
  batchNumber: string;
  expiryDate: string;
  unit: string;
  price: number;
  currentStock: number;
  minStock: number;
  reorderLevel?: number;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    type: ProductType.TABLET,
    category: '',
    manufacturerId: '',
    batchNumber: '',
    expiryDate: '',
    unit: 'pack',
    price: '0',
    currentStock: '0',
    minStock: '10',
    reorderLevel: '20',
  });

  useEffect(() => {
    if (id) {
      fetchManufacturers();
      fetchProduct();
    }
  }, [id]);

  const fetchManufacturers = async () => {
    try {
      const response = await fetch('/api/manufacturers');
      if (!response.ok) throw new Error('Failed to fetch manufacturers');
      const data = await response.json();
      setManufacturers(data);
    } catch (err) {
      console.error('Error fetching manufacturers:', err);
      setError('Failed to load manufacturers');
    }
  };

  const fetchProduct = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(`/api/products/${id}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
      }

      const product: Product = await response.json();

      let formattedDate = '';
      try {
        const expiryDate = new Date(product.expiryDate);
        formattedDate = expiryDate.toISOString().split('T')[0];
      } catch (dateError) {
        console.error('Error formatting date:', dateError);
        formattedDate = '';
      }

      setFormData({
        name: product.name || '',
        genericName: product.genericName || '',
        type: product.type || ProductType.TABLET,
        category: product.category || '',
        manufacturerId: product.manufacturerId || '',
        batchNumber: product.batchNumber || '',
        expiryDate: formattedDate,
        unit: product.unit || 'pack',
        price: (product.price !== undefined && product.price !== null) ? String(product.price) : '0',
        currentStock: (product.currentStock !== undefined && product.currentStock !== null) ? String(product.currentStock) : '0',
        minStock: (product.minStock !== undefined && product.minStock !== null) ? String(product.minStock) : '10',
        reorderLevel: (product.reorderLevel !== undefined && product.reorderLevel !== null) ? String(product.reorderLevel) : '20',
      });

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching product:', err);
      setError(err instanceof Error ? err.message : 'Failed to load product');
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) { setError('Medicine name is required'); return; }
    if (!formData.manufacturerId) { setError('Manufacturer is required'); return; }
    if (!formData.batchNumber.trim()) { setError('Batch number is required'); return; }
    if (!formData.expiryDate) { setError('Expiry date is required'); return; }

    try {
      setIsSaving(true);
      setError('');

      const productData = {
        name: formData.name.trim(),
        genericName: formData.genericName.trim() || null,
        type: formData.type,
        category: formData.category.trim() || null,
        manufacturerId: formData.manufacturerId,
        batchNumber: formData.batchNumber.trim(),
        expiryDate: formData.expiryDate,
        unit: formData.unit,
        price: parseFloat(formData.price) || 0,
        currentStock: parseInt(formData.currentStock) || 0,
        minStock: parseInt(formData.minStock) || 10,
        reorderLevel: parseInt(formData.reorderLevel) || 20,
      };

      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(productData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to update product');
      }

      router.push(`/inventory/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
      console.error('Error updating product:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const productTypes = Object.values(ProductType);
  const categories = [
    'Analgesic', 'Antibiotic', 'Antihistamine', 'Antacid', 'Antidepressant',
    'Antidiabetic', 'Antifungal', 'Antiviral', 'Cardiovascular', 'CNS',
    'Dermatological', 'Gastrointestinal', 'Hormonal', 'Respiratory', 'Vitamin'
  ];
  const units = ['pack', 'Tablets', 'Capsules', 'Bottles', 'Tubes', 'Strips', 'Boxes', 'Vials'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !formData.name) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Product</h2>
            <p className="text-red-700 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => fetchProduct()}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-pink-700 transition-all shadow-lg"
              >
                Retry
              </button>
              <Link href="/inventory" className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all">
                Back to Inventory
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

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
            <Link href="/inventory" className="text-blue-600 hover:text-blue-800">
              Inventory
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Edit Medicine</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Edit Medicine
              </h1>
              <p className="text-gray-600 mt-2">
                Product ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{id}</span>
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/inventory/${id}`}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left — Main fields */}
            <div className="lg:col-span-2 space-y-8">

              {/* Basic Information */}
              <div className="bg-white rounded-2xl shadow-2xl p-6">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Medicine Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="e.g., Paracetamol 500mg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Generic Name</label>
                    <input
                      type="text"
                      name="genericName"
                      value={formData.genericName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="e.g., Acetaminophen"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                      >
                        {productTypes.map(type => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="">Select category</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Manufacturer <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="manufacturerId"
                      value={formData.manufacturerId}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="">Select manufacturer</option>
                      {manufacturers.map(man => (
                        <option key={man.id} value={man.id}>
                          {man.name} {man.motherCompany ? `(${man.motherCompany})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Batch & Expiry */}
              <div className="bg-white rounded-2xl shadow-2xl p-6">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-100 to-teal-100 flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Batch & Expiry</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Batch Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="batchNumber"
                      value={formData.batchNumber}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="e.g., BATCH001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Expiry Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Stock & Pricing */}
              <div className="bg-white rounded-2xl shadow-2xl p-6">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-100 to-yellow-100 flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Stock & Pricing</h2>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Price (ZMW) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Unit</label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                      >
                        {units.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Current Stock</label>
                      <input
                        type="number"
                        name="currentStock"
                        value={formData.currentStock}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Min Stock</label>
                      <input
                        type="number"
                        name="minStock"
                        value={formData.minStock}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Reorder Level</label>
                      <input
                        type="number"
                        name="reorderLevel"
                        value={formData.reorderLevel}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right — Sidebar */}
            <div className="space-y-8">

              {/* Stock Overview card */}
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Stock Overview</h3>
                    <p className="text-blue-100 text-sm">Current inventory levels</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
                <div className="text-4xl font-bold mb-1">{formData.currentStock}</div>
                <div className="text-blue-100 text-sm mb-4">{formData.unit} in stock</div>
                {parseInt(formData.currentStock) <= parseInt(formData.minStock) ? (
                  <div className="bg-red-400/30 border border-red-300/50 rounded-xl px-3 py-2 text-sm text-red-100">
                    ⚠️ Below minimum stock level
                  </div>
                ) : (
                  <div className="bg-green-400/30 border border-green-300/50 rounded-xl px-3 py-2 text-sm text-green-100">
                    ✓ Stock level is healthy
                  </div>
                )}
              </div>

              {/* Quick Summary */}
              <div className="bg-white rounded-2xl shadow-2xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Summary</h3>
                <div className="space-y-4">
                  {[
                    {
                      label: 'Price',
                      value: `ZMW ${parseFloat(formData.price || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                      bg: 'bg-green-100', color: 'text-green-600'
                    },
                    {
                      label: 'Reorder At',
                      value: `${formData.reorderLevel} ${formData.unit}`,
                      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
                      bg: 'bg-yellow-100', color: 'text-yellow-600'
                    },
                    {
                      label: 'Min Stock',
                      value: `${formData.minStock} ${formData.unit}`,
                      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z',
                      bg: 'bg-red-100', color: 'text-red-600'
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className={`w-10 h-10 rounded-full ${stat.bg} flex items-center justify-center mr-3 flex-shrink-0`}>
                        <svg className={`w-5 h-5 ${stat.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">{stat.label}</div>
                        <div className="text-base font-bold text-gray-900">{stat.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-6 text-white">
                <h3 className="text-xl font-bold mb-6">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    href={`/inventory/${id}`}
                    className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                      <span>View Product</span>
                    </div>
                    <svg className="w-5 h-5 text-white/50 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    href="/inventory"
                    className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                      </div>
                      <span>All Inventory</span>
                    </div>
                    <svg className="w-5 h-5 text-white/50 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
