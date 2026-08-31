import { describe, expect, it } from 'vitest';

import { CommsEvents, TeamEvents } from '@respond/shared/events';
import { Activity, Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { createNewCommsEntry, createNewPlace, createNewTeam, Team } from '@respond/shared/types/operations';

import { type AppStore, buildClientStore } from '../../lib/client/store';
import { activitiesReloaded } from '../../lib/client/store/activities';
import { ObservableClock } from '../observableClock';
import { OperationDomainModel } from '../operationDomainModel';

const clock = new ObservableClock(false);

function participant(id: string, firstname: string): Participant {
  return { id, firstname, lastname: 'Rescuer', organizationId: 'o1', timeline: [{ time: 0, organizationId: 'o1', status: ParticipantStatus.SignedIn }] };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  const team: Team = { ...createNewTeam('Team 1'), id: 't1', assignedParticipants: ['p1'] };
  return {
    id: 'a1',
    title: 'Test Op',
    startTime: 1000,
    organizations: {},
    participants: { p1: participant('p1', 'Pat'), p2: participant('p2', 'Sam') },
    teams: [team],
    places: [{ ...createNewPlace('Command Post'), id: 'cp' }],
    comms: [{ ...createNewCommsEntry({ message: 'radio check' }), id: 'c1' }],
    staff: { IC: 'p1' },
    ...overrides,
  } as unknown as Activity;
}

function seed(overrides: Partial<Activity> = {}) {
  const store = buildClientStore([]);
  store.dispatch(activitiesReloaded({ list: [makeActivity(overrides)] }));
  const model = OperationDomainModel.forStore(store, 'a1', clock);
  model.connect();
  return { store, model };
}

/** A store that captures dispatched actions (for command assertions). */
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

describe('OperationDomainModel', () => {
  it('inherits activity-level getters from ActivityDomainModel', () => {
    const { model } = seed();
    expect(model.title).toBe('Test Op');
    expect(model.readOnly).toBe(false);
    expect(model.hasOperations).toBe(true);
    expect(model.staff).toEqual({ IC: 'p1' });
    expect(model.participants.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    model.dispose();
  });

  it('vends team / place / log item models and lookups', () => {
    const { model } = seed();
    expect(model.teams.map((t) => t.name)).toEqual(['Team 1']);
    expect(model.getTeam('t1')?.name).toBe('Team 1');
    expect(model.getTeam('nope')).toBeUndefined();

    expect(model.places.map((p) => p.name)).toEqual(['Command Post']);
    expect(model.getPlace('cp')?.isDefault).toBe(true);

    expect(model.logs.map((l) => l.message)).toEqual(['radio check']);
    expect(model.getLog('c1')?.message).toBe('radio check');
    model.dispose();
  });

  it('resolves assigned members to shared ParticipantDomainModel identities', () => {
    const { model } = seed();
    const team = model.getTeam('t1')!;
    expect(team.members.map((m) => m.fullName)).toEqual(['Pat Rescuer']);
    // Same instance the roster hands out — stable identity.
    expect(team.leader).toBe(model.getParticipant('p1'));
    model.dispose();
  });

  it('cascades Redux updates through the item models (stable identity)', () => {
    const { store, model } = seed();

    store.dispatch(TeamEvents.TeamCreated('a1', { ...createNewTeam('Team 2'), id: 't2' }));
    expect(model.teams.map((t) => t.name)).toEqual(['Team 1', 'Team 2']);

    // An update reflects on the SAME item instance.
    const team1 = model.getTeam('t1')!;
    store.dispatch(TeamEvents.TeamUpdated('a1', { id: 't1', gar: 'red' }));
    expect(model.getTeam('t1')).toBe(team1);
    expect(team1.gar).toBe('red');

    store.dispatch(CommsEvents.CommLogged('a1', { ...createNewCommsEntry({ message: 'second' }), id: 'c2' }));
    store.dispatch(CommsEvents.CommUpdated('a1', 'c1', { isDeleted: true }));
    expect(model.logs.map((l) => l.message)).toEqual(['radio check', 'second']);
    expect(model.visibleLogs.map((l) => l.message)).toEqual(['second']);
    model.dispose();
  });

  describe('commands', () => {
    it('dispatches create/log commands', () => {
      const { store, dispatched } = capturingStore([makeActivity()]);
      const model = OperationDomainModel.forStore(store, 'a1', clock);

      model.createTeam({ ...createNewTeam('Team 9'), id: 't9' });
      model.createPlace({ ...createNewPlace('Staging'), id: 'st' });
      model.logComm({ message: 'hello' });

      expect(dispatched.map((a) => a.type)).toEqual(['cmd/team/create', 'cmd/place/create', 'cmd/comm/log']);
    });

    it('is a no-op when read-only', () => {
      const { store, dispatched } = capturingStore([]); // a1 absent -> read-only
      const model = OperationDomainModel.forStore(store, 'a1', clock);
      model.createTeam({ ...createNewTeam('Team 9'), id: 't9' });
      expect(dispatched).toHaveLength(0);
    });
  });
});
