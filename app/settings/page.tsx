'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface User {
  id: string; name: string; email: string; role: string;
  isActive: boolean; createdAt: string;
}

interface SystemSettings {
  companyName: string; currency: string; taxRate: string;
  invoicePrefix: string; lowStockDefault: string; timezone: string; logoUrl: string;
}

type Tab = 'profile' | 'general' | 'users' | 'danger';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'PHARMACIST', 'SALES_REP', 'ACCOUNTANT'];

const ALL_PERMISSIONS = [
  { key: 'invoices.view',       label: 'Invoices — View'         },
  { key: 'invoices.create',     label: 'Invoices — Create'       },
  { key: 'invoices.edit',       label: 'Invoices — Edit'         },
  { key: 'invoices.delete',     label: 'Invoices — Delete'       },
  { key: 'clients.view',        label: 'Clients — View'          },
  { key: 'clients.create',      label: 'Clients — Create'        },
  { key: 'clients.edit',        label: 'Clients — Edit'          },
  { key: 'clients.delete',      label: 'Clients — Delete'        },
  { key: 'inventory.view',      label: 'Inventory — View'        },
  { key: 'inventory.create',    label: 'Inventory — Create'      },
  { key: 'inventory.edit',      label: 'Inventory — Edit'        },
  { key: 'inventory.delete',    label: 'Inventory — Delete'      },
  { key: 'manufacturers.view',  label: 'Manufacturers — View'    },
  { key: 'manufacturers.edit',  label: 'Manufacturers — Edit'    },
  { key: 'reports.view',        label: 'Reports — View'          },
  { key: 'accounting.view',     label: 'Accounting — View'       },
  { key: 'accounting.edit',     label: 'Accounting — Edit'       },
  { key: 'users.view',          label: 'Users — View'            },
  { key: 'users.manage',        label: 'Users — Manage'          },
  { key: 'settings.view',       label: 'Settings — View'         },
  { key: 'settings.edit',       label: 'Settings — Edit'         },
  { key: 'audit.view',          label: 'Audit Log — View'        },
  { key: 'returns.view',        label: 'Returns — View'          },
  { key: 'returns.process',     label: 'Returns — Process'       },
];

