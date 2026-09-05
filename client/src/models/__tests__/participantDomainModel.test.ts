import { autorun, observable, runInAction } from 'mobx';
import { describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@respond/lib/api';
import { ParticipantCommands } from '@respond/shared/commands';
import { Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';
import type { MemberInfo } from '@respond/shared/types/member';

// ParticipantDomainModel lazily fetches member contact info via apiFetch when
// memberInfo is observed / the participant's org or id changes. Mock it so tests
// don't hit the network (preserving the module's other exports). vitest hoists
// this above the imports, so the apiFetch imported above is the mock.
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

import { ObservableClock } from '../observableClock';
import { ParticipantDomainModel } from '../participantDomainModel';

function participant(id: string, firstname: string, organizationId: string, status: ParticipantStatus): Participant {
  return { id, firstname, lastname: 'Rescuer', organizationId, timeline: [{ time: 0, organizationId, status }] };
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

  it('lazily fetches member contact info once observed and exposes email/phone', async () => {
    const box = observable.box<Participant>(participant('p1', 'Pat', 'o1', ParticipantStatus.SignedIn), { deep: false });
    const pdm = new ParticipantDomainModel(
      () => box.get(),
      () => ({}),
      clock,
      'a1',
      () => {},
    );

    // Nothing is observing memberInfo yet, so no network fetch has fired.
    expect(apiFetch).not.toHaveBeenCalled();
    expect(pdm.email).toBe('');
    expect(pdm.mobilePhone).toBe('');
    expect(pdm.mobilePhoneFormatted).toBe('');

    // Observing the fetched-info getters flips infoObserved on and triggers the fetch.
    const stop = autorun(() => {
      void pdm.email;
      void pdm.mobilePhoneFormatted;
    });

    await vi.waitFor(() => {
      expect(pdm.email).toBe('pat@example.org');
      expect(pdm.mobilePhone).toBe('15551234567');
      expect(pdm.mobilePhoneFormatted).toBe('(555) 123-4567');
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/organizations/o1/members/p1');
    stop();
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
