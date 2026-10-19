/**
 * The only React part of the model: open an activity (or the activity list) and hand out its
 * model. Components read the model directly inside `observer(...)`; there are no per-component
 * data hooks.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SyncClient } from '@sync/client';
import { ACTIVITY_LIST_ID, activityProjector } from '@sync/domain';
import { ActivityList, createActivityModel, isCommandActivity, type CommandActivity, type FieldActivity } from './models';

export { observer, Observer } from 'mobx-react-lite';

interface Entry {
  refs: number;
  ready: Promise<{ dispose(): void }>;
  /** Once it's ready. */
  model?: { dispose(): void };
}

/** One model per client and scope (an activity, or the activity list), shared by everything showing it. */
const entries = new WeakMap<SyncClient, Map<string, Entry>>();

/**
 * Opens the scope on the client (if it isn't already) and returns its shared model. Call `release`
 * when done; the last release disposes the model and closes the scope. A model `stale` says no
 * longer fits is replaced by a new one; its holders keep it until they release it.
 */
function acquire<M extends { dispose(): void }>(client: SyncClient, scopeId: string, create: () => M, stale?: (model: M) => boolean): { ready: Promise<M>; release: () => void } {
  let byScope = entries.get(client);
  if (!byScope) entries.set(client, (byScope = new Map()));
  let entry = byScope.get(scopeId);
  if (entry?.model && stale?.(entry.model as M)) entry = undefined;
  if (!entry) {
    const made: Entry = { refs: 0, ready: client.open(scopeId).then(create) };
    void made.ready.then((model) => (made.model = model));
    byScope.set(scopeId, (entry = made));
  }
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
        if (held.refs > 0) return;
        // A replaced model goes, but the scope stays open for its replacement.
        const current = byScope.get(scopeId) === held;
        if (current) byScope.delete(scopeId);
        void held.ready.then((model) => {
          model.dispose();
          if (current) client.close(scopeId);
        });
      });
    },
  };
}

/** Whether the model is in the view the client's viewer has of the activity now; its kind can change that. */
const fits = (client: SyncClient, model: FieldActivity) => model.viewKey === activityProjector.viewKey(client.viewerIn(model.activityId));

/** The shared model for an activity, made anew when it no longer fits; see `acquire`. */
export function acquireActivityModel(client: SyncClient, activityId: string): { ready: Promise<FieldActivity>; release: () => void } {
  return acquire(client, activityId, () => createActivityModel(client, activityId), (model) => !fits(client, model));
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
  // Bumped when the model stops fitting (a training became a mission, say), for a new one.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const lease = acquireActivityModel(client, activityId);
    let live = true;
    void lease.ready.then((m) => live && setModel(m));
    return () => {
      live = false;
      lease.release();
      setModel(null);
    };
  }, [client, activityId, generation]);

  useEffect(() => {
    if (!model) return;
    const check = () => !fits(client, model) && setGeneration((g) => g + 1);
    check();
    return client.subscribe(activityId, check);
  }, [client, activityId, model]);

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
