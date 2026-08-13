import { describe, expect, it } from 'vitest';

import { Activity, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';

import { type AppStore, buildClientStore } from '../../lib/client/store';
import { activitiesReloaded } from '../../lib/client/store/activities';
import { ActivityDomainModel } from '../activityDomainModel';
import { ObservableClock } from '../observableClock';

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
    const model = new ActivityDomainModel(makeStore([activity]), 'a1', clock);
    expect(model.activity).toBe(activity);
    expect(model.readOnly).toBe(false);
    model.dispose();
  });

  it('is read-only when the activity is not in the live store', () => {
    const fallback = { id: 'a2', title: 'Archived' } as Activity;
    const model = new ActivityDomainModel(makeStore([]), 'a2', clock);
    expect(model.readOnly).toBe(true);
    model.setFallback(fallback);
    expect(model.activity).toBe(fallback);
    expect(model.readOnly).toBe(true);
    model.dispose();
  });

  describe('getParticipant', () => {
    it('returns a stable instance across updates that still reacts', () => {
      const store = buildClientStore([]);
      store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.Standby) })] }));

      const domain = new ActivityDomainModel(store, 'a1', clock);
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
