import { describe, expect, it } from 'vitest';

import { ActivityCommands } from '@respond/shared/commands';
import { ActivityEvents } from '@respond/shared/events';
import { Activity } from '@respond/shared/types/activity';

import { type AppStore, buildClientStore } from '../../store';
import { ActivityDomainModel } from '../ActivityDomainModel';

function makeStore(activities: Activity[]): AppStore {
  const listeners = new Set<() => void>();
  return {
    getState: () => ({ activities: { list: activities } }),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispatch: () => undefined,
  } as unknown as AppStore;
}

describe('ActivityDomainModel', () => {
  it('constructs and observes without makeObservable field errors', () => {
    const activity = { id: 'a1', title: 'Test' } as Activity;
    const model = new ActivityDomainModel(makeStore([activity]), 'a1');
    expect(model.activity).toBe(activity);
    expect(model.readOnly).toBe(false);
    model.dispose();
  });

  it('is read-only when the activity is not in the live store', () => {
    const fallback = { id: 'a2', title: 'Archived' } as Activity;
    const model = new ActivityDomainModel(makeStore([]), 'a2');
    expect(model.readOnly).toBe(true);
    model.setFallback(fallback);
    expect(model.activity).toBe(fallback);
    expect(model.readOnly).toBe(true);
    model.dispose();
  });

  describe('dispatchAndWait', () => {
    it('resolves with the event once a matching event is dispatched', async () => {
      const store = buildClientStore([]);
      const model = new ActivityDomainModel(store, 'a1');

      const pending = model.dispatchAndWait(ActivityCommands.RemoveActivity('a1'), [ActivityEvents.ActivityRemoved.type]);
      // Simulate the server round-trip: the event action reaches the store.
      store.dispatch(ActivityEvents.ActivityRemoved('a1'));

      const resolved = await pending;
      expect(resolved.type).toBe(ActivityEvents.ActivityRemoved.type);
      model.dispose();
    });

    it('rejects when no matching event arrives before the timeout', async () => {
      const store = buildClientStore([]);
      const model = new ActivityDomainModel(store, 'a1');

      await expect(model.dispatchAndWait(ActivityCommands.RemoveActivity('a1'), ['evt/never/happens'], 20)).rejects.toThrow(/timed out/);
      model.dispose();
    });
  });
});
