import { describe, expect, it, vi } from 'vitest';

import { Activity, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';
import type { UserInfo } from '@respond/shared/types/userInfo';

// ParticipantDomainModel lazily fetches member contact info via apiFetch when
// memberInfo is observed / the participant's org or id changes. Mock it so tests
// don't hit the network (preserving the module's other exports).
vi.mock('@respond/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@respond/lib/api')>()),
  apiFetch: vi.fn(async () => {
    console.log('BBB');
    throw new Error('ha');
  }),
}));

import { buildClientStore } from '../../../lib/client/store';
import { activitiesReloaded } from '../../../lib/client/store/activities';
import { AuthActions } from '../../../lib/client/store/auth';
import { ActivityDomainModel } from '../../../models/activityDomainModel';
import { ObservableClock } from '../../../models/observableClock';
import { UserDomainModel } from '../../../models/userDomainModel';
import { ActivityViewModel } from '../activityViewModel';

function participant(id: string, firstname: string, organizationId: string, status: ParticipantStatus): Participant {
  return { id, firstname, lastname: 'Rescuer', organizationId, timeline: [{ time: 0, organizationId, status }] };
}

function makeActivity(participants: Record<string, Participant>, organizations: Record<string, ParticipatingOrg> = {}): Activity {
  return { id: 'a1', title: 'Test', participants, organizations } as unknown as Activity;
}

const clock = new ObservableClock(false);

describe('ActivityViewModel', () => {
  describe('myParticipation', () => {
    it('projects the logged-in user participation and propagates Redux changes', () => {
      const store = buildClientStore([]);
      store.dispatch(AuthActions.set({ userInfo: { participantId: 'p1' } as UserInfo }));
      store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.Standby) })] }));

      const user = new UserDomainModel(store);
      user.connect();
      const domain = new ActivityDomainModel(store, 'a1', clock);
      domain.connect();
      const vm = new ActivityViewModel(domain, user);

      expect(vm.myParticipation?.statusText).toBe('Standby');

      store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.SignedIn) })] }));
      expect(vm.myParticipation?.statusText).toBe('Responding');

      user.dispose();
      domain.dispose();
    });

    it('is undefined when the user is not a participant', () => {
      const store = buildClientStore([]);
      store.dispatch(AuthActions.set({ userInfo: { participantId: 'someone-else' } as UserInfo }));
      store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.Standby) })] }));

      const user = new UserDomainModel(store);
      user.connect();
      const domain = new ActivityDomainModel(store, 'a1', clock);
      domain.connect();

      expect(new ActivityViewModel(domain, user).myParticipation).toBeUndefined();

      user.dispose();
      domain.dispose();
    });
  });
});
