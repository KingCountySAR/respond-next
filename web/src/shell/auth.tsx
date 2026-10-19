/**
 * Who is signed in: the server's session for this site (a cookie the WebSocket sends too). A copy is
 * kept so the app still opens, signed in, when the server can't be reached; the server's answer
 * replaces it whenever there is one. Signing in is the development sign-in until Google sign-in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { viewerOfSession, type DevSignInRequest, type Session } from '@sync/domain';
import { useApi } from './api';

export type { Session };
export const viewerOf = viewerOfSession;

const STORAGE_KEY = 'session';

function loadCached(): Session | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : undefined;
  } catch {
    return undefined;
  }
}

function saveCached(session: Session | undefined): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows can refuse storage; offline, they'll be asked to sign in.
  }
}

interface Auth {
  /** Undefined until the server (or the copy, offline) says. */
  session: Session | undefined;
  /** Whether the server has been asked yet. */
  checked: boolean;
  /** Throws with the reason sign-in was refused. */
  devSignIn(request: DevSignInRequest): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [session, setSessionState] = useState<Session | undefined>(loadCached);
  const [checked, setChecked] = useState(false);
  const setSession = useCallback((s: Session | undefined) => {
    saveCached(s);
    setSessionState(s);
  }, []);

  useEffect(() => {
    let live = true;
    api
      .session()
      .then((s) => live && setSession(s ?? undefined))
      // Offline: keep the copy.
      .catch(() => {})
      .finally(() => live && setChecked(true));
    return () => {
      live = false;
    };
  }, [api, setSession]);

  const devSignIn = useCallback(async (request: DevSignInRequest) => setSession(await api.devSignIn(request)), [api, setSession]);
  const signOut = useCallback(async () => {
    setSession(undefined);
    await api.signOut().catch(() => {});
  }, [api, setSession]);
  const auth = useMemo(() => ({ session, checked, devSignIn, signOut }), [session, checked, devSignIn, signOut]);
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside an AuthProvider');
  return auth;
}

/** First and last name, split from the signed-in name as the legacy app took them from Google. */
export function personName(s: Session): { firstname: string; lastname: string } {
  const [firstname = '', ...rest] = s.name.trim().split(/\s+/);
  return { firstname, lastname: rest.join(' ') };
}
