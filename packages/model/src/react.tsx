/**
 * The only React part of the model: open an activity for a subtree and hand out its model. Components
 * read the model directly inside `observer(...)`; there are no per-component data hooks.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SyncClient } from '@sync/client';
import { createActivityModel, isCommandActivity, type CommandActivity, type FieldActivity } from './models';

export { observer, Observer } from 'mobx-react-lite';

interface Entry {
  refs: number;
  ready: Promise<FieldActivity>;
  model?: FieldActivity;
}

/** One model per client and activity, shared by every provider showing it. */
const entries = new WeakMap<SyncClient, Map<string, Entry>>();

/**
 * Opens the activity on the client (if it isn't already) and returns its shared model. Call `release`
 * when done; the last release disposes the model and closes the activity.
 */
export function acquireActivityModel(client: SyncClient, activityId: string): { ready: Promise<FieldActivity>; release: () => void } {
  let byActivity = entries.get(client);
  if (!byActivity) entries.set(client, (byActivity = new Map()));
  let entry = byActivity.get(activityId);
  if (!entry) {
    const e: Entry = {
      refs: 0,
      ready: client.open(activityId).then(() => (e.model = createActivityModel(client, activityId))),
    };
    byActivity.set(activityId, (entry = e));
  }
  const held = entry;
  held.refs++;
  let released = false;
  return {
    ready: held.ready,
    release: () => {
      if (released) return;
      released = true;
      held.refs--;
      // Deferred, so a remount in the same tick (StrictMode, moving a subtree) keeps the activity open.
      queueMicrotask(() => {
        if (held.refs > 0 || byActivity.get(activityId) !== held) return;
        byActivity.delete(activityId);
        void held.ready.then((model) => {
          model.dispose();
          client.close(activityId);
        });
      });
    },
  };
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
