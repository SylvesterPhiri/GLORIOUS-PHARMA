
'use client';
import { useState, useEffect } from 'react';

interface AuditUser {
  id: string; name: string; email: string; role: string;
}
interface AuditLog {
  id: string; action: string; entityType: string; entityId: string | null;
  userId: string | null; description: string | null; ipAddress: string | null;
  oldData: string | null; newData: string | null; changes: string | null;
  createdAt: string;
  user: AuditUser | null;
}

const ACTION_COLORS: Record<string, string> = {

  AUTH_LOGIN:          'bg-green-100 text-green-800',
  AUTH_LOGIN_FAILED:   'bg-red-100 text-red-800',
  AUTH_LOGOUT:         'bg-gray-100 text-gray-700',

  INVOICE_CREATED:             'bg-blue-100 text-blue-800',
  INVOICE_PAID:                'bg-emerald-100 text-emerald-800',
  INVOICE_DELETED:             'bg-red-100 text-red-800',
  HISTORICAL_INVOICE_IMPORTED: 'bg-amber-100 text-amber-800',

  CLIENT_CREATED: 'bg-indigo-100 text-indigo-800',
  CLIENT_UPDATED: 'bg-yellow-100 text-yellow-800',
  CLIENT_DELETED: 'bg-red-100 text-red-800',

  PRODUCT_CREATED: 'bg-teal-100 text-teal-800',
  PRODUCT_UPDATED: 'bg-yellow-100 text-yellow-800',
  PRODUCT_DELETED: 'bg-red-100 text-red-800',
  STOCK_ADJUSTED:  'bg-orange-100 text-orange-800',

  USER_CREATED:      'bg-violet-100 text-violet-800',
  USER_UPDATED:      'bg-yellow-100 text-yellow-800',
  USER_DEACTIVATED:  'bg-red-100 text-red-800',

  RETURN_PROCESSED:        'bg-orange-100 text-orange-800',
  EXPENSE_CREATED:         'bg-pink-100 text-pink-800',
  EXPENSE_DELETED:         'bg-red-100 text-red-800',
  MANUFACTURER_CREATED:    'bg-cyan-100 text-cyan-800',
  MANUFACTURER_UPDATED:    'bg-yellow-100 text-yellow-800',
  MANUFACTURER_DELETED:    'bg-red-100 text-red-800',
  SETTINGS_UPDATED:        'bg-slate-100 text-slate-800',
  DANGER_ZONE_ACTION:      'bg-red-200 text-red-900',
};

const ENTITY_ICONS: Record<string, string> = {
  INVOICE: '🧾', CLIENT: '👤', PRODUCT: '💊', USER: '👥',
  RETURN: '↩️', EXPENSE: '💸', MANUFACTURER: '🏭', SETTINGS: '⚙️',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  ADMIN:       'bg-orange-100 text-orange-700',
  PHARMACIST:  'bg-blue-100 text-blue-700',
  ACCOUNTANT:  'bg-green-100 text-green-700',
  SALES_REP:   'bg-purple-100 text-purple-700',
};

