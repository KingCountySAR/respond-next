import type { UnknownAction } from '@reduxjs/toolkit';
import { format as formatDate } from 'date-fns';
import { makeAutoObservable, onBecomeObserved, onBecomeUnobserved, reaction, runInAction } from 'mobx';

import { apiFetch } from '@respond/lib/api';
import { ParticipantCommands } from '@respond/shared/commands';
import { getStatusCssColor, getStatusText, isActive, isEnrouteOrStandby, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';
import { MemberInfo } from '@respond/shared/types/member';

import { ObservableClock } from './observableClock';

function isOnClock(status: ParticipantStatus) {
  return status !== ParticipantStatus.Standby && isActive(status);
}

/**
 * Domain model for a single participant: the derived facts of a Participant
 * (current status, status text, org name, …) as computeds. Built with LIVE
 * accessors rather than snapshots so one stable instance keeps reacting as the
 * participant updates in the Redux model — the accessors read the activity ref
 * (frozen, swapped wholesale by reducers), so these computeds recompute.
 */
export class ParticipantDomainModel {
  private infoObserved: boolean = false;
  private memberInfo: MemberInfo | undefined = undefined;
  private readonly disposeInfoWatcher: () => void;

  constructor(
    private readonly getParticipant: () => Participant,
    private readonly getOrganizations: () => Record<string, ParticipatingOrg>,
    private readonly clock: ObservableClock,
    private readonly activityId: string,
    private readonly dispatch: (command: UnknownAction) => void,
  ) {
    makeAutoObservable<ParticipantDomainModel, 'getParticipant' | 'getOrganizations' | 'activityId' | 'dispatch'>(this, { getParticipant: false, getOrganizations: false, activityId: false, dispatch: false });

    // We want to be able to lazy-load member info from the membership provider.
    // To do that, we'll keep track of whether or not someone is observing the value. If so,
    // whenever the id or (more probably,) organization changes, we'll do the fetch and update the info.
    onBecomeObserved(this, 'memberInfo', () => runInAction(() => (this.infoObserved = true)));
    onBecomeUnobserved(this, 'memberInfo', () => runInAction(() => (this.infoObserved = false)));
    this.disposeInfoWatcher = reaction(
      () => ({ run: this.infoObserved, orgId: this.organizationId, id: this.id }),
      (args) => {
        this.memberInfo = undefined;
        if (args.run) {
          apiFetch<{ data: MemberInfo }>(`/api/v1/organizations/${args.orgId}/members/${args.id}`) //
            .then((result) => runInAction(() => (this.memberInfo = result.data)));
        }
      },
    );
  }

  get participant(): Participant {
    return this.getParticipant();
  }

  get id(): string {
    return this.participant.id;
  }

  get firstName(): string {
    return this.participant?.firstname;
  }

  get lastName(): string {
    return this.participant.lastname;
  }

  get fullName(): string {
    return `${this.participant.firstname} ${this.participant.lastname}`;
  }

  get photoUrl(): string {
    return `/api/v1/organizations/${this.organizationId}/members/${this.id}/photo`;
  }

  get mobilePhone(): string {
    const info = this.memberInfo;
    return info?.mobilephone ? info.mobilephone.replace(/\D/g, '') : '';
  }

  get mobilePhoneFormatted(): string {
    if (this?.mobilePhone) {
      const match = this.mobilePhone.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return ['(', match[2], ') ', match[3], '-', match[4]].join('');
      }
    }
    return '';
  }

  get email(): string {
    const info = this.memberInfo;
    return info?.email ?? '';
  }

  get organizationId(): string {
    return this.participant.organizationId;
  }

  get organizationName(): string {
    const p = this.participant;
    const org = this.getOrganizations()?.[p.organizationId];
    return org?.rosterName ?? org?.title ?? '';
  }

  get tags(): string[] {
    return this.participant.tags ?? [];
  }

  get eta(): number | undefined {
    return this.participant.eta;
  }

  get etaText(): string {
    return this.isEnrouteOrStandby && this.eta != undefined ? formatDate(this.eta, 'HHmm') : '';
  }

  get miles(): number | undefined {
    return this.participant.miles;
  }

  get status(): ParticipantStatus {
    return this.participant.timeline[0].status;
  }

  get statusText(): string {
    const status = this.status;
    return status === undefined ? '' : getStatusText(status);
  }

  get statusColor(): string {
    const status = this.status;
    return status === undefined ? '' : getStatusCssColor(status);
  }

  // I think there's a lot of redunancy in these status flags. Shim them here for now, consolidate later.
  get isActive(): boolean {
    return isActive(this.status);
  }

  get timeOnClock(): number {
    let timeOnClock = 0;
    const lastUpdate = this.participant.timeline[0];
    let lastTime: number = isOnClock(lastUpdate.status) ? this.clock.time : lastUpdate.time;
    for (const t of this.participant.timeline) {
      if (isOnClock(t.status)) {
        timeOnClock += lastTime - t.time;
      }

      lastTime = t.time;
    }
    return timeOnClock;
  }

  get isEnrouteOrStandby(): boolean {
    return !!isEnrouteOrStandby(this.status);
  }

  /**
   * Set this participant's total miles. The activity id is bound into the model
   * (a participant can't move between activities), so callers pass only the value
   * — no activity/participant id plumbing at the call site.
   */
  updateMiles(miles: number) {
    this.dispatch(ParticipantCommands.UpdateParticipantMiles(this.activityId, this.id, miles));
  }

  /** Set this participant's ETA (null clears it). Ids are bound into the model. */
  updateEta(eta: number | null) {
    this.dispatch(ParticipantCommands.UpdateParticipantEta(this.activityId, this.id, eta));
  }

  dispose() {
    this.disposeInfoWatcher();
  }
}
