/**
 * One SyncClient for the signed-in session, shared by every page. Sections open activities on it
 * through `ActivityLayout`; it keeps them offline-ready in IndexedDB.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { IndexedDbPersistence, SyncClient, WebSocketTransport, type ClientPersistence, type Transport } from '@sync/client';
import { activityRegistry, clientViewerOn } from '@sync/domain';
import { viewerOf, type Session } from './auth';

export interface SyncOptions {
  /** Tests pass an offline transport and memory persistence. */
  transport?: (session: Session) => Transport;
  persistence?: (session: Session) => ClientPersistence;
}

// The server knows who this is from the session cookie, which the browser sends with the upgrade.
const syncUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/sync`;

const SyncContext = createContext<SyncClient | null>(null);

export function SyncProvider({ session, options = {}, children }: { session: Session; options?: SyncOptions; children: ReactNode }) {
  const client = useMemo(
    () =>
      new SyncClient({
        registry: activityRegistry,
        viewer: viewerOf(session),
        // Command on a mission they have a grant on, or on any other kind of activity (members manage those).
        viewerIn: (_activityId, copy) => clientViewerOn(viewerOf(session), copy),
        transport: () => options.transport?.(session) ?? new WebSocketTransport(syncUrl()),
        // One store per user and tier: what's cached is that viewer's projection.
        persistence: options.persistence?.(session) ?? new IndexedDbPersistence(`sync:${session.userId}:${session.tier}`),
      }),
    // A client's viewer is fixed for its life, so a different session is a different client.
    [session.userId, session.tier, session.class, session.personRef],
  );

  useEffect(() => {
    void client.start();
    return () => client.stop();
  }, [client]);

  return <SyncContext.Provider value={client}>{children}</SyncContext.Provider>;
}

export function useSyncClient(): SyncClient {
  const client = useContext(SyncContext);
  if (!client) throw new Error('useSyncClient must be used inside a SyncProvider');
  return client;
}