export default function AuditPage() {
  const [logs,        setLogs]        = useState<AuditLog[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [pagination,  setPagination]  = useState({ page: 1, limit: 50, total: 0, pages: 1 });

  useEffect(() => { fetchLogs(); }, [pagination.page, entityFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:  String(pagination.page),
        limit: String(pagination.limit),
        ...(search       && { search }),
        ...(entityFilter && { entityType: entityFilter }),
        ...(actionFilter && { action: actionFilter }),
      });
      const res  = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setPagination((p) => ({ ...p, ...data.pagination }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchLogs();
  };

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const parseJson = (s: string | null) => {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Audit Log
          </h1>
          <p className="text-gray-600 mt-2">Complete history of every action taken in the system — including who did it.</p>
        </div>

        {}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Events',  value: pagination.total, color: 'border-blue-500'  },
            { label: 'Page',          value: `${pagination.page} / ${pagination.pages}`, color: 'border-purple-500' },
            { label: 'Showing',       value: logs.length, color: 'border-green-500' },
            { label: 'Per Page',      value: pagination.limit, color: 'border-orange-500' },
          ].map((s) => (
            <div key={s.label} className={`bg-white rounded-xl shadow p-4 border-l-4 ${s.color}`}>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {}
        <div className="bg-white rounded-2xl shadow p-5 mb-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search descriptions..."
              className="flex-1 min-w-48 px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all" />

            <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all">
              <option value="">All Types</option>
              {['INVOICE','CLIENT','PRODUCT','USER','RETURN','EXPENSE','MANUFACTURER','SETTINGS'].map((e) => (
                <option key={e} value={e}>{ENTITY_ICONS[e]} {e}</option>
              ))}
            </select>

            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all">
              <option value="">All Actions</option>
              {['AUTH_LOGIN','AUTH_LOGIN_FAILED','AUTH_LOGOUT',
                'INVOICE_CREATED','INVOICE_PAID','INVOICE_DELETED',
                'CLIENT_CREATED','CLIENT_UPDATED','CLIENT_DELETED',
                'PRODUCT_CREATED','PRODUCT_UPDATED','PRODUCT_DELETED','STOCK_ADJUSTED',
                'USER_CREATED','USER_UPDATED','USER_DEACTIVATED',
                'RETURN_PROCESSED','EXPENSE_CREATED','EXPENSE_DELETED',
                'MANUFACTURER_CREATED','MANUFACTURER_UPDATED','MANUFACTURER_DELETED',
                'SETTINGS_UPDATED','DANGER_ZONE_ACTION',
              ].map((a) => (
                <option key={a} value={a}>{formatAction(a)}</option>
              ))}
            </select>

            <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-all">
              Search
            </button>
            <button type="button" onClick={() => { setSearch(''); setEntityFilter(''); setActionFilter(''); setPagination((p) => ({ ...p, page: 1 })); setTimeout(fetchLogs, 0); }}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all">
              Clear
            </button>
          </form>
        </div>

        {}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-2xl shadow p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"/>
              <p className="text-gray-500 mt-3">Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500">No audit events found.</p>
            </div>
          ) : logs.map((log) => {
            const changes  = parseJson(log.changes);
            const oldData  = parseJson(log.oldData);
            const newData  = parseJson(log.newData);
            const expanded = expandedId === log.id;
            const hasDetails = changes || oldData || newData;

            return (
              <div key={log.id} className="bg-white rounded-2xl shadow hover:shadow-md transition-all">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">

                    {}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {}
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                        {ENTITY_ICONS[log.entityType] ?? '📝'}
                      </div>

                      <div className="flex-1 min-w-0">
                        {}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                            {formatAction(log.action)}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{log.entityType}</span>
                          {log.entityId && (
                            <span className="text-xs text-gray-300 font-mono truncate max-w-32">{log.entityId.slice(0, 8)}…</span>
                          )}
                        </div>

                        {}
                        <p className="text-sm text-gray-700 font-medium leading-snug">
                          {log.description ?? '—'}
                        </p>

                        {}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {log.user ? (
                            <div className="flex items-center gap-2">
                              {}
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {log.user.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-gray-800">{log.user.name}</span>
                                <span className="text-xs text-gray-400">{log.user.email}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[log.user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {log.user.role}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">System / unauthenticated</span>
                          )}

                          {log.ipAddress && (
                            <span className="text-xs text-gray-400 font-mono">IP: {log.ipAddress}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{formatTimestamp(log.createdAt)}</span>
                      {hasDetails && (
                        <button onClick={() => setExpandedId(expanded ? null : log.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                          {expanded ? '▲ Hide' : '▼ Details'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {}
                {expanded && hasDetails && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 rounded-b-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">

                      {}
                      {changes && Object.keys(changes).length > 0 && (
                        <div className="md:col-span-2">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 font-sans">Changes</p>
                          <div className="space-y-1">
                            {Object.entries(changes).map(([field, diff]: [string, any]) => (
                              <div key={field} className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-500 font-sans font-medium capitalize min-w-24">{field}:</span>
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded line-through">{String(diff.from ?? '—')}</span>
                                <span className="text-gray-400">→</span>
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{String(diff.to ?? '—')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {}
                      {oldData && !changes && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 font-sans">Before</p>
                          <pre className="bg-red-50 text-red-800 p-3 rounded-lg overflow-auto text-xs leading-relaxed">
                            {JSON.stringify(oldData, null, 2)}
                          </pre>
                        </div>
                      )}

                      {}
                      {newData && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 font-sans">
                            {oldData && !changes ? 'After' : 'Data'}
                          </p>
                          <pre className="bg-green-50 text-green-800 p-3 rounded-lg overflow-auto text-xs leading-relaxed">
                            {JSON.stringify(newData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {}
        {pagination.pages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} events
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 text-sm">
                ← Previous
              </button>
              <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
                disabled={pagination.page === pagination.pages}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 text-sm">
                Next →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}