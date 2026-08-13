import { makeAutoObservable } from 'mobx';

import { Activity, isActive as isParticipantStatusActive, ParticipantStatus, ParticipantUpdate } from '@respond/shared/types/activity';

import { isActive, isComplete } from '../../lib/client/store/activities';
import type { ActivityListDomainModel } from '../../models/activityListDomainModel';
import { ObservableClock } from '../../models/observableClock';
import type { OrganizationDomainModel } from '../../models/organizationDomainModel';
import type { UserDomainModel } from '../../models/userDomainModel';

const MAX_COMPLETED_VISIBLE = 3;
const COMPLETED_VISIBLE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MyParticipation {
  activity: Activity;
  status: ParticipantUpdate;
}

// Most recent first: missions sort by start time descending, other activities ascending.
function byRecency(a: Activity, b: Activity) {
  const sign = a.isMission ? -1 : 1;
  return a.startTime === b.startTime ? 0 : a.startTime > b.startTime ? sign : -sign;
}

/**
 * View model for the Home (event list) page. Combines the activity read model with
 * the logged-in user and tenant organization to derive what the page renders:
 * the user's current activities, the display-filtered mission/event lists, the
 * per-activity "my status" map, and the create-permission flags. The domain models
 * stay decoupled — this is where they're stitched together for the view.
 */
export class HomeViewModel {
  constructor(
    private readonly list: ActivityListDomainModel,
    private readonly user: UserDomainModel,
    private readonly organization: OrganizationDomainModel,
    private readonly clock: ObservableClock,
  ) {
    makeAutoObservable<HomeViewModel, 'list' | 'user' | 'organization'>(this, {
      list: false,
      user: false,
      organization: false,
    });
  }

  /** The logged-in user's participation across all activities, active first, mission-priority sorted. */
  get myParticipation(): MyParticipation[] {
    const participantId = this.user.participantId;
    if (!participantId) return [];

    const mine: MyParticipation[] = [];
    for (const activity of this.list.activities) {
      const myUpdate = activity.participants[participantId]?.timeline[0];
      if (myUpdate && myUpdate.status !== ParticipantStatus.NotResponding) {
        mine.push({ activity, status: myUpdate });
      }
    }

    return mine.sort((a, b) => {
      if (a.activity.isMission === b.activity.isMission) {
        return a.activity.startTime > b.activity.startTime ? 1 : -1;
      }
      return a.activity.isMission ? 1 : -1;
    });
  }

  /** The subset of my participation whose status is currently active (rendered in "My Activity"). */
  get myCurrentActivities(): MyParticipation[] {
    return this.myParticipation.filter((p) => isParticipantStatusActive(p.status.status));
  }

  /** activity id -> my participant status, for tagging tiles in the mission/event stacks. */
  get statusMap(): Record<string, ParticipantStatus> {
    return this.myParticipation.reduce<Record<string, ParticipantStatus>>((accum, cur) => {
      accum[cur.activity.id] = cur.status.status;
      return accum;
    }, {});
  }

  get missions(): Activity[] {
    return this.filterForDisplay(this.list.missions);
  }

  get events(): Activity[] {
    return this.filterForDisplay(this.list.events);
  }

  get canCreateMissions(): boolean {
    return this.organization.canCreateMissions;
  }

  get canCreateEvents(): boolean {
    return this.organization.canCreateEvents;
  }

  /** Active activities plus a bounded tail of recently-completed ones, sorted for display. */
  private filterForDisplay(activities: Activity[]): Activity[] {
    const oldestVisible = this.clock.time - COMPLETED_VISIBLE_DAYS * DAY_MS;
    const active = activities.filter(isActive).sort(byRecency);
    const complete = activities
      .filter((a) => isComplete(a) && a.startTime > oldestVisible)
      .sort(byRecency)
      .slice(0, MAX_COMPLETED_VISIBLE);
    return active.concat(complete);
  }
}
