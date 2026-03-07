// app/clients/[id]/page.tsx
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchClient, updateClient, deleteClient } from '@/src/lib/api';

interface Invoice {
  id: string; invoiceNumber: string; invoiceDate: string;
  dueDate: string; status: string; total: number;
}

export default function ClientDetailPage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const clientId     = params.id as string;
  const isEditMode   = searchParams.get('edit') === 'true';

  const [client,    setClient]    = useState<any>(null);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [isEditing, setIsEditing] = useState(isEditMode);

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '',
    company: '', type: 'INDIVIDUAL', creditLimit: '0',
  });

  useEffect(() => { loadClient(); }, [clientId]);

  const loadClient = async () => {
    try {
      setLoading(true);
      const data = await fetchClient(clientId);
      if (data) {
        setClient(data);
        setFormData({
          name:        data.name,
          email:       data.email       || '',
          phone:       data.phone       || '',
          address:     data.address     || '',
          company:     data.company     || '',
          type:        data.type,
          creditLimit: data.creditLimit?.toString() || '0',
        });
        // Fetch real invoices for this client
        fetchClientInvoices(data.name);
      }
    } catch (error) {
      console.error('Error loading client:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientInvoices = async (clientName: string) => {
    try {
      const res  = await fetch(`/api/invoices?limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      const all: Invoice[] = data.invoices ?? [];
      // Filter to only this client's invoices
      const mine = all.filter((inv: any) => inv.client?.name === clientName || inv.clientId === clientId);
      setInvoices(mine);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { alert('Client name is required'); return; }
    setSaving(true);
    try {
      await updateClient(clientId, {
        name:        formData.name,
        email:       formData.email    || undefined,
        phone:       formData.phone    || undefined,
        address:     formData.address  || undefined,
        company:     formData.company  || undefined,
        type:        formData.type,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
      });
      setIsEditing(false);
      await loadClient();
      router.replace(`/clients/${clientId}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    setLoading(true);
    try {
      await deleteClient(clientId);
      router.push('/clients');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete client');
      setLoading(false);
    }
  };

  // Real stats from actual invoices
  const totalInvoices  = invoices.length;
  const totalPurchase  = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const outstanding    = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const creditLimit    = parseFloat(client?.creditLimit || '0') || 0;
  const creditUsedPct  = creditLimit > 0 ? Math.min((outstanding / creditLimit) * 100, 100) : 0;

  const statusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':      return 'bg-green-100 text-green-800';
      case 'PENDING':   return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE':   return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-500';
      default:          return 'bg-gray-100 text-gray-700';
    }
  };
  const statusLabel = (status: string) => {
    const map: Record<string, string> = { PENDING: 'Unpaid', PAID: 'Paid', OVERDUE: 'Overdue', CANCELLED: 'Cancelled', DRAFT: 'Draft' };
    return map[status.toUpperCase()] ?? status;
  };

  if (loading && !client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"/>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 text-4xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Client Not Found</h1>
        <Link href="/clients" className="text-blue-600 hover:text-blue-800">← Back to Clients</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link href="/clients" className="text-blue-600 hover:text-blue-800 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Clients
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">{client.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                {isEditing ? 'Edit Client' : client.name}
              </h1>
              <p className="text-gray-600 mt-2">Client ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{client.id}</span></p>
            </div>

            <div className="flex space-x-3">
              {!isEditing ? (
                <>
                  <button onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button onClick={handleDelete}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-pink-700 transition-all shadow-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setIsEditing(false); setFormData({ name: client.name, email: client.email || '', phone: client.phone || '', address: client.address || '', company: client.company || '', type: client.type, creditLimit: client.creditLimit?.toString() || '0' }); }}
                    className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2">
                    {saving ? (
                      <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Save Changes</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left — Client info */}
          <div className="lg:col-span-2 space-y-8">

            {/* Client Information */}
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Client Information</h2>
              </div>

              {isEditing ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Client Name <span className="text-red-500">*</span></label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="Enter client name" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Client Type</label>
                      <select name="type" value={formData.type} onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all">
                        <option value="INDIVIDUAL">Individual</option>
                        <option value="HOSPITAL">Hospital</option>
                        <option value="PHARMACY">Pharmacy</option>
                        <option value="COMPANY">Company</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Company/Organization</label>
                      <input type="text" name="company" value={formData.company} onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Optional" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{client.name}</div>
                      {client.company && <div className="text-gray-600 mt-1">{client.company}</div>}
                    </div>
                    <span className={`px-4 py-2 rounded-full font-semibold text-sm ${
                      client.type === 'HOSPITAL'  ? 'bg-blue-100 text-blue-800'   :
                      client.type === 'PHARMACY'  ? 'bg-green-100 text-green-800' :
                      client.type === 'COMPANY'   ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{client.type.charAt(0) + client.type.slice(1).toLowerCase()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-4 rounded-xl">
                      <div className="text-sm text-gray-500">Created</div>
                      <div className="font-semibold text-gray-900">{new Date(client.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-gray-50 p-4 rounded-xl">
                      <div className="text-sm text-gray-500">Last Updated</div>
                      <div className="font-semibold text-gray-900">{new Date(client.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-100 to-teal-100 flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Contact Information</h2>
              </div>

              {isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="client@example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="+260 123 456 789" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                    <textarea name="address" value={formData.address} onChange={handleChange} rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                      placeholder="Full address" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!client.email && !client.phone && !client.address ? (
                    <p className="text-gray-400 text-sm italic">No contact information on file.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {client.email && (
                        <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-4 rounded-xl">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <div>
                              <div className="text-xs text-gray-500">Email</div>
                              <a href={`mailto:${client.email}`} className="font-semibold text-gray-900 hover:text-blue-600">{client.email}</a>
                            </div>
                          </div>
                        </div>
                      )}
                      {client.phone && (
                        <div className="bg-gradient-to-r from-green-50 to-gray-50 p-4 rounded-xl">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <div>
                              <div className="text-xs text-gray-500">Phone</div>
                              <a href={`tel:${client.phone}`} className="font-semibold text-gray-900 hover:text-green-600">{client.phone}</a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {client.address && (
                    <div className="bg-gradient-to-r from-purple-50 to-gray-50 p-4 rounded-xl">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-purple-500 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div>
                          <div className="text-xs text-gray-500">Address</div>
                          <div className="font-semibold text-gray-900 whitespace-pre-line">{client.address}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right — Stats */}
          <div className="space-y-8">

            {/* Credit Limit card */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Credit Limit</h3>
                  <p className="text-blue-100 text-sm">Available credit for purchases</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              {isEditing ? (
                <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange} min="0" step="100"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50"
                  placeholder="Enter credit limit" />
              ) : (
                <div>
                  <div className="text-3xl font-bold mb-2">ZMW {(creditLimit).toLocaleString()}</div>
                  <div className="text-blue-100 text-sm mb-4">{creditLimit > 0 ? 'Credit terms enabled' : 'No credit limit set'}</div>
                  {creditLimit > 0 && (
                    <>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Outstanding vs Limit</span>
                        <span>{creditUsedPct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div className={`h-2 rounded-full ${creditUsedPct > 80 ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ width: `${creditUsedPct}%` }} />
                      </div>
                      <div className="text-xs text-blue-100 mt-2">
                        ZMW {outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })} outstanding of ZMW {creditLimit.toLocaleString()}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Real Quick Stats */}
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Stats</h3>
              <div className="space-y-4">
                {[
                  { label: 'Total Invoices',  value: String(totalInvoices), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', bg: 'bg-blue-100', color: 'text-blue-600' },
                  { label: 'Total Paid',      value: `ZMW ${totalPurchase.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-green-100', color: 'text-green-600' },
                  { label: 'Outstanding',     value: `ZMW ${outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z', bg: 'bg-red-100', color: 'text-red-600' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-10 h-10 rounded-full ${stat.bg} flex items-center justify-center mr-3`}>
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
                <Link href="/invoices/add"
                  className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all group">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span>Create Invoice</span>
                  </div>
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link href={`/invoices?client=${clientId}`}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all group">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span>View All Invoices</span>
                  </div>
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices — real data */}
        <div className="mt-12 bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Recent Invoices</h2>
            <Link href="/invoices" className="text-blue-600 hover:text-blue-800 font-medium">View all →</Link>
          </div>

          {invoices.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📄</p>
              <p className="font-medium">No invoices yet for this client.</p>
              <Link href="/invoices/add" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Create first invoice →</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Invoice #', 'Date', 'Due Date', 'Amount', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.slice(0, 10).map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-gray-900">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">ZMW {inv.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(inv.status)}`}>
                          {statusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-sm">View</Link>
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
