import { makeAutoObservable } from 'mobx';

import { isActive as isParticipantActive, OrganizationStatus, Participant, ParticipatingOrg } from '@respond/shared/types/activity';

/**
 * Domain model for a single participating organization: its display facts (name,
 * status) and active-responder count as computeds. Built with LIVE accessors
 * rather than snapshots so one stable instance keeps reacting as the org / roster
 * updates in the Redux read model — mirrors {@link ParticipantDomainModel}, and is
 * memoized per id by {@link ActivityDomainModel.getOrganization}.
 */
export class ParticipatingOrgDomainModel {
  constructor(
    private readonly getOrg: () => ParticipatingOrg,
    private readonly getParticipants: () => Record<string, Participant>,
  ) {
    makeAutoObservable<ParticipatingOrgDomainModel, 'getOrg' | 'getParticipants'>(this, { getOrg: false, getParticipants: false });
  }

  get org(): ParticipatingOrg {
    return this.getOrg();
  }

  get id(): string {
    return this.org.id;
  }

  get title(): string {
    return this.org.title;
  }

  get rosterName(): string | undefined {
    return this.org.rosterName;
  }

  /** Roster name if set, else the full title. */
  get name(): string {
    return this.org.rosterName ?? this.org.title;
  }

  get status(): OrganizationStatus {
    return this.org.timeline[0]?.status ?? OrganizationStatus.Unknown;
  }

  /** This org's currently-active responders. */
  get activeParticipantCount(): number {
    const id = this.id;
    return Object.values(this.getParticipants()).filter((p) => p.organizationId === id && isParticipantActive(p.timeline[0].status)).length;
  }

  dispose() {}
}
