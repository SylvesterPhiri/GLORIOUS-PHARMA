'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function AddProductPage() {
  const router = useRouter();
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
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
    initialStock: '0',
    minStock: '10',
  });

  useEffect(() => {
    fetchManufacturers();
  }, []);

  const fetchManufacturers = async () => {
    try {
      const response = await fetch('/api/manufacturers');
      if (!response.ok) throw new Error('Failed to fetch manufacturers');
      const data = await response.json();
      setManufacturers(data);
    } catch (err) {
      console.error('Error fetching manufacturers:', err);
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
        name: formData.name,
        genericName: formData.genericName,
        type: formData.type,
        category: formData.category,
        manufacturerId: formData.manufacturerId,
        batchNumber: formData.batchNumber,
        expiryDate: formData.expiryDate,
        unit: formData.unit,
        price: parseFloat(formData.price) || 0,
        initialStock: parseInt(formData.initialStock) || 0,
        minStock: parseInt(formData.minStock) || 10,
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create product');
      }

      router.push('/inventory');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

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
            <span className="text-gray-600 font-medium">Add New</span>
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              Add New Medicine
            </h1>
            <p className="text-gray-600 mt-2">Add a new medicine to your inventory</p>
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

        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Left Column */}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Generic Name
                  </label>
                  <input
                    type="text"
                    name="genericName"
                    value={formData.genericName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="e.g., Acetaminophen"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    {productTypes.map(type => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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

              {/* Right Column */}
              <div className="space-y-6">
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    {units.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price (K) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">K</span>
                    </div>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      required
                      className="w-full pl-8 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      name="initialStock"
                      value={formData.initialStock}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Min Stock
                    </label>
                    <input
                      type="number"
                      name="minStock"
                      value={formData.minStock}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <Link
                href="/inventory"
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Save Medicine
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Important Information</h3>
              <p className="text-sm text-gray-600 mt-1">
                All fields marked with <span className="text-red-500">*</span> are required. 
                Make sure to double-check the expiry date and batch number before saving.
                The initial stock will be set as your current stock level.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}