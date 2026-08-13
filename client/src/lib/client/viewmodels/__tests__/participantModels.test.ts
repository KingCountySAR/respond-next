import { autorun, observable, runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';

import { Activity, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';
import type { UserInfo } from '@respond/shared/types/userInfo';

import { buildClientStore } from '../../store';
import { activitiesReloaded } from '../../store/activities';
import { AuthActions } from '../../store/auth';
import { ActivityDomainModel } from '../ActivityDomainModel';
import { ActivityViewModel } from '../ActivityViewModel';
import { ParticipantDomainModel } from '../ParticipantDomainModel';
import { RosterViewModel } from '../RosterViewModel';
import { UserDomainModel } from '../UserDomainModel';

function participant(id: string, firstname: string, organizationId: string, status: ParticipantStatus): Participant {
  return { id, firstname, lastname: 'Rescuer', organizationId, timeline: [{ time: 0, organizationId, status }] };
}

function makeActivity(participants: Record<string, Participant>, organizations: Record<string, ParticipatingOrg> = {}): Activity {
  return { id: 'a1', title: 'Test', participants, organizations } as unknown as Activity;
}

describe('ParticipantDomainModel', () => {
  it('reacts to the underlying participant and resolves the org name', () => {
    const box = observable.box<Participant | undefined>(undefined, { deep: false });
    const orgs: Record<string, ParticipatingOrg> = { o1: { id: 'o1', title: 'Org One', rosterName: 'ORG1', timeline: [] } };
    const pdm = new ParticipantDomainModel(
      () => box.get(),
      () => orgs,
    );

    const seen: string[] = [];
    const stop = autorun(() => seen.push(pdm.statusText));

    runInAction(() => box.set(participant('p1', 'Pat', 'o1', ParticipantStatus.Standby)));
    runInAction(() => box.set(participant('p1', 'Pat', 'o1', ParticipantStatus.SignedIn)));

    expect(seen).toEqual(['', 'Standby', 'Responding']);
    expect(pdm.isEnrouteOrStandby).toBe(true);
    expect(pdm.organizationName).toBe('ORG1');
    stop();
  });
});

describe('ActivityViewModel.myParticipation', () => {
  it('projects the logged-in user participation and propagates Redux changes', () => {
    const store = buildClientStore([]);
    store.dispatch(AuthActions.set({ userInfo: { participantId: 'p1' } as UserInfo }));
    store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.Standby) })] }));

    const user = new UserDomainModel(store);
    user.connect();
    const domain = new ActivityDomainModel(store, 'a1');
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
    const domain = new ActivityDomainModel(store, 'a1');
    domain.connect();

    expect(new ActivityViewModel(domain, user).myParticipation).toBeUndefined();

    user.dispose();
    domain.dispose();
  });
});

describe('ActivityDomainModel.getParticipant', () => {
  it('returns a stable instance across updates that still reacts', () => {
    const store = buildClientStore([]);
    store.dispatch(activitiesReloaded({ list: [makeActivity({ p1: participant('p1', 'Pat', 'o1', ParticipantStatus.Standby) })] }));

    const domain = new ActivityDomainModel(store, 'a1');
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

describe('RosterViewModel', () => {
  it('filters by org and sorts by name or status', () => {
    const store = buildClientStore([]);
    const participants = {
      p1: participant('p1', 'Zed', 'o1', ParticipantStatus.SignedIn),
      p2: participant('p2', 'Amy', 'o2', ParticipantStatus.Standby),
    };
    store.dispatch(activitiesReloaded({ list: [makeActivity(participants)] }));

    const domain = new ActivityDomainModel(store, 'a1');
    domain.connect();
    const roster = new RosterViewModel(domain);

    // Default: alphabetical by first name.
    expect(roster.participants.map((p) => p.firstName)).toEqual(['Amy', 'Zed']);

    // Status sort: SignedIn ranks above Standby.
    roster.setSortOnStatus(true);
    expect(roster.participants.map((p) => p.id)).toEqual(['p1', 'p2']);

    // Org filter narrows the list.
    roster.setFilter('o2');
    expect(roster.participants.map((p) => p.id)).toEqual(['p2']);

    domain.dispose();
  });
});
