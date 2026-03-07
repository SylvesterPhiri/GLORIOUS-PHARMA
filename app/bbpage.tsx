// app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Add this debug component at the top of the file (outside the main component)
const DebugRequest = () => {
  useEffect(() => {
    // This will intercept and log all fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0]?.toString() || '';
      if (url.includes('/dashboard')) {
        console.warn('🚨 FETCH REQUEST TO /dashboard DETECTED:', args);
        console.trace('Stack trace:');
      }
      return originalFetch.apply(this, args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  return null;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalClients: number;
  totalProducts: number;
  totalInvoices: number;
  totalRevenue: number;
  pendingInvoices: number;
  lowStockProducts: number;
  expiringProducts: number;
  historicalInvoices: number;
}

interface SessionUser {
  id: string; name: string; email: string; role: string;
}

interface SystemSettings {
  companyName: string; currency: string; taxRate: string;
  invoicePrefix: string; lowStockDefault: string; timezone: string; logoUrl: string;
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { href: '/',                    icon: GridIcon,       label: 'Dashboard'    },
      { href: '/invoices',            icon: ReceiptIcon,    label: 'Invoices'     },
      { href: '/clients',             icon: UsersIcon,      label: 'Clients'      },
      { href: '/inventory',           icon: BoxIcon,        label: 'Inventory'    },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/manufacturers',       icon: BuildingIcon,   label: 'Manufacturers'},
      { href: '/invoices/historical', icon: ClockIcon,      label: 'Historical'   },
      { href: '/returns',             icon: RefreshIcon,    label: 'Returns'      },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/accounting',          icon: WalletIcon,     label: 'Accounting'   },
      { href: '/analysis',            icon: TrendIcon,      label: 'Analysis'     },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/audit',               icon: ShieldIcon,     label: 'Audit Log'    },
      { href: '/settings',            icon: CogIcon,        label: 'Settings'     },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'from-purple-500 to-pink-600',
  ADMIN:       'from-blue-500 to-indigo-600',
  PHARMACIST:  'from-green-500 to-teal-600',
  SALES_REP:   'from-orange-500 to-amber-600',
  ACCOUNTANT:  'from-yellow-500 to-orange-500',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [stats,        setStats]        = useState<DashboardStats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [collapsed,    setCollapsed]    = useState(false);
  const [activePath,   setActivePath]   = useState('/');
  const [currentUser,  setCurrentUser]  = useState<SessionUser | null>(null);
  const [showLogout,   setShowLogout]   = useState(false);
  const [loggingOut,   setLoggingOut]   = useState(false);
  const [settings,     setSettings]     = useState<SystemSettings | null>(null);

  // Add ref to track all img elements
  useEffect(() => {
    console.log('🔍 Dashboard mounted, checking for /dashboard requests...');
    
    // Check all img tags
    const images = document.getElementsByTagName('img');
    for (let img of images) {
      if (img.src.includes('/dashboard')) {
        console.warn('🚨 IMG tag found with /dashboard src:', img);
      }
    }

    // Check all link tags
    const links = document.getElementsByTagName('a');
    for (let link of links) {
      if (link.href.includes('/dashboard')) {
        console.warn('🚨 LINK tag found with /dashboard href:', link);
      }
    }

    // Monitor DOM for new elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const el = node as Element;
            if (el.tagName === 'IMG' && el.getAttribute('src')?.includes('/dashboard')) {
              console.warn('🚨 New IMG added with /dashboard src:', el);
            }
            if (el.tagName === 'A' && el.getAttribute('href')?.includes('/dashboard')) {
              console.warn('🚨 New LINK added with /dashboard href:', el);
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchStats();
    fetchCurrentUser();
    fetchSettings();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const [clientsRes, inventoryRes, invoicesRes] = await Promise.allSettled([
        fetch('/api/clients'),
        fetch('/api/products?limit=1000'),
        fetch('/api/invoices?limit=1000'),
      ]);

      const clients   = clientsRes.status   === 'fulfilled' && clientsRes.value.ok   ? await clientsRes.value.json()   : [];
      const inventory = inventoryRes.status === 'fulfilled' && inventoryRes.value.ok ? await inventoryRes.value.json() : { products: [] };
      const invoices  = invoicesRes.status  === 'fulfilled' && invoicesRes.value.ok  ? await invoicesRes.value.json()  : { invoices: [] };

      const products    = inventory.products ?? [];
      const allInvoices = invoices.invoices  ?? [];
      const today       = new Date();
      const in30Days    = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      setStats({
        totalClients:       Array.isArray(clients) ? clients.length : 0,
        totalProducts:      products.length,
        totalInvoices:      allInvoices.filter((i: any) => !i.isHistorical).length,
        totalRevenue:       allInvoices.filter((i: any) => i.status === 'PAID').reduce((s: number, i: any) => s + (i.total ?? 0), 0),
        pendingInvoices:    allInvoices.filter((i: any) => i.status === 'PENDING').length,
        lowStockProducts:   products.filter((p: any) => p.currentStock <= p.minStock).length,
        expiringProducts:   products.filter((p: any) => p.expiryDate && new Date(p.expiryDate) <= in30Days).length,
        historicalInvoices: allInvoices.filter((i: any) => i.isHistorical).length,
      });
    } catch (err) {
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  const userInitial   = currentUser?.name?.charAt(0).toUpperCase() ?? '?';
  const userGradient  = ROLE_COLORS[currentUser?.role ?? ''] ?? 'from-blue-500 to-indigo-600';
  const roleLabel     = currentUser?.role?.replace('_', ' ') ?? '';
  const companyName   = settings?.companyName ?? 'GloriousPharma';
  const logoUrl       = settings?.logoUrl ?? null;

  // Log when logoUrl changes
  useEffect(() => {
    if (logoUrl) {
      console.log('📸 Logo URL loaded:', logoUrl);
    }
  }, [logoUrl]);

  return (
    <>
      <DebugRequest />
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 font-sans">

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>

          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200">
            {!collapsed && (
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={companyName} 
                    className="w-9 h-9 object-contain flex-shrink-0"
                    onError={(e) => console.error('❌ Logo failed to load:', logoUrl)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-white">Rx</span>
                  </div>
                )}
                <span className="text-gray-800 font-bold text-sm tracking-wide truncate max-w-[120px]">
                  {companyName}
                </span>
              </div>
            )}
            {collapsed && (
              <div className="mx-auto">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={companyName} 
                    className="w-9 h-9 object-contain"
                    onError={(e) => console.error('❌ Logo failed to load:', logoUrl)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-sm font-black text-white">Rx</span>
                  </div>
                )}
              </div>
            )}
            {!collapsed && (
              <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronLeftIcon />
              </button>
            )}
          </div>

          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="mx-auto mt-3 text-gray-400 hover:text-gray-600 transition-colors">
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
                    const isActive = activePath === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setActivePath(href)}
                        className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all group ${
                          isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                        {!collapsed && <span className="truncate">{label}</span>}
                        {!collapsed && isActive && <span className="ml-auto w-1 h-1 rounded-full bg-blue-600" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* ── Bottom user section ── */}
          <div className="border-t border-gray-200">
            {!collapsed ? (
              <div className="p-3 space-y-1">
                {/* User info */}
                <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gray-50">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${userGradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-[11px] font-bold text-white">{userInitial}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{currentUser?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-500 truncate capitalize">{roleLabel.toLowerCase()}</p>
                  </div>
                </div>
                {/* Logout button */}
                <button
                  onClick={() => setShowLogout(true)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-all group"
                >
                  <LogoutIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Sign Out</span>
                </button>
              </div>
            ) : (
              /* Collapsed — just show logout icon */
              <button
                onClick={() => setShowLogout(true)}
                className="w-full flex items-center justify-center py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                title="Sign Out"
              >
                <LogoutIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto">

          {/* Top bar */}
          <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur border-b border-gray-200">
            <div className="flex items-center gap-3">
              {/* Show logo in top bar as well */}
              {logoUrl && (
                <img 
                  src={logoUrl} 
                  alt={companyName} 
                  className="w-10 h-10 object-contain flex-shrink-0"
                  onError={(e) => console.error('❌ Top bar logo failed to load:', logoUrl)}
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {currentUser ? `Welcome back, ${currentUser.name.split(' ')[0]} 👋` : 'Dashboard'}
                </h1>
                <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchStats}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
              >
                <RefreshIcon className="w-3 h-3" />
                Refresh
              </button>
              <Link
                href="/invoices/add"
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-lg transition-all shadow-lg"
              >
                <PlusIcon className="w-3 h-3" />
                New Invoice
              </Link>
              {/* Logout button in topbar too */}
              <button
                onClick={() => setShowLogout(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
              >
                <LogoutIcon className="w-3 h-3" />
                Sign Out
              </button>
            </div>
          </header>

          <div className="p-8 space-y-8">

            {/* ── Alert bar ──────────────────────────────────────────────── */}
            {!loading && stats && (stats.lowStockProducts > 0 || stats.expiringProducts > 0) && (
              <div className="flex flex-wrap gap-3">
                {stats.lowStockProducts > 0 && (
                  <Link href="/inventory" className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm hover:bg-amber-100 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    {stats.lowStockProducts} product{stats.lowStockProducts > 1 ? 's' : ''} low on stock
                    <span className="text-amber-400">→</span>
                  </Link>
                )}
                {stats.expiringProducts > 0 && (
                  <Link href="/inventory" className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm hover:bg-red-100 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {stats.expiringProducts} product{stats.expiringProducts > 1 ? 's' : ''} expiring within 30 days
                    <span className="text-red-400">→</span>
                  </Link>
                )}
              </div>
            )}

            {/* ── KPI Stats Grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Revenue"     value={loading ? '—' : `K${(stats?.totalRevenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="From paid invoices"  accent="emerald" icon={<WalletIcon className="w-4 h-4" />} />
              <StatCard label="Active Clients"    value={loading ? '—' : String(stats?.totalClients ?? 0)}   sub="Registered clients"                                          accent="cyan"    icon={<UsersIcon className="w-4 h-4" />} />
              <StatCard label="Total Invoices"    value={loading ? '—' : String(stats?.totalInvoices ?? 0)}  sub={loading ? '' : `${stats?.pendingInvoices ?? 0} pending`}      accent="violet"  icon={<ReceiptIcon className="w-4 h-4" />} alert={(stats?.pendingInvoices ?? 0) > 0} />
              <StatCard label="Products in Stock" value={loading ? '—' : String(stats?.totalProducts ?? 0)}  sub={loading ? '' : `${stats?.lowStockProducts ?? 0} low stock`}   accent="amber"   icon={<BoxIcon className="w-4 h-4" />}    alert={(stats?.lowStockProducts ?? 0) > 0} />
            </div>

            {/* ── Quick Actions + Secondary Stats ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-2xl p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <QuickAction href="/invoices/add"        icon={<ReceiptIcon className="w-5 h-5"/>} label="New Invoice"       color="emerald" />
                  <QuickAction href="/clients/add"         icon={<UsersIcon className="w-5 h-5"/>}   label="Add Client"        color="cyan"    />
                  <QuickAction href="/inventory/add"       icon={<BoxIcon className="w-5 h-5"/>}     label="Add Product"       color="violet"  />
                  <QuickAction href="/invoices/historical" icon={<ClockIcon className="w-5 h-5"/>}   label="Import Historical" color="amber"   />
                  <QuickAction href="/analysis"            icon={<TrendIcon className="w-5 h-5"/>}   label="View Analysis"     color="pink"    />
                  <QuickAction href="/accounting"          icon={<WalletIcon className="w-5 h-5"/>}  label="Accounting"        color="indigo"  />
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-700">At a Glance</h2>
                <MiniStat label="Pending Invoices"   value={loading ? '—' : String(stats?.pendingInvoices ?? 0)}    dot="amber"  />
                <MiniStat label="Low Stock Products" value={loading ? '—' : String(stats?.lowStockProducts ?? 0)}   dot="red"    />
                <MiniStat label="Expiring (30 days)" value={loading ? '—' : String(stats?.expiringProducts ?? 0)}   dot="orange" />
                <MiniStat label="Historical Records" value={loading ? '—' : String(stats?.historicalInvoices ?? 0)} dot="violet" />
              </div>
            </div>

            {/* ── All Modules Grid ────────────────────────────────────────── */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">All Modules</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                <ModuleCard href="/invoices"            icon={<ReceiptIcon className="w-6 h-6"/>}  label="Invoices"      desc="Create & manage"     accent="emerald" />
                <ModuleCard href="/clients"             icon={<UsersIcon className="w-6 h-6"/>}    label="Clients"       desc="Client database"     accent="cyan"    />
                <ModuleCard href="/inventory"           icon={<BoxIcon className="w-6 h-6"/>}      label="Inventory"     desc="Stock control"       accent="violet"  />
                <ModuleCard href="/manufacturers"       icon={<BuildingIcon className="w-6 h-6"/>} label="Manufacturers" desc="Supplier management" accent="blue"    />
                <ModuleCard href="/invoices/historical" icon={<ClockIcon className="w-6 h-6"/>}    label="Historical"    desc="Archived records"    accent="amber"   />
                <ModuleCard href="/returns"             icon={<RefreshIcon className="w-6 h-6"/>}  label="Returns"       desc="Process returns"     accent="orange"  />
                <ModuleCard href="/accounting"          icon={<WalletIcon className="w-6 h-6"/>}   label="Accounting"    desc="Finance overview"    accent="green"   />
                <ModuleCard href="/analysis"            icon={<TrendIcon className="w-6 h-6"/>}    label="Analysis"      desc="Business insights"   accent="pink"    />
                <ModuleCard href="/audit"               icon={<ShieldIcon className="w-6 h-6"/>}   label="Audit Log"     desc="Activity trail"      accent="slate"   />
                <ModuleCard href="/settings"            icon={<CogIcon className="w-6 h-6"/>}      label="Settings"      desc="System config"       accent="gray"    />
              </div>
            </div>

            {/* Getting started */}
            {!loading && stats && stats.totalClients === 0 && stats.totalProducts === 0 && (
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <h2 className="text-base font-bold text-gray-900 mb-6">Getting Started</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { step: 1, title: 'Add Clients',       desc: 'Register the pharmacies and hospitals you supply.',   href: '/clients/add',      color: 'cyan'   },
                    { step: 2, title: 'Add Manufacturers', desc: 'Set up your medicine suppliers and mother companies.', href: '/manufacturers/add', color: 'blue'   },
                    { step: 3, title: 'Setup Inventory',   desc: 'Add your medicines with stock levels and expiry.',     href: '/inventory/add',    color: 'violet' },
                  ].map(({ step, title, desc, href, color }) => (
                    <Link key={step} href={href} className="group flex items-start gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all">
                      <div className={`w-8 h-8 rounded-full bg-${color}-100 text-${color}-600 flex items-center justify-center text-sm font-bold flex-shrink-0`}>{step}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>
        </main>

        {/* ── Logout Confirmation Modal ─────────────────────────────────────── */}
        {showLogout && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <LogoutIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Sign Out</h3>
                  <p className="text-sm text-gray-500">Are you sure you want to sign out?</p>
                </div>
              </div>
              {currentUser && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-5">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${userGradient} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-sm font-bold text-white">{userInitial}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{currentUser.name}</p>
                    <p className="text-xs text-gray-500">{currentUser.email}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogout(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 transition-all font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loggingOut ? (
                    <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing out...</>
                  ) : (
                    <><LogoutIcon className="w-4 h-4" />Sign Out</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon, alert = false }: {
  label: string; value: string; sub: string;
  accent: 'emerald' | 'cyan' | 'violet' | 'amber';
  icon: React.ReactNode; alert?: boolean;
}) {
  const accents = {
    emerald: 'from-emerald-50 to-transparent border-emerald-200 text-emerald-600',
    cyan:    'from-cyan-50 to-transparent border-cyan-200 text-cyan-600',
    violet:  'from-violet-50 to-transparent border-violet-200 text-violet-600',
    amber:   'from-amber-50 to-transparent border-amber-200 text-amber-600',
  };
  return (
    <div className={`relative bg-gradient-to-br ${accents[accent]} bg-white rounded-2xl shadow-2xl border p-5 overflow-hidden`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-current/10">{icon}</div>
        {alert && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function QuickAction({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 text-gray-600 transition-all hover:bg-${color}-50 hover:border-${color}-200 hover:text-${color}-600`}>
      {icon}
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
    </Link>
  );
}

function MiniStat({ label, value, dot }: { label: string; value: string; dot: string }) {
  const dots: Record<string, string> = { amber: 'bg-amber-500', red: 'bg-red-500', orange: 'bg-orange-500', violet: 'bg-violet-500' };
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dots[dot] ?? 'bg-gray-300'}`} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function ModuleCard({ href, icon, label, desc, accent }: { href: string; icon: React.ReactNode; label: string; desc: string; accent: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-3 p-4 bg-white rounded-2xl shadow-2xl border border-gray-200 hover:border-gray-300 transition-all">
      <div className={`w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center transition-all group-hover:bg-${accent}-50 group-hover:text-${accent}-600`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </Link>
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
function PlusIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function ChevronLeftIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
}
function ChevronRightIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
}
function LogoutIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
}