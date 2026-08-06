import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { parse } from 'hono/utils/cookie';

import type UserAuth from '@respond/shared/types/userAuth';
import { UserInfo } from '@respond/shared/types/userInfo';

import { createSession, deleteSession, getSession, SESSION_TTL_SECONDS } from './sessions';

// The cookie only carries an opaque session id (the auth payload lives in Mongo),
// so the name is arbitrary — a fixed default avoids a required env var.
const COOKIE_NAME = 'respond_session';

function cookieName(): string {
  return COOKIE_NAME;
}

/**
 * Read the auth session from the request cookie on a Hono context. When the
 * session rolls its expiry forward (see getSession), refresh the browser cookie
 * too so an active user's cookie max-age slides along with the server session.
 */
export async function getAuthFromContext(c: Context): Promise<UserAuth | undefined> {
  const sessionId = getCookie(c, cookieName());
  if (!sessionId) return undefined;
  const result = await getSession(sessionId);
  if (!result) return undefined;
  if (result.refreshed) setSessionCookie(c, sessionId);
  return result.auth;
}

/**
 * Read the auth session from a raw `Cookie` request header. Used to authenticate
 * the websocket connection from its handshake headers, so the socket shares the
 * same session cookie as the HTTP API (no separate socket key). Any expiry roll
 * is persisted in Mongo by getSession; the cookie itself is refreshed on the
 * next HTTP request (the socket handshake has no response to set it on).
 */
export async function getAuthFromCookieHeader(cookieHeader?: string): Promise<UserAuth | undefined> {
  if (!cookieHeader) return undefined;
  const sessionId = parse(cookieHeader)[cookieName()];
  if (!sessionId) return undefined;
  return (await getSession(sessionId))?.auth;
}

/** Create a server-side session for `auth` and set its id cookie on the response. */
export async function saveAuthToContext(c: Context, auth: UserAuth): Promise<void> {
  const sessionId = await createSession(auth);
  setSessionCookie(c, sessionId);
}

function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, cookieName(), sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Destroy the current session (in Mongo) and clear its cookie. */
export async function clearAuth(c: Context): Promise<void> {
  const sessionId = getCookie(c, cookieName());
  if (sessionId) await deleteSession(sessionId);
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
