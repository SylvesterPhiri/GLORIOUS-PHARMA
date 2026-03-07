// src/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { href: '/',                    icon: GridIcon,    label: 'Dashboard'    },
      { href: '/invoices',            icon: ReceiptIcon, label: 'Invoices'     },
      { href: '/clients',             icon: UsersIcon,   label: 'Clients'      },
      { href: '/inventory',           icon: BoxIcon,     label: 'Inventory'    },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/manufacturers',       icon: BuildingIcon, label: 'Manufacturers' },
      { href: '/invoices/historical', icon: ClockIcon,    label: 'Historical'    },
      { href: '/returns',             icon: RefreshIcon,  label: 'Returns'       },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/accounting',          icon: WalletIcon,  label: 'Accounting'   },
      { href: '/analysis',            icon: TrendIcon,   label: 'Analysis'     },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/audit',               icon: ShieldIcon,  label: 'Audit Log'    },
      { href: '/settings',            icon: CogIcon,     label: 'Settings'     },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname  = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser]           = useState<{ name: string; role: string } | null>(null);

  // Persist collapsed state across navigations
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggle = (val: boolean) => {
    setCollapsed(val);
    localStorage.setItem('sidebar-collapsed', String(val));
  };

  // Fetch current user for the bottom avatar
  useEffect(() => {
    fetch('/api/auth/me').then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        if (data.user) setUser({ name: data.user.name, role: data.user.role });
      }
    }).catch(() => {});
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'A';

  // Active path: match exact for root, prefix match for all others
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside
      className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-white">Rx</span>
            </div>
            <span className="text-gray-800 font-bold text-sm tracking-wide truncate">GloriousPharma</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto">
            <span className="text-xs font-black text-white">Rx</span>
          </div>
        )}
        {!collapsed && (
          <button onClick={() => toggle(true)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" title="Collapse">
            <ChevronLeftIcon />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button onClick={() => toggle(false)} className="mx-auto mt-3 text-gray-400 hover:text-gray-600 transition-colors" title="Expand">
          <ChevronRightIcon />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all group ${
                      active
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {!collapsed && active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom user section */}
      <div className="p-3 border-t border-gray-200">
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gray-50">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.role ?? 'Super Admin'}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center" title={user?.name ?? 'Admin'}>
              <span className="text-[10px] font-bold text-white">{initials}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GridIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>;
}
function ReceiptIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
}
function UsersIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function BoxIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}
function BuildingIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
function ClockIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function RefreshIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
}
function WalletIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
}
function TrendIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
}
function ShieldIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
}
function CogIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function ChevronLeftIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
}
function ChevronRightIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
}
