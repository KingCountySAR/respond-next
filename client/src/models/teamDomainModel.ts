import { makeAutoObservable } from 'mobx';

import { EquipmentItem, SarGar, Team, TeamStatus } from '@respond/shared/types/operations';

import { ParticipantDomainModel } from './participantDomainModel';

const TEAM_GAR_COLORS: Record<SarGar, string> = {
  green: 'green',
  amber: 'goldenrod',
  red: 'darkred',
};

/**
 * Domain model for a single team: its display facts as computeds, plus its
 * assigned members resolved to (stable) {@link ParticipantDomainModel}s. Built
 * with LIVE accessors rather than snapshots so one instance keeps reacting as the
 * team changes in the Redux read model — mirrors {@link ParticipantDomainModel} /
 * ParticipatingOrgDomainModel, and is memoized per id by OperationDomainModel.
 */
export class TeamDomainModel {
  constructor(
    private readonly getTeam: () => Team | undefined,
    private readonly resolveParticipant: (id: string) => ParticipantDomainModel | undefined,
  ) {
    makeAutoObservable<TeamDomainModel, 'getTeam' | 'resolveParticipant'>(this, { getTeam: false, resolveParticipant: false });
  }

  /** The backing team, or undefined once it's been removed from the activity. */
  get team(): Team | undefined {
    return this.getTeam();
  }

  /** Whether the team still exists — guards the asserting field getters below. */
  get exists(): boolean {
    return !!this.getTeam();
  }

  get id(): string {
    return this.team!.id;
  }

  get name(): string {
    return this.team!.name;
  }

  get gar(): SarGar {
    return this.team!.gar;
  }

  get status(): TeamStatus {
    return this.team!.status;
  }

  get assignment(): string | undefined {
    return this.team?.assignment;
  }

  get notes(): string | undefined {
    return this.team?.notes;
  }

  get isDisbanded(): boolean {
    return this.status === 'Disbanded';
  }

  get assignedParticipantIds(): string[] {
    return this.team?.assignedParticipants ?? [];
  }

  get assignedEquipment(): EquipmentItem[] {
    return this.team?.assignedEquipment ?? [];
  }

  get statusColorCode(): string {
    if (this.isDisbanded || !this.team) return 'grey';
    return TEAM_GAR_COLORS[this.team.gar];
  }
  /**
   * The assigned responders as ParticipantDomainModels, in assignment order (the
   * first is the team lead). Ids that no longer resolve to a participant are
   * dropped. Identity is stable — the models come from the activity's memoized
   * per-id cache.
   */
  get members(): ParticipantDomainModel[] {
    return this.assignedParticipantIds.map((id) => this.resolveParticipant(id)).filter((p): p is ParticipantDomainModel => !!p);
  }

  /** The team lead — the first assigned member — or undefined if unassigned. */
  get leader(): ParticipantDomainModel | undefined {
    return this.members[0];
  }

  dispose() {}
}
