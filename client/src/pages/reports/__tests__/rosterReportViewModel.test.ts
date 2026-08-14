import { describe, expect, it } from 'vitest';

import { Activity, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';

import { buildClientStore } from '../../../lib/client/store';
import { activitiesReloaded } from '../../../lib/client/store/activities';
import { ActivityDomainModel } from '../../../models/activityDomainModel';
import { ObservableClock } from '../../../models/observableClock';
import { RosterViewModel } from '../rosterReportViewModel';

function participant(id: string, firstname: string, organizationId: string, status: ParticipantStatus): Participant {
  return { id, firstname, lastname: 'Rescuer', organizationId, timeline: [{ time: 0, organizationId, status }] };
}

function makeActivity(participants: Record<string, Participant>, organizations: Record<string, ParticipatingOrg> = {}): Activity {
  return { id: 'a1', title: 'Test', participants, organizations } as unknown as Activity;
}

const clock = new ObservableClock(false);

describe('RosterViewModel', () => {
  it('filters by org and sorts by name or status', () => {
    const store = buildClientStore([]);
    const participants = {
      p1: participant('p1', 'Zed', 'o1', ParticipantStatus.SignedIn),
      p2: participant('p2', 'Amy', 'o2', ParticipantStatus.Standby),
    };
    store.dispatch(activitiesReloaded({ list: [makeActivity(participants)] }));

    const domain = ActivityDomainModel.forStore(store, 'a1', clock);
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
