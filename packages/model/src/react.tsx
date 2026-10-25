/**
 * The only React part of the model: open an activity (or the activity list) and hand out its
 * model. Components read the model directly inside `observer(...)`; there are no per-component
 * data hooks.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { OpenOptions } from '@sync/client';
import type { ActivityClient } from './client';
import { ACTIVITY_LIST_ID, activityLogId, activityProjector } from '@sync/domain';
import { ActivityList, ActivityLog, createActivityModel, isManageActivity, type ManageActivity, type RespondActivity } from './models';

export { observer, Observer } from 'mobx-react-lite';

interface Entry {
  refs: number;
  ready: Promise<{ dispose(): void }>;
  /** Once it's ready. */
  model?: { dispose(): void };
}

/** One model per client and scope (an activity, or the activity list), shared by everything showing it. */
const entries = new WeakMap<ActivityClient, Map<string, Entry>>();

/**
 * How long a scope stays open after its last release: going from one page to another that shows
 * the same activity (an activity's page to its ops dashboard, waiting on the dashboard's code
 * meanwhile) finds it still open and loaded, rather than reloading it.
 */
const LINGER_MS = 10_000;

/** The scope's shared model, if it's open and loaded: what a component can show on its first render. */
function loaded<M>(client: ActivityClient, scopeId: string): M | undefined {
  return entries.get(client)?.get(scopeId)?.model as M | undefined;
}

/**
 * Opens the scope on the client (if it isn't already) and returns its shared model. Call `release`
 * when done; the last release disposes the model and closes the scope, `LINGER_MS` later if no one
 * has taken it again. A model `stale` says no longer fits is replaced by a new one; its holders
 * keep it until they release it.
 */
function acquire<M extends { dispose(): void }>(client: ActivityClient, scopeId: string, create: () => M, stale?: (model: M) => boolean, open?: OpenOptions): { ready: Promise<M>; release: () => void } {
  let byScope = entries.get(client);
  if (!byScope) entries.set(client, (byScope = new Map()));
  let entry = byScope.get(scopeId);
  if (entry?.model && stale?.(entry.model as M)) entry = undefined;
  if (!entry) {
    const made: Entry = { refs: 0, ready: client.open(scopeId, open).then(create) };
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
      setTimeout(() => {
        if (held.refs > 0) return;
        // A replaced model goes, but the scope stays open for its replacement.
        const current = byScope.get(scopeId) === held;
        if (current) byScope.delete(scopeId);
        void held.ready.then((model) => {
          model.dispose();
          if (current) client.close(scopeId);
        });
      }, LINGER_MS);
    },
  };
}

/** Whether the model is in the view the client's viewer has of the activity now; its kind can change that. */
const fits = (client: ActivityClient, model: RespondActivity) => model.viewKey === activityProjector.viewKey(client.viewerIn(model.activityId));

/**
 * The shared model for an activity, made anew when it no longer fits; see `acquire`. `open` says how
 * to open it if it isn't open (`client.open`'s options).
 */
export function acquireActivityModel(client: ActivityClient, activityId: string, open?: OpenOptions): { ready: Promise<RespondActivity>; release: () => void } {
  return acquire(client, activityId, () => createActivityModel(client, activityId), (model) => !fits(client, model), open);
}

/** The activity list, open while any component uses it; null until it's loaded. */
export function useActivityList(client: ActivityClient): ActivityList | null {
  const [list, setList] = useState<ActivityList | null>(() => loaded<ActivityList>(client, ACTIVITY_LIST_ID) ?? null);
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

/** An activity's log, open while any component uses it; null until it's loaded. Managers only. */
export function useActivityLog(client: ActivityClient, activityId: string): ActivityLog | null {
  const [log, setLog] = useState<ActivityLog | null>(() => loaded<ActivityLog>(client, activityLogId(activityId)) ?? null);
  useEffect(() => {
    const lease = acquire(client, activityLogId(activityId), () => new ActivityLog(client, activityId));
    let live = true;
    void lease.ready.then((l) => live && setLog(l));
    return () => {
      live = false;
      lease.release();
      setLog(null);
    };
  }, [client, activityId]);
  return log;
}

const ActivityModelContext = createContext<RespondActivity | null>(null);

/**
 * Opens the activity for the components under it. `live` false reads it once rather than subscribing
 * (see `OpenOptions`); it goes live when `live` turns true, or on the first change made to it.
 */
export function ActivityModelProvider({ client, activityId, live = true, fallback = null, children }: { client: ActivityClient; activityId: string; live?: boolean; fallback?: ReactNode; children: ReactNode }) {
  const [model, setModel] = useState<RespondActivity | null>(() => {
    const open = loaded<RespondActivity>(client, activityId);
    return open && fits(client, open) ? open : null;
  });
  // Bumped when the model stops fitting (a training became a mission, say), for a new one.
  const [generation, setGeneration] = useState(0);
  // How to open it, when the lease opens it; once it's open, `live` turning true makes it live.
  const liveNow = useRef(live);
  liveNow.current = live;

  useEffect(() => {
    const lease = acquireActivityModel(client, activityId, { live: liveNow.current });
    let live = true;
    void lease.ready.then((m) => live && setModel(m));
    return () => {
      live = false;
      lease.release();
      setModel(null);
    };
  }, [client, activityId, generation]);

  useEffect(() => {
    if (model && live) client.goLive(activityId);
  }, [client, activityId, model, live]);

  useEffect(() => {
    if (!model) return;
    const check = () => !fits(client, model) && setGeneration((g) => g + 1);
    check();
    return client.subscribe(activityId, check);
  }, [client, activityId, model]);

  return model ? <ActivityModelContext.Provider value={model}>{children}</ActivityModelContext.Provider> : <>{fallback}</>;
}

function useModel(hook: string): RespondActivity {
  const model = useContext(ActivityModelContext);
  if (!model) throw new Error(`${hook} must be used inside an ActivityModelProvider`);
  return model;
}

/** The activity as every viewer sees it. Works for managers too, so respond screens can be shown to managers. */
export function useRespondActivity(): RespondActivity {
  return useModel('useRespondActivity');
}

/** The manage model. Throws for respond viewers: only manage screens call this. */
export function useManageActivity(): ManageActivity {
  const model = useModel('useManageActivity');
  if (!isManageActivity(model)) throw new Error('useManageActivity is for managers');
  return model;
}
