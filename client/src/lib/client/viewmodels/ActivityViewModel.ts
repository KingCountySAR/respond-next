import { makeAutoObservable } from 'mobx';

import { ActivityCommands } from '@respond/shared/commands';
import { ActivityEvents } from '@respond/shared/events';
import { Activity } from '@respond/shared/types/activity';

import { getActivityStatus, isActive } from '../store/activities';

import { ActivityDomainModel } from './ActivityDomainModel';
import { ParticipantDomainModel } from './ParticipantDomainModel';
import { RosterViewModel } from './RosterViewModel';
import { UserDomainModel } from './UserDomainModel';

/**
 * Sits between the domain model (Redux projection) and the React UI. Holds:
 *  - `@computed` derivations that were previously inlined across components,
 *  - child view models (the roster) that own their own view state,
 *  - action methods that dispatch commands — commands stay in Redux (ClientSync
 *    forwards them; the server events reduce back in), so the devtools timeline
 *    is preserved.
 *
 * Purely per-component ephemeral UI state (e.g. which participant's dialog is
 * open) lives in the components, not here.
 */
export class ActivityViewModel {
  // The roster list view model (org filter + sort + the filtered/sorted list).
  readonly roster: RosterViewModel;

  constructor(
    private readonly domain: ActivityDomainModel,
    private readonly user: UserDomainModel,
  ) {
    this.roster = new RosterViewModel(domain);
    makeAutoObservable<ActivityViewModel, 'domain' | 'user'>(this, {
      domain: false,
      user: false,
      roster: false,
    });
  }

  get activity(): Activity | undefined {
    return this.domain.activity;
  }

  get title(): string {
    return this.domain.activity?.title ?? '';
  }

  get isActive(): boolean {
    const activity = this.activity;
    return activity ? isActive(activity) : false;
  }

  get numberAndTitle(): string {
    const activity = this.activity;
    return activity ? `${activity.idNumber} ${activity.title}` : '';
  }

  get statusText(): string {
    const activity = this.activity;
    return activity ? getActivityStatus(activity) : '';
  }

  /** True for an inactive activity fetched from the API — commands are disabled. */
  get readOnly(): boolean {
    return this.domain.readOnly;
  }

  get url(): string {
    const activity = this.activity;
    return activity ? `/${activity.isMission ? 'mission' : 'event'}/${activity.id}` : '/';
  }

  /** The logged-in user's participation in this activity, or undefined if none. */
  get myParticipation(): ParticipantDomainModel | undefined {
    return this.domain.getParticipant(this.user.participantId);
  }

  // --- Command actions (dispatched into the Redux timeline) ---

  toggleStatus() {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    if (this.isActive) {
      this.domain.dispatch(ActivityCommands.CompleteActivity(activity.id, Date.now()));
    } else {
      this.domain.dispatch(ActivityCommands.ReactivateActivity(activity.id));
    }
  }

  async remove() {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    await this.domain.dispatchAndWait(ActivityCommands.RemoveActivity(activity.id), [ActivityEvents.ActivityRemoved.type]);
  }
}
