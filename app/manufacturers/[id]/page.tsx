'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Manufacturer } from '@/types';

export default function ManufacturerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [manufacturer, setManufacturer] = useState<Manufacturer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchManufacturer();
  }, [id]);

  const fetchManufacturer = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/manufacturers/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch manufacturer');
      }
      const data = await response.json();
      setManufacturer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      console.error('Error fetching manufacturer:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this manufacturer?')) {
      return;
    }

    try {
      const response = await fetch(`/api/manufacturers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete manufacturer');
      }

      router.push('/manufacturers');
      router.refresh();
    } catch (err) {
      alert('Failed to delete manufacturer');
      console.error('Delete error:', err);
    }
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

  if (!manufacturer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">🏭</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Manufacturer Not Found</h1>
          <Link href="/manufacturers" className="text-blue-600 hover:text-blue-800">
            ← Back to Manufacturers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

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
            <Link href="/manufacturers" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Manufacturers
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">{manufacturer.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                {manufacturer.name}
              </h1>
              <p className="text-gray-600 mt-2">Manufacturer ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{manufacturer.id}</span></p>
            </div>

            <div className="flex space-x-3">
              <Link
                href={`/manufacturers/${id}/edit`}
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

        {}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          
          {}
          <div className="flex items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center mr-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Manufacturer Information</h2>
          </div>

          {}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl">
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Company Name</div>
                  <div className="text-lg font-semibold text-gray-900">{manufacturer.name}</div>
                  {manufacturer.motherCompany && (
                    <div className="text-sm text-gray-600 mt-1">Parent: {manufacturer.motherCompany}</div>
                  )}
                </div>
              </div>
            </div>

            {manufacturer.contactPerson && (
              <div className="bg-gradient-to-r from-green-50 to-gray-50 p-5 rounded-xl">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Contact Person</div>
                    <div className="text-lg font-semibold text-gray-900">{manufacturer.contactPerson}</div>
                  </div>
                </div>
              </div>
            )}

            {manufacturer.email && (
              <div className="bg-gradient-to-r from-purple-50 to-gray-50 p-5 rounded-xl">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Email</div>
                    <a href={`mailto:${manufacturer.email}`} className="text-lg font-semibold text-gray-900 hover:text-purple-600">
                      {manufacturer.email}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {manufacturer.phone && (
              <div className="bg-gradient-to-r from-amber-50 to-gray-50 p-5 rounded-xl">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Phone</div>
                    <a href={`tel:${manufacturer.phone}`} className="text-lg font-semibold text-gray-900 hover:text-amber-600">
                      {manufacturer.phone}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {manufacturer.location && (
              <div className="bg-gradient-to-r from-indigo-50 to-gray-50 p-5 rounded-xl">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Location</div>
                    <div className="text-lg font-semibold text-gray-900">{manufacturer.location}</div>
                  </div>
                </div>
              </div>
            )}

            {manufacturer.address && (
              <div className="md:col-span-2 bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Full Address</div>
                    <div className="text-lg font-semibold text-gray-900 whitespace-pre-line">{manufacturer.address}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {}
          <div className="mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Created: {new Date(manufacturer.createdAt).toLocaleDateString()} at {new Date(manufacturer.createdAt).toLocaleTimeString()}
            </div>
            <div className="text-sm text-gray-500 text-right">
              Last Updated: {new Date(manufacturer.updatedAt).toLocaleDateString()} at {new Date(manufacturer.updatedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}