// src/components/SidebarWrapper.tsx
'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

// Pages that should NOT have the sidebar (full-screen pages)
const NO_SIDEBAR_ROUTES = ['/login', '/register', '/forgot-password'];

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_ROUTES.some((route) => pathname.startsWith(route));

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
