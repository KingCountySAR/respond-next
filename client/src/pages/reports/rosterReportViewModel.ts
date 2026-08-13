import { makeAutoObservable } from 'mobx';

import { ParticipantStatus } from '@respond/shared/types/activity';

import { ActivityDomainModel } from '../../models/activityDomainModel';
import { ParticipantDomainModel } from '../../models/participantDomainModel';

const STATUS_SORT_ORDER = [
  ParticipantStatus.SignedIn,
  ParticipantStatus.Available,
  ParticipantStatus.Assigned,
  ParticipantStatus.Demobilized,
  ParticipantStatus.Remote,
  ParticipantStatus.Standby,
  ParticipantStatus.SignedOut,
  ParticipantStatus.NotResponding,
];

const etaRank = (status: ParticipantStatus | undefined) => (status !== undefined && [ParticipantStatus.Standby, ParticipantStatus.SignedIn].includes(status) ? 1 : 0);

const sortByStatus = (a: ParticipantDomainModel, b: ParticipantDomainModel) => {
  const statusIndexA = STATUS_SORT_ORDER.indexOf(a.status ?? ParticipantStatus.NotResponding);
  const statusIndexB = STATUS_SORT_ORDER.indexOf(b.status ?? ParticipantStatus.NotResponding);
  return statusIndexA - statusIndexB || etaRank(b.status) - etaRank(a.status) || (a.eta ?? Infinity) - (b.eta ?? Infinity);
};

const sortAlphabetical = (a: ParticipantDomainModel, b: ParticipantDomainModel) => a.firstName.localeCompare(b.firstName);

/**
 * View model for the roster list: owns the roster's view state (org filter + sort
 * mode) and exposes the filtered/sorted participants. The entries are the domain
 * model's stable ParticipantDomainModels, so identity survives updates and the
 * rows carry their own computed facts (statusText, organizationName, …).
 */
export class RosterViewModel {
  /** Organization id to filter to, or '' for all. */
  filter = '';
  sortOnStatus = false;

  constructor(private readonly domain: ActivityDomainModel) {
    makeAutoObservable<RosterViewModel, 'domain'>(this, { domain: false });
  }

  setFilter(organizationId: string) {
    this.filter = organizationId;
  }

  setSortOnStatus(sortOnStatus: boolean) {
    this.sortOnStatus = sortOnStatus;
  }

  get participants(): ParticipantDomainModel[] {
    const list = this.filter ? this.domain.participants.filter((p) => p.organizationId === this.filter) : [...this.domain.participants];
    return list.sort(this.sortOnStatus ? sortByStatus : sortAlphabetical);
  }
}
