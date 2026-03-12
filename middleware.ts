
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasPermission } from '@/src/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/me'];

const ROUTE_PERMISSIONS: { path: string; permission: string }[] = [
  { path: '/inventory',         permission: 'inventory.view'     },
  { path: '/api/inventory',     permission: 'inventory.view'     },
  { path: '/clients',           permission: 'clients.view'       },
  { path: '/api/clients',       permission: 'clients.view'       },
  { path: '/invoices',          permission: 'invoices.view'      },
  { path: '/api/invoices',      permission: 'invoices.view'      },
  { path: '/manufacturers',     permission: 'manufacturers.view' },
  { path: '/api/manufacturers', permission: 'manufacturers.view' },
  { path: '/reports',           permission: 'reports.view'       },
  { path: '/api/reports',       permission: 'reports.view'       },
  { path: '/accounting',        permission: 'accounting.view'    },
  { path: '/api/accounting',    permission: 'accounting.view'    },
  { path: '/returns',           permission: 'returns.view'       },
  { path: '/api/returns',       permission: 'returns.view'       },
  { path: '/settings',          permission: 'settings.view'      },
  { path: '/api/users',         permission: 'users.view'         },
  { path: '/api/audit',         permission: 'audit.view'         },
];

const WRITE_PERMISSIONS: { path: string; methods: string[]; permission: string }[] = [
  { path: '/api/inventory',     methods: ['POST', 'PUT', 'DELETE'], permission: 'inventory.edit'     },
  { path: '/api/clients',       methods: ['POST', 'PUT', 'DELETE'], permission: 'clients.edit'       },
  { path: '/api/invoices',      methods: ['POST', 'PUT', 'DELETE'], permission: 'invoices.create'    },
  { path: '/api/manufacturers', methods: ['POST', 'PUT', 'DELETE'], permission: 'manufacturers.edit' },
  { path: '/api/accounting',    methods: ['POST', 'PUT', 'DELETE'], permission: 'accounting.edit'    },
  { path: '/api/users',         methods: ['POST', 'PUT', 'DELETE'], permission: 'users.manage'       },
  { path: '/api/returns',       methods: ['POST'],                  permission: 'returns.process'    },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method       = request.method;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  let session;
  try {
    session = await getSessionFromRequest(request);
  } catch (err) {
    console.error('Middleware auth error:', err);
    session = null;
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session.role === 'SUPER_ADMIN') {
    return NextResponse.next();
  }

  for (const rule of WRITE_PERMISSIONS) {
    if (pathname.startsWith(rule.path) && rule.methods.includes(method)) {
      if (!hasPermission(session, rule.permission)) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: `Permission denied (requires: ${rule.permission})` },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }
  }

  for (const rule of ROUTE_PERMISSIONS) {
    if (pathname.startsWith(rule.path)) {
      if (!hasPermission(session, rule.permission)) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: `Permission denied (requires: ${rule.permission})` },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