const DEFAULT_PERMS_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS.map(p => p.key),
  ADMIN:       ['invoices.view','invoices.create','invoices.edit','invoices.delete','clients.view','clients.create','clients.edit','clients.delete','inventory.view','inventory.create','inventory.edit','inventory.delete','manufacturers.view','manufacturers.edit','reports.view','accounting.view','accounting.edit','users.view','returns.view','returns.process'],
  PHARMACIST:  ['invoices.view','invoices.create','inventory.view','clients.view','returns.view','returns.process'],
  SALES_REP:   ['invoices.view','invoices.create','clients.view','clients.create','clients.edit','inventory.view','returns.view'],
  ACCOUNTANT:  ['invoices.view','accounting.view','accounting.edit','reports.view','audit.view','returns.view'],
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN:       'bg-blue-100 text-blue-800',
  PHARMACIST:  'bg-green-100 text-green-800',
  SALES_REP:   'bg-orange-100 text-orange-800',
  ACCOUNTANT:  'bg-yellow-100 text-yellow-800',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const [profile, setProfile] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileLoading,  setProfileLoading]  = useState(true);
  const [profileSaving,   setProfileSaving]   = useState(false);
  const [profileError,    setProfileError]    = useState('');
  const [profileSuccess,  setProfileSuccess]  = useState('');
  const [currentUserId,   setCurrentUserId]   = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');

  const [settings, setSettings] = useState<SystemSettings>({
    companyName: 'GloriousPharma', currency: 'ZMW', taxRate: '0',
    invoicePrefix: 'INV', lowStockDefault: '10', timezone: 'Africa/Lusaka', logoUrl: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings,  setSavingSettings]  = useState(false);
  const [settingsSaved,   setSettingsSaved]   = useState(false);
  const [settingsError,   setSettingsError]   = useState('');
  const [logoUploading,   setLogoUploading]   = useState(false);
  const [logoError,       setLogoError]       = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [users,           setUsers]           = useState<User[]>([]);
  const [usersLoading,    setUsersLoading]    = useState(false);
  const [showUserForm,    setShowUserForm]    = useState(false);
  const [editingUser,     setEditingUser]     = useState<User | null>(null);
  const [showPerms,       setShowPerms]       = useState<User | null>(null);
  const [userPerms,       setUserPerms]       = useState<string[]>([]);
  const [permsSaving,     setPermsSaving]     = useState(false);
  const [permsError,      setPermsError]      = useState('');
  const [userForm,        setUserForm]        = useState({ name: '', email: '', role: 'PHARMACIST', password: '', confirmPassword: '' });
  const [userFormError,   setUserFormError]   = useState('');
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [deleteConfirm,   setDeleteConfirm]   = useState<User | null>(null);

  const [dangerConfirm, setDangerConfirm] = useState<'audit' | 'reset' | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerMessage, setDangerMessage] = useState('');

  useEffect(() => { loadSettings(); loadProfile(); }, []);
  useEffect(() => { if (activeTab === 'users') fetchUsers(); }, [activeTab]);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setProfile(p => ({ ...p, name: data.name ?? '', email: data.email ?? '' }));
        setCurrentUserId(data.id ?? '');
        setCurrentUserRole(data.role ?? '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError(''); setProfileSuccess('');
    if (!profile.name.trim() || !profile.email.trim()) { setProfileError('Name and email are required.'); return; }
    if (profile.newPassword) {
      if (!profile.currentPassword)             { setProfileError('Enter your current password to set a new one.'); return; }
      if (profile.newPassword.length < 6)       { setProfileError('New password must be at least 6 characters.'); return; }
      if (profile.newPassword !== profile.confirmPassword) { setProfileError('New passwords do not match.'); return; }
    }
    setProfileSaving(true);
    try {
      const body: any = { name: profile.name.trim(), email: profile.email.trim() };
      if (profile.newPassword) { body.currentPassword = profile.currentPassword; body.password = profile.newPassword; }
      const res  = await fetch(`/api/users/${currentUserId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setProfileSuccess('Profile updated successfully!');
      setProfile(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) { const data = await res.json(); if (data.settings) setSettings(data.settings); }
    } catch (err) { console.error(err); }
    finally { setSettingsLoading(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true); setSettingsError('');
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (!res.ok) throw new Error('Failed to save');
      setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000);
    } catch { setSettingsError('Failed to save settings. Try again.'); }
    finally { setSavingSettings(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoUploading(true); setLogoError('');
    try {
      const fd = new FormData(); fd.append('logo', file);
      const res  = await fetch('/api/settings/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSettings(p => ({ ...p, logoUrl: data.logoUrl }));
    } catch (err: any) { setLogoError(err.message); }
    finally { setLogoUploading(false); }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) { const data = await res.json(); setUsers(data.users ?? []); }
    } catch (err) { console.error(err); }
    finally { setUsersLoading(false); }
  };

  const handleUserSubmit = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) { setUserFormError('Name and email required.'); return; }
    if (!editingUser && !userForm.password.trim())        { setUserFormError('Password required for new users.'); return; }
    if (userForm.password && userForm.password !== userForm.confirmPassword) { setUserFormError('Passwords do not match.'); return; }
    setUserFormLoading(true); setUserFormError('');
    try {
      const url    = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const body: any = { name: userForm.name, email: userForm.email, role: userForm.role };
      if (userForm.password) body.password = userForm.password;
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setShowUserForm(false); fetchUsers();
    } catch (err: any) { setUserFormError(err.message); }
    finally { setUserFormLoading(false); }
  };

  const handleDeactivate = async (user: User) => {
    try { await fetch(`/api/users/${user.id}`, { method: 'DELETE' }); setDeleteConfirm(null); fetchUsers(); }
    catch (err) { console.error(err); }
  };

  const handleDangerAction = async (action: 'audit' | 'reset') => {
    setDangerLoading(true); setDangerMessage('');
    try {
      const res  = await fetch('/api/settings/danger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action === 'audit' ? 'clear_audit_logs' : 'reset_data' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setDangerMessage(data.message); setDangerConfirm(null);
    } catch (err: any) { setDangerMessage('Error: ' + err.message); }
    finally { setDangerLoading(false); }
  };

  const openPermsModal = async (user: User) => {
    setShowPerms(user);
    setPermsError('');

    try {
      const res = await fetch(`/api/users/${user.id}/permissions`);
      if (res.ok) {
        const data = await res.json();
        setUserPerms(data.permissions || []);
      } else {
        setPermsError('Failed to load permissions. Please try again.');
        setUserPerms([]);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setPermsError('Failed to load permissions. Please try again.');
      setUserPerms([]);
    }
  };

  const handleSavePerms = async () => {
    if (!showPerms) return;
    setPermsSaving(true); setPermsError('');
    try {
      const res  = await fetch(`/api/users/${showPerms.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: userPerms }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save permissions');
      setShowPerms(null);
    } catch (err: any) { setPermsError(err.message); }
    finally { setPermsSaving(false); }
  };

  const togglePerm = (key: string) => setUserPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);

  const userStats = {
    total: users.length, active: users.filter(u => u.isActive).length,
    admins: users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN').length,
    pharmacists: users.filter(u => u.role === 'PHARMACIST').length,
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile', label: '👤 My Profile'    },
    { id: 'general', label: 'General Settings' },
    { id: 'users',   label: 'User Management'  },
    { id: 'danger',  label: '⚠ Danger Zone'    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">System configuration and user management</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Dashboard</Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              } ${tab.id === 'danger' ? '!text-red-500' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {}
          {activeTab === 'profile' && (
            <div className="max-w-lg space-y-8">
              {profileLoading ? (
                <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/></div>
              ) : (
                <>
                  {}
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0">
                      {profile.name.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg">{profile.name || 'Your Name'}</div>
                      <div className="text-sm text-gray-500">{profile.email}</div>
                      <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_COLORS[currentUserRole] ?? 'bg-gray-100 text-gray-700'}`}>
                        {currentUserRole}
                      </span>
                    </div>
                  </div>

                  {}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Account Information</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input type="text" value={profile.name} onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Your full name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input type="email" value={profile.email} onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="you@example.com" />
                    </div>
                  </div>

                  {}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">
                      Change Password <span className="text-gray-400 font-normal text-xs">(leave blank to keep current)</span>
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                      <input type="password" value={profile.currentPassword} onChange={(e) => setProfile(p => ({ ...p, currentPassword: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter current password" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input type="password" value={profile.newPassword} onChange={(e) => setProfile(p => ({ ...p, newPassword: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Min 6 characters" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input type="password" value={profile.confirmPassword} onChange={(e) => setProfile(p => ({ ...p, confirmPassword: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Repeat new password" />
                    </div>
                  </div>

                  {profileError   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{profileError}</p>}
                  {profileSuccess && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">✓ {profileSuccess}</p>}

                  <button onClick={handleSaveProfile} disabled={profileSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium">
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </>
              )}
            </div>
          )}

          {}
          {activeTab === 'general' && (
            <div className="max-w-xl space-y-6">
              {settingsLoading ? (
                <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/></div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Logo</h3>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
                        {settings.logoUrl ? <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <span className="text-2xl text-gray-300">🏥</span>}
                      </div>
                      <div>
                        <input ref={logoInputRef} type="file" accept="image}
          {activeTab === 'users' && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Users', value: userStats.total },
                  { label: 'Active',      value: userStats.active },
                  { label: 'Admins',      value: userStats.admins },
                  { label: 'Pharmacists', value: userStats.pharmacists },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900">User Accounts</h2>
                <div className="flex gap-3">
                  <button onClick={fetchUsers} disabled={usersLoading}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm disabled:opacity-50">
                    {usersLoading ? 'Loading...' : 'Refresh'}
                  </button>
                  <button onClick={() => { setEditingUser(null); setUserForm({ name: '', email: '', role: 'PHARMACIST', password: '', confirmPassword: '' }); setUserFormError(''); setShowUserForm(true); }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ Create User</button>
                </div>
              </div>
              {usersLoading ? (
                <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/></div>
              ) : users.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>{['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {user.name}
                            {user.id === currentUserId && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">You</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-700'}`}>{user.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-3 text-sm">
                              <button onClick={() => { setEditingUser(user); setUserForm({ name: user.name, email: user.email, role: user.role, password: '', confirmPassword: '' }); setUserFormError(''); setShowUserForm(true); }}
                                className="text-blue-600 hover:text-blue-800">Edit</button>
                              <button onClick={() => openPermsModal(user)} className="text-purple-600 hover:text-purple-800">Permissions</button>
                              {user.isActive && user.id !== currentUserId && (
                                <button onClick={() => setDeleteConfirm(user)} className="text-red-600 hover:text-red-800">Deactivate</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {}
          {activeTab === 'danger' && (
            <div className="space-y-4 max-w-xl">
              <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-1">Download Database Backup</h3>
                <p className="text-xs text-blue-600 mb-3">Downloads a full copy of the database. Store it somewhere safe.</p>
                <a href="/api/settings/backup" download className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">⬇ Download Backup</a>
              </div>
              {dangerMessage && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{dangerMessage}</div>}
              <div className="p-5 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Clear Audit Logs</h3>
                <p className="text-xs text-red-600 mb-3">Permanently delete all audit log entries. This cannot be undone.</p>
                {dangerConfirm === 'audit' ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-700 font-medium">Are you sure?</span>
                    <button onClick={() => handleDangerAction('audit')} disabled={dangerLoading}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                      {dangerLoading ? 'Deleting...' : 'Yes, Delete All'}
                    </button>
                    <button onClick={() => setDangerConfirm(null)} className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDangerConfirm('audit')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">Clear All Logs</button>
                )}
              </div>
              <div className="p-5 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Reset System Data</h3>
                <p className="text-xs text-red-600 mb-3">Permanently removes ALL invoices, products, clients, manufacturers, expenses and audit logs. Users and settings are preserved. This cannot be undone.</p>
                {dangerConfirm === 'reset' ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-700 font-medium">This will wipe all data. Sure?</span>
                    <button onClick={() => handleDangerAction('reset')} disabled={dangerLoading}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                      {dangerLoading ? 'Resetting...' : 'Yes, Reset Everything'}
                    </button>
                    <button onClick={() => setDangerConfirm(null)} className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDangerConfirm('reset')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">Reset All Data</button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {}
      {showUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">{editingUser ? `Edit — ${editingUser.name}` : 'Create New User'}</h3>
            <div className="space-y-4">
              {[{ key: 'name', label: 'Full Name *', type: 'text' }, { key: 'email', label: 'Email *', type: 'email' }].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={(userForm as any)[key]} onChange={(e) => setUserForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select value={userForm.role} onChange={(e) => setUserForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Min 6 characters'} />
              </div>
              {(userForm.password || !editingUser) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password {!editingUser && '*'}</label>
                  <input type="password" value={userForm.confirmPassword} onChange={(e) => setUserForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Repeat password" />
                </div>
              )}
              {userFormError && <p className="text-red-600 text-sm">{userFormError}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowUserForm(false)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
              <button onClick={handleUserSubmit} disabled={userFormLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 text-sm">
                {userFormLoading ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showPerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-gray-900">Permissions — {showPerms.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[showPerms.role]}`}>{showPerms.role}</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">Manually toggle individual permissions. Changes are saved independently of their role.</p>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setUserPerms(ALL_PERMISSIONS.map(p => p.key))} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Select All</button>
              <button onClick={() => setUserPerms([])} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Clear All</button>
              <button onClick={() => setUserPerms(DEFAULT_PERMS_BY_ROLE[showPerms.role] ?? [])} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Reset to Role Defaults</button>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm.key} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <input type="checkbox" checked={userPerms.includes(perm.key)} onChange={() => togglePerm(perm.key)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">{perm.label}</span>
                </label>
              ))}
            </div>
            {permsError && <p className="text-red-600 text-sm mt-3">{permsError}</p>}
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t">
              <button onClick={() => setShowPerms(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
              <button onClick={handleSavePerms} disabled={permsSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 text-sm">
                {permsSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Deactivate User</h3>
            <p className="text-gray-600 mb-4">Deactivate <strong>{deleteConfirm.name}</strong>? They won't be able to log in.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={() => handleDeactivate(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
