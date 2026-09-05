import { describe, expect, it } from 'vitest';

import { ActivityCommands } from '@respond/shared/commands';
import { ActivityEvents } from '@respond/shared/events';
import { Activity } from '@respond/shared/types/activity';

import { buildClientStore } from '../../lib/client/store';
import { ReduxProjection } from '../reduxProjection';

describe('ReduxProjection', () => {
  it('mirrors the selected value and follows the store once connected', () => {
    const store = buildClientStore([]);
    const projection = new ReduxProjection(store, (state) => state.activities.list);
    projection.connect();

    expect(projection.value).toEqual([]);

    const activity = { id: 'a1', title: 'Test', isMission: true } as Activity;
    store.dispatch({ type: 'activities/reloaded', payload: { list: [activity] } });

    expect(projection.value).toEqual([activity]);
    projection.dispose();
  });

  describe('dispatchAndWait', () => {
    it('resolves with the event once a matching event is dispatched', async () => {
      const store = buildClientStore([]);
      const projection = new ReduxProjection(store, (state) => state.activities.list);

      const pending = projection.dispatchAndWait(ActivityCommands.RemoveActivity('a1'), [ActivityEvents.ActivityRemoved.type]);
      // Simulate the server round-trip: the event action reaches the store.
      store.dispatch(ActivityEvents.ActivityRemoved('a1'));

      const resolved = await pending;
      expect(resolved.type).toBe(ActivityEvents.ActivityRemoved.type);
    });

    it('rejects when no matching event arrives before the timeout', async () => {
      const store = buildClientStore([]);
      const projection = new ReduxProjection(store, (state) => state.activities.list);

      await expect(projection.dispatchAndWait(ActivityCommands.RemoveActivity('a1'), ['evt/never/happens'], 20)).rejects.toThrow(/timed out/);
    });
  });
});
