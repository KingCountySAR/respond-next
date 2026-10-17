/**
 * Who is signed in. Until phase 2 this is the dev sign-in: the person picks who they are, and the
 * SyncClient sends it to the server on the WebSocket URL. Phase 2 replaces it with Google sign-in
 * and a session cookie, and the tier comes from each activity's grants instead.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ActivityViewer, Tier } from '@sync/domain';

export interface Session {
  userId: string;
  name: string;
  /** The person this user is, e.g. `kcsara:85205`; self sign-in and "my activity" use it. */
  personRef: string;
  tier: Tier;
  class: ActivityViewer['class'];
}

const STORAGE_KEY = 'devSession';

function loadSession(): Session | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : undefined;
  } catch {
    return undefined;
  }
}

function saveSession(session: Session | undefined): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows can refuse storage; the session then lasts until reload.
  }
}

export const viewerOf = (s: Session): ActivityViewer => ({ userId: s.userId, tier: s.tier, class: s.class, personRef: s.personRef });

interface Auth {
  session: Session | undefined;
  signIn(session: Session): void;
  signOut(): void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(loadSession);
  const signIn = useCallback((s: Session) => {
    saveSession(s);
    setSession(s);
  }, []);
  const signOut = useCallback(() => {
    saveSession(undefined);
    setSession(undefined);
  }, []);
  const auth = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
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
