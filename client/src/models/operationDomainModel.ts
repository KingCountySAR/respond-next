import { CommsCommands, type LogCommInput, PlaceCommands, TeamCommands } from '@respond/shared/commands';
import { Activity } from '@respond/shared/types/activity';
import { Place, Team } from '@respond/shared/types/operations';

import { type AppStore } from '../lib/client/store';

import { ActivityDomainModel } from './activityDomainModel';
import { LogDomainModel } from './logDomainModel';
import { ObservableClock } from './observableClock';
import { PlaceDomainModel } from './placeDomainModel';
import { ReduxProjection } from './reduxProjection';
import { TeamDomainModel } from './teamDomainModel';

/**
 * The operations dashboard's domain model. EXTENDS {@link ActivityDomainModel} so
 * the ops feature binds to a single model that carries both the activity-level
 * operations (title, status, complete/reactivate, participants, …) AND the
 * operations collections — teams, places, and the communications log — plus the
 * commands that mutate them, rather than proxying each fact up through a wrapper.
 *
 * There is no per-collection coordinator: this model plays that role directly,
 * vending memoized-per-id {@link TeamDomainModel} / {@link PlaceDomainModel} /
 * {@link LogDomainModel}s (stable identity across updates, incl. removal→re-add)
 * exactly as {@link ActivityDomainModel} does for participants/organizations. The
 * item models read the live activity ref through accessors, so every Redux update
 * cascades through them for free — no additional store subscription — and their
 * assigned responders resolve via the inherited (memoized) getParticipant, sharing
 * ParticipantDomainModel identity with the roster.
 */
export class OperationDomainModel extends ActivityDomainModel {
  private readonly teamModels = new Map<string, TeamDomainModel>();
  private readonly placeModels = new Map<string, PlaceDomainModel>();
  private readonly logModels = new Map<string, LogDomainModel>();

  /** Store-backed model for the operations page (owns a store subscription + fallback). */
  static forStore(store: AppStore, activityId: string, clock: ObservableClock): OperationDomainModel {
    return new OperationDomainModel(OperationDomainModel.storeSource(store, activityId), activityId, clock);
  }

  /** Row model over a shared list projection — cheap, no per-row subscription. */
  static projected(projection: ReduxProjection<Activity[]>, activityId: string, clock: ObservableClock): OperationDomainModel {
    return new OperationDomainModel(OperationDomainModel.projectedSource(projection, activityId), activityId, clock);
  }

  /** The role → participant-id staff assignment map. */
  get staff(): Record<string, string> {
    return this.activity?.staff ?? {};
  }

  private resolveParticipant = (id: string) => this.getParticipant(id);

  // --- Teams ---

  getTeam(teamId: string | undefined): TeamDomainModel | undefined {
    if (!teamId || !this.activity?.teams?.some((t) => t.id === teamId)) {
      return undefined;
    }
    let model = this.teamModels.get(teamId);
    if (!model) {
      model = new TeamDomainModel(() => this.activity?.teams?.find((t) => t.id === teamId), this.resolveParticipant);
      this.teamModels.set(teamId, model);
    }
    return model;
  }

  get teams(): TeamDomainModel[] {
    return (this.activity?.teams ?? []).map((t) => this.getTeam(t.id)!);
  }

  /** Add a team. No-op when read-only or unloaded. */
  createTeam(team: Team) {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    this.dispatch(TeamCommands.CreateTeam(activity.id, team));
  }

  // --- Places ---

  getPlace(placeId: string | undefined): PlaceDomainModel | undefined {
    if (!placeId || !this.activity?.places?.some((p) => p.id === placeId)) {
      return undefined;
    }
    let model = this.placeModels.get(placeId);
    if (!model) {
      model = new PlaceDomainModel(() => this.activity?.places?.find((p) => p.id === placeId), this.resolveParticipant);
      this.placeModels.set(placeId, model);
    }
    return model;
  }

  get places(): PlaceDomainModel[] {
    return (this.activity?.places ?? []).map((p) => this.getPlace(p.id)!);
  }

  /** Add a place. No-op when read-only or unloaded. */
  createPlace(place: Place) {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    this.dispatch(PlaceCommands.CreatePlace(activity.id, place));
  }

  // --- Communications log ---

  getLog(entryId: string | undefined): LogDomainModel | undefined {
    if (!entryId || !this.activity?.comms?.some((e) => e.id === entryId)) {
      return undefined;
    }
    let model = this.logModels.get(entryId);
    if (!model) {
      model = new LogDomainModel(() => this.activity?.comms?.find((e) => e.id === entryId));
      this.logModels.set(entryId, model);
    }
    return model;
  }

  get logs(): LogDomainModel[] {
    return (this.activity?.comms ?? []).map((e) => this.getLog(e.id)!);
  }

  /** The log with soft-deleted entries filtered out. */
  get visibleLogs(): LogDomainModel[] {
    return this.logs.filter((l) => !l.isDeleted);
  }

  /** Log a comms entry (the server stamps its id/timestamp). No-op when read-only or unloaded. */
  logComm(entry: LogCommInput) {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    this.dispatch(CommsCommands.LogComm(activity.id, entry));
  }

  get assignedMembers() {
    if (!this.hasOperations) return [];

    // find everyone assigned to a team or place
    const assignedParticipantIds: string[] = [...new Set([...this.teams.flatMap((t) => t.assignedParticipantIds), ...this.places.flatMap((p) => p.assignedParticipantIds)])];

    return assignedParticipantIds.map((pId) => this.getParticipant(pId));
  }

  // get assignableMembers() {
  //   if (!this.hasOperations) return [];

  // }

  override dispose() {
    this.teamModels.forEach((t) => t.dispose());
    this.placeModels.forEach((p) => p.dispose());
    this.logModels.forEach((l) => l.dispose());
    super.dispose();
  }
}
