import { makeAutoObservable } from 'mobx';

import { getStatusText, isEnrouteOrStandby, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/shared/types/activity';

/**
 * Domain model for a single participant: the derived facts of a Participant
 * (current status, status text, org name, …) as computeds. Built with LIVE
 * accessors rather than snapshots so one stable instance keeps reacting as the
 * participant updates in the Redux model — the accessors read the activity ref
 * (frozen, swapped wholesale by reducers), so these computeds recompute.
 */
export class ParticipantDomainModel {
  constructor(
    private readonly getParticipant: () => Participant | undefined,
    private readonly getOrganizations: () => Record<string, ParticipatingOrg> | undefined,
  ) {
    makeAutoObservable<ParticipantDomainModel, 'getParticipant' | 'getOrganizations'>(this, { getParticipant: false, getOrganizations: false });
  }

  get participant(): Participant | undefined {
    return this.getParticipant();
  }

  get exists(): boolean {
    return !!this.participant;
  }

  get id(): string | undefined {
    return this.participant?.id;
  }

  get firstName(): string {
    return this.participant?.firstname ?? '';
  }

  get lastName(): string {
    return this.participant?.lastname ?? '';
  }

  get fullName(): string {
    const p = this.participant;
    return p ? `${p.firstname} ${p.lastname}` : '';
  }

  get organizationId(): string | undefined {
    return this.participant?.organizationId;
  }

  get organizationName(): string {
    const p = this.participant;
    if (!p) return '';
    const org = this.getOrganizations()?.[p.organizationId];
    return org?.rosterName ?? org?.title ?? '';
  }

  get tags(): string[] {
    return this.participant?.tags ?? [];
  }

  get eta(): number | undefined {
    return this.participant?.eta;
  }

  get miles(): number | undefined {
    return this.participant?.miles;
  }

  get status(): ParticipantStatus | undefined {
    return this.participant?.timeline[0]?.status;
  }

  get statusText(): string {
    const status = this.status;
    return status === undefined ? '' : getStatusText(status);
  }

  get isEnrouteOrStandby(): boolean {
    return !!isEnrouteOrStandby(this.status);
  }
}
