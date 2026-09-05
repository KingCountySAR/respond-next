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

  describe('getStatusTransitions', () => {
    // startTime 1000, opens for sign-in at 800 (early window 200).
    function seed(store: ReturnType<typeof buildClientStore>, overrides: Partial<Activity> = {}) {
      const activity = {
        id: 'a1',
        title: 'Test',
        startTime: 1000,
        earlySignInWindow: 200,
        forceStandbyOnly: false,
        organizations: { o1: { id: 'o1', title: 'Org One', timeline: [] } },
        participants: {},
        ...overrides,
      } as unknown as Activity;
      store.dispatch(activitiesReloaded({ list: [activity] }));
    }

    function model(store: ReturnType<typeof buildClientStore>, clk: ObservableClock) {
      const projection = new ReduxProjection<Activity[]>(store, (s) => s.activities.list);
      projection.connect();
      return ActivityDomainModel.projected(projection, 'a1', clk);
    }

    it('offers the normal options once sign-in is open', () => {
      const store = buildClientStore([]);
      seed(store);
      const clk = new ObservableClock(false);
      runInAction(() => (clk.time = 900)); // past the sign-in window (opens 800)
      const actions = model(store, clk).getStatusTransitions(ParticipantStatus.NotResponding, 'o1', 'o1');
      expect(actions.map((a) => a.newStatus)).toEqual([ParticipantStatus.SignedIn, ParticipantStatus.Standby, ParticipantStatus.Remote]);
    });

    it('restricts to standby-only before sign-in opens', () => {
      const store = buildClientStore([]);
      seed(store);
      const clk = new ObservableClock(false);
      runInAction(() => (clk.time = 500)); // before the sign-in window opens
      const actions = model(store, clk).getStatusTransitions(ParticipantStatus.NotResponding, 'o1', 'o1');
      expect(actions.map((a) => a.newStatus)).toEqual([ParticipantStatus.Standby]);
    });

    it('restricts to standby-only for a non-responder when the activity is standby-only', () => {
      const store = buildClientStore([]);
      seed(store, { forceStandbyOnly: true });
      const clk = new ObservableClock(false);
      runInAction(() => (clk.time = 900)); // sign-in open, but standby-only in effect
      const actions = model(store, clk).getStatusTransitions(ParticipantStatus.NotResponding, 'o1', 'o1');
      expect(actions.map((a) => a.newStatus)).toEqual([ParticipantStatus.Standby]);
    });

    it('offers a cross-org switch pair when acting under a different org', () => {
      const store = buildClientStore([]);
      seed(store);
      const clk = new ObservableClock(false);
      runInAction(() => (clk.time = 900));
      const actions = model(store, clk).getStatusTransitions(ParticipantStatus.SignedIn, 'o1', 'o2');
      expect(actions).toHaveLength(2);
      expect(actions[0].text).toBe('Switch from Org One');
      expect(actions[1].newStatus).toBe(ParticipantStatus.SignedOut);
      expect(actions[1].text).toBe('Sign Out from Org One');
    });
  });

  describe('recordStatusUpdate', () => {
    function capturingStore(activities: Activity[]) {
      const dispatched: Array<{ type: string }> = [];
      const store = {
        getState: () => ({ activities: { list: activities } }),
        subscribe: () => () => undefined,
        dispatch: (action: { type: string }) => {
          dispatched.push(action);
          return action;
        },
      } as unknown as AppStore;
      return { store, dispatched };
    }

    const params = { participantId: 'p1', firstName: 'Pat', lastName: 'Rescuer', org: { id: 'o1', title: 'Org One' }, time: 5, status: ParticipantStatus.SignedIn };

    it('appends the org timeline for a first responder, then updates the participant', () => {
      const { store, dispatched } = capturingStore([makeActivity({}, {})]);
      const domain = ActivityDomainModel.forStore(store, 'a1', clock);
      domain.recordStatusUpdate(params);
      // Org timeline first, then the participant.
      expect(dispatched.map((a) => a.type)).toEqual(['cmd/activity/appendOrg', 'cmd/participant/update']);
    });

    it('skips the org timeline when the org already participates', () => {
      const { store, dispatched } = capturingStore([makeActivity({}, { o1: { id: 'o1', title: 'Org One', timeline: [] } as unknown as ParticipatingOrg })]);
      const domain = ActivityDomainModel.forStore(store, 'a1', clock);
      domain.recordStatusUpdate(params);
      expect(dispatched.map((a) => a.type)).toEqual(['cmd/participant/update']);
    });

    it('is a no-op when the activity is read-only', () => {
      const { store, dispatched } = capturingStore([]); // a1 absent -> read-only
      const domain = ActivityDomainModel.forStore(store, 'a1', clock);
      domain.recordStatusUpdate(params);
      expect(dispatched).toHaveLength(0);
    });
  });
});
