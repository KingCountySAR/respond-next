import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sealData, unsealData } from 'iron-session';

import type UserAuth from '@respond/shared/types/userAuth';
import { UserInfo } from '@respond/shared/types/userInfo';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function cookieName(): string {
  return process.env.SESSION_COOKIE_NAME as string;
}

function password(): string {
  return process.env.SECRET_COOKIE_PASSWORD as string;
}

/** Read + decrypt the auth session from the request cookie on a Hono context. */
export async function getAuthFromContext(c: Context): Promise<UserAuth | undefined> {
  return getAuthFromCookieValue(getCookie(c, cookieName()));
}

/** Decrypt an iron-session cookie value (also used by the socket auth handshake). */
export async function getAuthFromCookieValue(sessionCookie?: string): Promise<UserAuth | undefined> {
  if (!sessionCookie) return undefined;
  const { auth } = await unsealData<{ auth?: UserAuth }>(sessionCookie, { password: password() });
  return auth;
}

/** Encrypt + set the auth session cookie on the response. */
export async function saveAuthToContext(c: Context, auth: UserAuth): Promise<void> {
  const sealed = await sealData({ auth }, { password: password(), ttl: SESSION_TTL_SECONDS });
  setCookie(c, cookieName(), sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAuth(c: Context): void {
  deleteCookie(c, cookieName(), { path: '/' });
}

export function userFromAuth(ticket?: UserAuth): UserInfo | undefined {
  if (!ticket) return undefined;
  return {
    userId: ticket.userId,
    organizationId: ticket.organizationId,
    participantId: ticket.userId.split(':')[1],
    name: ticket.name ?? '',
    email: ticket.email,
    domain: ticket.hd ?? '',
    picture: ticket.picture,
    given_name: ticket.given_name,
    family_name: ticket.family_name,
  };
}
