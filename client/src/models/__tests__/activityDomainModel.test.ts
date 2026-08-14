import { runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';

import { Activity, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';

import { type AppStore, buildClientStore } from '../../lib/client/store';
import { activitiesReloaded } from '../../lib/client/store/activities';
import { ActivityDomainModel } from '../activityDomainModel';
import { ObservableClock } from '../observableClock';
import { ReduxProjection } from '../reduxProjection';

function participant(id: string, firstname: string, organizationId: string, status: ParticipantStatus): Participant {
  return { id, firstname, lastname: 'Rescuer', organizationId, timeline: [{ time: 0, organizationId, status }] };
}

function makeActivity(participants: Record<string, Participant>, organizations: Record<string, ParticipatingOrg> = {}): Activity {
  return { id: 'a1', title: 'Test', participants, organizations } as unknown as Activity;
}

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

const clock = new ObservableClock();

describe('ActivityDomainModel', () => {
  it('constructs and observes without makeObservable field errors', () => {
    const activity = { id: 'a1', title: 'Test' } as Activity;
    const model = ActivityDomainModel.forStore(makeStore([activity]), 'a1', clock);
    expect(model.activity).toBe(activity);
    expect(model.readOnly).toBe(false);
    model.dispose();
  });

  it('is read-only when the activity is not in the live store', () => {
    const fallback = { id: 'a2', title: 'Archived' } as Activity;
    const model = ActivityDomainModel.forStore(makeStore([]), 'a2', clock);
    expect(model.readOnly).toBe(true);
    model.setFallback(fallback);
    expect(model.activity).toBe(fallback);
    expect(model.readOnly).toBe(true);
    model.dispose();
  });

  describe('status derivations (projected row model)', () => {
    // startTime 1000, opens for sign-in at 800 (early window 200); one active
    // responder (SignedIn) and one not (NotResponding).
    function seed(store: ReturnType<typeof buildClientStore>, overrides: Partial<Activity> = {}) {
      const { participants: participantOverride, ...rest } = overrides;
      const activity = {
        id: 'a1',
        title: 'Test',
        startTime: 1000,
        earlySignInWindow: 200,
        organizations: {},
        ...rest,
        participants: {
          p1: participant('p1', 'Pat', 'o1', ParticipantStatus.SignedIn),
          p2: participant('p2', 'Sam', 'o1', ParticipantStatus.NotResponding),
          ...participantOverride,
        },
      } as unknown as Activity;
      store.dispatch(activitiesReloaded({ list: [activity] }));
    }

    function projectedModel(store: ReturnType<typeof buildClientStore>, clk: ObservableClock) {
      const projection = new ReduxProjection<Activity[]>(store, (s) => s.activities.list);
      projection.connect();
      return ActivityDomainModel.projected(projection, 'a1', clk);
    }

    it('derives status/timing against the clock and reacts as time advances', () => {
      const store = buildClientStore([]);
      seed(store);
      const clk = new ObservableClock(false);
      const model = projectedModel(store, clk);

      runInAction(() => (clk.time = 500)); // before sign-in opens
      expect(model.startsInFuture).toBe(true);
      expect(model.statusText).toBe('Not Started');
      expect(model.activeParticipantCount).toBe(1);

      runInAction(() => (clk.time = 850)); // sign-in window open, not yet started
      expect(model.statusText).toBe('Open For Sign In');

      runInAction(() => (clk.time = 1100)); // past start time
      expect(model.startsInFuture).toBe(false);
      expect(model.statusText).toBe('In Progress');
      expect(model.isActive).toBe(true);
    });

    it('reads live out of the list projection and follows updates', () => {
      const store = buildClientStore([]);
      seed(store);
      const model = projectedModel(store, new ObservableClock(false));
      expect(model.activeParticipantCount).toBe(1);
      expect(model.readOnly).toBe(false);

      // A second responder signs in.
      seed(store, { participants: { p2: participant('p2', 'Sam', 'o1', ParticipantStatus.SignedIn) } });
      expect(model.activeParticipantCount).toBe(2);

      // Closing the activity flips status to 'Closed' regardless of clock.
      seed(store, { endTime: 1200 });
      expect(model.statusText).toBe('Closed');
      expect(model.isComplete).toBe(true);
    });
  });

  describe('getParticipant', () => {
    it('returns a stable instance across updates that still reacts', () => {
      const store = buildClientStore([]);
      store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.Standby) })] }));

      const domain = ActivityDomainModel.forStore(store, 'a1', clock);
      domain.connect();

      const first = domain.getParticipant('p1');
      expect(first?.statusText).toBe('Standby');

      store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.SignedIn) })] }));
      const second = domain.getParticipant('p1');

      expect(second).toBe(first); // same instance
      expect(second?.statusText).toBe('Responding'); // reacts
      domain.dispose();
    });
  });
});
