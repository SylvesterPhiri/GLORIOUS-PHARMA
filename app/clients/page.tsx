// app/clients/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchClients, deleteClient } from "@/src/lib/api";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company: string | null;
  type: 'INDIVIDUAL' | 'HOSPITAL' | 'PHARMACY' | 'COMPANY';
  creditLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientType, setClientType] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClients(searchTerm, clientType);
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [searchTerm, clientType]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this client?')) {
      return;
    }

    try {
      await deleteClient(id);
      await loadClients(); // Reload clients
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete client');
    }
  };

  const typeLabels = {
    INDIVIDUAL: 'Individual',
    HOSPITAL: 'Hospital',
    PHARMACY: 'Pharmacy',
    COMPANY: 'Company'
  };

  const typeColors = {
    INDIVIDUAL: 'bg-gray-100 text-gray-800',
    HOSPITAL: 'bg-blue-100 text-blue-800',
    PHARMACY: 'bg-green-100 text-green-800',
    COMPANY: 'bg-purple-100 text-purple-800'
  };

  // Calculate stats
  const totalClients = clients.length;
  const totalCredit = clients.reduce((sum, client) => sum + (client.creditLimit || 0), 0);
  const companies = clients.filter(c => c.type === 'COMPANY').length;
  const individuals = clients.filter(c => c.type === 'INDIVIDUAL').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header with Dashboard button */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Clients</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Clients
              </h1>
              <p className="text-gray-600 mt-2">Manage your customers, hospitals, and pharmacies</p>
            </div>
            <Link
              href="/clients/add"
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Client
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Clients</div>
                <div className="text-2xl font-bold text-gray-900">{totalClients}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Companies</div>
                <div className="text-2xl font-bold text-gray-900">{companies}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Individuals</div>
                <div className="text-2xl font-bold text-gray-900">{individuals}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-blue-100">Total Credit Limit</div>
                <div className="text-2xl font-bold">ZMW {totalCredit.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search Clients</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, email, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Type</label>
              <select
                value={clientType}
                onChange={(e) => setClientType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
              >
                <option value="all">All Types</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="HOSPITAL">Hospital</option>
                <option value="PHARMACY">Pharmacy</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center text-red-700">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Clients Table */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Client List</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading clients...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-gray-500 text-lg mb-4">No clients found. Add your first client!</p>
              <Link
                href="/clients/add"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Client
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit Limit
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{client.name}</div>
                        {client.company && (
                          <div className="text-sm text-gray-500 mt-1">{client.company}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${typeColors[client.type]}`}>
                          {typeLabels[client.type]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {client.email && (
                          <div className="text-sm text-gray-900 flex items-center">
                            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {client.email}
                          </div>
                        )}
                        {client.phone && (
                          <div className="text-sm text-gray-500 flex items-center mt-1">
                            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {client.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          ZMW {client.creditLimit?.toLocaleString() || '0'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <Link
                            href={`/clients/${client.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </Link>
                          <Link
                            href={`/clients/${client.id}?edit=true`}
                            className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(client.id)}
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