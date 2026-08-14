import { makeAutoObservable } from 'mobx';

import { ActivityDomainModel } from '../../models/activityDomainModel';
import { ParticipantDomainModel } from '../../models/participantDomainModel';
import { UserDomainModel } from '../../models/userDomainModel';
import { RosterViewModel } from '../reports/rosterReportViewModel';

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
    readonly domain: ActivityDomainModel,
    private readonly user: UserDomainModel,
  ) {
    this.roster = new RosterViewModel(domain);
    makeAutoObservable<ActivityViewModel, 'domain' | 'user'>(this, {
      domain: false,
      user: false,
      roster: false,
    });
  }

  get activityLoaded(): boolean {
    return !!this.domain.activity;
  }

  get title(): string {
    return this.domain.activity?.title ?? '';
  }

  get isActive(): boolean {
    return this.domain.isActive;
  }

  get numberAndTitle(): string {
    const activity = this.domain.activity;
    return activity ? `${activity.idNumber} ${activity.title}` : '';
  }

  get statusText(): string {
    return this.domain.statusText;
  }

  /** True for an inactive activity fetched from the API — commands are disabled. */
  get readOnly(): boolean {
    return this.domain.readOnly;
  }

  get url(): string {
    return this.domain.path;
  }

  /** The logged-in user's participation in this activity, or undefined if none. */
  get myParticipation(): ParticipantDomainModel | undefined {
    return this.domain.getParticipant(this.user.participantId);
  }

  // --- Command actions (delegated to the domain model, which owns dispatch) ---

  toggleStatus() {
    if (this.isActive) {
      this.domain.markComplete();
    } else {
      this.domain.reactivate();
    }
  }

  async remove() {
    await this.domain.remove();
  }
}
