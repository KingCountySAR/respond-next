import { makeAutoObservable } from 'mobx';

import { ParticipantStatus } from '@respond/shared/types/activity';

import type { ActivityDomainModel } from '../../models/activityDomainModel';
import type { ActivityListDomainModel } from '../../models/activityListDomainModel';
import { ObservableClock } from '../../models/observableClock';
import type { OrganizationDomainModel } from '../../models/organizationDomainModel';
import type { ParticipantDomainModel } from '../../models/participantDomainModel';
import type { UserDomainModel } from '../../models/userDomainModel';

const MAX_COMPLETED_VISIBLE = 3;
const COMPLETED_VISIBLE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MyParticipation {
  activity: ActivityDomainModel;
  participant: ParticipantDomainModel;
}

// Most recent first: missions sort by start time descending, other activities ascending.
function byRecency(a: ActivityDomainModel, b: ActivityDomainModel) {
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
    for (const activity of this.list.activityModels) {
      const participant = activity.getParticipant(participantId);
      if (participant && participant.status !== ParticipantStatus.NotResponding) {
        mine.push({ activity, participant });
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
    return this.myParticipation.filter((p) => p.participant.isActive);
  }

  /** activity id -> my participant status, for tagging tiles in the mission/event stacks. */
  get statusMap(): Record<string, ParticipantStatus> {
    return this.myParticipation.reduce<Record<string, ParticipantStatus>>((accum, cur) => {
      accum[cur.activity.id] = cur.participant.status;
      return accum;
    }, {});
  }

  get missions(): ActivityDomainModel[] {
    return this.filterForDisplay(this.list.activityModels.filter((m) => m.isMission));
  }

  get events(): ActivityDomainModel[] {
    return this.filterForDisplay(this.list.activityModels.filter((m) => !m.isMission));
  }

  get canCreateMissions(): boolean {
    return this.organization.canCreateMissions;
  }

  get canCreateEvents(): boolean {
    return this.organization.canCreateEvents;
  }

  /** Active activities plus a bounded tail of recently-completed ones, sorted for display. */
  private filterForDisplay(models: ActivityDomainModel[]): ActivityDomainModel[] {
    const oldestVisible = this.clock.time - COMPLETED_VISIBLE_DAYS * DAY_MS;
    const active = models.filter((m) => m.isActive).sort(byRecency);
    const complete = models
      .filter((m) => m.isComplete && m.startTime > oldestVisible)
      .sort(byRecency)
      .slice(0, MAX_COMPLETED_VISIBLE);
    return active.concat(complete);
  }
}
