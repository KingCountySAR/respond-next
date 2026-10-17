/**
 * The only React part of the model: open an activity (or the activity list) and hand out its
 * model. Components read the model directly inside `observer(...)`; there are no per-component
 * data hooks.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SyncClient } from '@sync/client';
import { ACTIVITY_LIST_ID } from '@sync/domain';
import { ActivityList, createActivityModel, isCommandActivity, type CommandActivity, type FieldActivity } from './models';

export { observer, Observer } from 'mobx-react-lite';

interface Entry {
  refs: number;
  ready: Promise<{ dispose(): void }>;
}

/** One model per client and scope (an activity, or the activity list), shared by everything showing it. */
const entries = new WeakMap<SyncClient, Map<string, Entry>>();

/**
 * Opens the scope on the client (if it isn't already) and returns its shared model. Call `release`
 * when done; the last release disposes the model and closes the scope.
 */
function acquire<M extends { dispose(): void }>(client: SyncClient, scopeId: string, create: () => M): { ready: Promise<M>; release: () => void } {
  let byScope = entries.get(client);
  if (!byScope) entries.set(client, (byScope = new Map()));
  let entry = byScope.get(scopeId);
  if (!entry) byScope.set(scopeId, (entry = { refs: 0, ready: client.open(scopeId).then(create) }));
  const held = entry;
  held.refs++;
  let released = false;
  return {
    ready: held.ready as Promise<M>,
    release: () => {
      if (released) return;
      released = true;
      held.refs--;
      // Deferred, so a remount in the same tick (StrictMode, moving a subtree) keeps the scope open.
      queueMicrotask(() => {
        if (held.refs > 0 || byScope.get(scopeId) !== held) return;
        byScope.delete(scopeId);
        void held.ready.then((model) => {
          model.dispose();
          client.close(scopeId);
        });
      });
    },
  };
}

/** The shared model for an activity; see `acquire`. */
export function acquireActivityModel(client: SyncClient, activityId: string): { ready: Promise<FieldActivity>; release: () => void } {
  return acquire(client, activityId, () => createActivityModel(client, activityId));
}

/** The activity list, open while any component uses it; null until it's loaded. */
export function useActivityList(client: SyncClient): ActivityList | null {
  const [list, setList] = useState<ActivityList | null>(null);
  useEffect(() => {
    const lease = acquire(client, ACTIVITY_LIST_ID, () => new ActivityList(client));
    let live = true;
    void lease.ready.then((l) => live && setList(l));
    return () => {
      live = false;
      lease.release();
      setList(null);
    };
  }, [client]);
  return list;
}

const ActivityModelContext = createContext<FieldActivity | null>(null);

export function ActivityModelProvider({ client, activityId, fallback = null, children }: { client: SyncClient; activityId: string; fallback?: ReactNode; children: ReactNode }) {
  const [model, setModel] = useState<FieldActivity | null>(null);

  useEffect(() => {
    const lease = acquireActivityModel(client, activityId);
    let live = true;
    void lease.ready.then((m) => live && setModel(m));
    return () => {
      live = false;
      lease.release();
      setModel(null);
    };
  }, [client, activityId]);

  return model ? <ActivityModelContext.Provider value={model}>{children}</ActivityModelContext.Provider> : <>{fallback}</>;
}

function useModel(hook: string): FieldActivity {
  const model = useContext(ActivityModelContext);
  if (!model) throw new Error(`${hook} must be used inside an ActivityModelProvider`);
  return model;
}

/** The activity as every viewer sees it. Works for command too, so field screens can be shown to command. */
export function useFieldActivity(): FieldActivity {
  return useModel('useFieldActivity');
}

/** The command model. Throws for field viewers: only command screens call this. */
export function useCommandActivity(): CommandActivity {
  const model = useModel('useCommandActivity');
  if (!isCommandActivity(model)) throw new Error('useCommandActivity is for command and support viewers');
  return model;
}
