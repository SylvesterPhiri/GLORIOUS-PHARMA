
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const COOKIE_NAME = 'glorious_session';
const SECRET_KEY  = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'glorious-pharma-jwt-secret-change-me-in-prod'
);

export interface SessionUser {
  id:          string;
  name:        string;
  email:       string;
  role:        string;
  permissions: string[]; // e.g. ['invoices.view', 'inventory.edit']
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      id:          payload.id          as string,
      name:        payload.name        as string,
      email:       payload.email       as string,
      role:        payload.role        as string,
      permissions: (payload.permissions as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signToken(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 8,
    path:     '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
}

export function hasPermission(session: SessionUser, permission: string): boolean {
  if (session.role === 'SUPER_ADMIN') return true;
  return session.permissions.includes(permission);
}