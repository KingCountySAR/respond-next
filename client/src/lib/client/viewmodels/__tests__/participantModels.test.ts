import { autorun, observable, runInAction } from 'mobx';
import { describe, expect, it, vi } from 'vitest';

import { ParticipantCommands } from '@respond/shared/commands';
import { Activity, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';
import type { MemberInfo } from '@respond/shared/types/member';
import type { UserInfo } from '@respond/shared/types/userInfo';

// ParticipantDomainModel lazily fetches member contact info via apiFetch when
// memberInfo is observed / the participant's org or id changes. Mock it so tests
// don't hit the network (preserving the module's other exports).
vi.mock('@respond/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@respond/lib/api')>()),
  apiFetch: vi.fn(async () => ({
    data: {
      id: 'p1',
      name: 'Pat Rescuer',
      given_name: 'Pat',
      family_name: 'Rescuer',
      groups: [],
      email: 'pat@example.org',
      mobilephone: '15551234567',
    } satisfies MemberInfo,
  })),
}));

import { buildClientStore } from '../../store';
import { activitiesReloaded } from '../../store/activities';
import { AuthActions } from '../../store/auth';
import { ActivityDomainModel } from '../ActivityDomainModel';
import { ActivityViewModel } from '../ActivityViewModel';
import { ObservableClock } from '../observableClock';
import { ParticipantDomainModel } from '../ParticipantDomainModel';
import { RosterViewModel } from '../RosterViewModel';
import { UserDomainModel } from '../UserDomainModel';

function participant(id: string, firstname: string, organizationId: string, status: ParticipantStatus): Participant {
  return { id, firstname, lastname: 'Rescuer', organizationId, timeline: [{ time: 0, organizationId, status }] };
}

function makeActivity(participants: Record<string, Participant>, organizations: Record<string, ParticipatingOrg> = {}): Activity {
  return { id: 'a1', title: 'Test', participants, organizations } as unknown as Activity;
}

const clock = new ObservableClock(false);

describe('ParticipantDomainModel', () => {
  it('reacts to the underlying participant and resolves the org name', () => {
    const box = observable.box<Participant>(participant('p1', 'Jane', 'o2', ParticipantStatus.Assigned), { deep: false });
    const orgs: Record<string, ParticipatingOrg> = { o1: { id: 'o1', title: 'Org One', rosterName: 'ORG1', timeline: [] } };
    const pdm = new ParticipantDomainModel(
      () => box.get(),
      () => orgs,
      clock,
      'a1',
      () => {},
    );

    const seen: string[] = [];
    const stop = autorun(() => seen.push(pdm.statusText));

    runInAction(() => box.set(participant('p1', 'Pat', 'o1', ParticipantStatus.Standby)));
    runInAction(() => box.set(participant('p1', 'Pat', 'o1', ParticipantStatus.SignedIn)));

    expect(seen).toEqual(['Assigned', 'Standby', 'Responding']);
    expect(pdm.isEnrouteOrStandby).toBe(true);
    expect(pdm.organizationName).toBe('ORG1');
    stop();
  });

  it('counts timeOnClock', () => {
    let reduxModel = participant('p1', 'Jane', 'o2', ParticipantStatus.SignedIn);
    const box = observable.box<Participant>(reduxModel, { deep: false });
    const orgs: Record<string, ParticipatingOrg> = { o1: { id: 'o1', title: 'Org One', rosterName: 'ORG1', timeline: [] } };
    const pdm = new ParticipantDomainModel(
      () => box.get(),
      () => orgs,
      clock,
      'a1',
      () => {},
    );
    function updateStatus(status: ParticipantStatus, time: number) {
      reduxModel = {
        ...reduxModel,
        timeline: [{ status, time, organizationId: reduxModel.timeline[0].organizationId }, ...reduxModel.timeline],
      };
      box.set(reduxModel);
    }
    runInAction(() => (clock.time = 42));
    expect(pdm.timeOnClock).toBe(42);
    runInAction(() => (clock.time = 64));
    expect(pdm.timeOnClock).toBe(64);

    runInAction(() => {
      updateStatus(ParticipantStatus.Standby, 100);
      updateStatus(ParticipantStatus.SignedIn, 150);
      clock.time = 160;
    });
    expect(pdm.timeOnClock).toBe(160 - 150 + 100);
  });

  it('dispatches a miles command bound to its activity and participant', () => {
    const box = observable.box<Participant>(participant('p7', 'Pat', 'o1', ParticipantStatus.SignedIn), { deep: false });
    const dispatch = vi.fn();
    const pdm = new ParticipantDomainModel(
      () => box.get(),
      () => ({}),
      clock,
      'act-42',
      dispatch,
    );

    pdm.updateMiles(12);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: ParticipantCommands.UpdateParticipantMiles.type,
      payload: { activityId: 'act-42', participantId: 'p7', miles: 12 },
    });
  });

  it('dispatches an eta command bound to its activity and participant', () => {
    const box = observable.box<Participant>(participant('p7', 'Pat', 'o1', ParticipantStatus.Standby), { deep: false });
    const dispatch = vi.fn();
    const pdm = new ParticipantDomainModel(
      () => box.get(),
      () => ({}),
      clock,
      'act-42',
      dispatch,
    );

    pdm.updateEta(1_700_000_000_000);
    pdm.updateEta(null); // clear

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: ParticipantCommands.UpdateParticipantEta.type,
      payload: { activityId: 'act-42', participantId: 'p7', eta: 1_700_000_000_000 },
    });
    expect(dispatch.mock.calls[1][0]).toMatchObject({
      type: ParticipantCommands.UpdateParticipantEta.type,
      payload: { activityId: 'act-42', participantId: 'p7', eta: null },
    });
  });
});

describe('ActivityViewModel.myParticipation', () => {
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

describe('ActivityDomainModel.getParticipant', () => {
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

describe('RosterViewModel', () => {
  it('filters by org and sorts by name or status', () => {
    const store = buildClientStore([]);
    const participants = {
      p1: participant('p1', 'Zed', 'o1', ParticipantStatus.SignedIn),
      p2: participant('p2', 'Amy', 'o2', ParticipantStatus.Standby),
    };
    store.dispatch(activitiesReloaded({ list: [makeActivity(participants)] }));

    const domain = new ActivityDomainModel(store, 'a1', clock);
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
