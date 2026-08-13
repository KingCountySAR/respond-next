import { makeAutoObservable, observableRef } from 'mobx';

import { ActivityCommands } from '@respond/shared/commands';
import { ActivityEvents } from '@respond/shared/events';
import { Activity, Participant } from '@respond/shared/types/activity';

import { getActivityStatus, isActive } from '../store/activities';

import { ActivityDomainModel } from './ActivityDomainModel';
import { ParticipantDomainModel } from './ParticipantDomainModel';
import { RosterViewModel } from './RosterViewModel';
import { UserDomainModel } from './UserDomainModel';

/**
 * Sits between the domain model (Redux projection) and the React UI. Holds:
 *  - `@computed` derivations that were previously inlined across components,
 *  - ephemeral UI state (filters, selection, dialog flags) that never belonged
 *    in the Redux timeline,
 *  - action methods that dispatch commands — commands stay in Redux (ClientSync
 *    forwards them; the server events reduce back in), so the devtools timeline
 *    is preserved. This is exactly what `useActivityCommands` did, absorbed here.
 */
export class ActivityViewModel {
  // Ephemeral UI state that never belonged in the Redux timeline.
  selectedParticipant: Participant | undefined = undefined;
  participantDialogOpen = false;

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
      // Holds a frozen Participant from the Redux store — keep it a ref.
      selectedParticipant: observableRef,
    });
  }

  get activity(): Activity | undefined {
    return this.domain.activity;
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

  // --- UI state actions ---

  openParticipant(participant: Participant) {
    this.selectedParticipant = participant;
    this.participantDialogOpen = true;
  }

  closeParticipantDialog() {
    this.participantDialogOpen = false;
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
