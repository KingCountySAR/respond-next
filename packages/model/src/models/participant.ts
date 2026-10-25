import { compareShallow, computed, computedStruct, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import {
  currentAssignment,
  currentParticipantStatus,
  fullName,
  participantTimeline,
  sameTarget,
  statusSteps,
  statusStepsUnder,
  timeOnClock,
  type StatusStep,
  targetName,
  type RespondContactRec,
  type RespondParticipantRec,
  type ParticipantRec,
  type ParticipantStatus,
  type ParticipantStatusRec,
  type Target,
} from '@sync/domain';
import type { ManageActivity, RespondActivity } from './activity';
import type { ManageKinds, Kinds } from './kinds';
import { RecordModel, unitRef, type UnitRef } from './record';
import type { ManageTeam } from './team';

export class RespondParticipant<R extends RespondParticipantRec = RespondParticipantRec, K extends Kinds = Kinds> extends RecordModel<R, K> {
  constructor(activity: RespondActivity<K>, id: string) {
    super(activity, id, 'participant');
    makeObservable(this, {
      name: computed,
      currentStatus: computed,
      status: computed,
      unit: computed,
      nextStatuses: computed({ equals: compareShallow }),
      tags: computed({ equals: compareShallow }),
      timeOnClock: computed,
      timeline: computed({ equals: compareShallow }),
      contact: computed,
      targetKind: computed,
      isMe: computed,
    });
  }

  get name(): string {
    const r = this.record;
    return r ? fullName(r) : '';
  }

  get currentStatus(): ParticipantStatusRec | undefined {
    return currentParticipantStatus(this.store, this.id);
  }

  get status(): ParticipantStatus {
    return this.currentStatus?.status ?? 'unknown';
  }

  /** The unit they're responding under now. */
  get unit(): K['unit'] | undefined {
    const unitId = this.currentStatus?.unitId;
    return unitId ? this.activity.unit(unitId) : undefined;
  }

  /**
   * The status buttons to offer, as the legacy app does: from the current status, the activity's
   * standby-only and light-mode rules, and whether sign-in has opened yet.
   */
  get nextStatuses(): ParticipantStatus[] {
    const activity = this.activity.record;
    return activity ? statusSteps(activity, this.status, this.activity.clock.now()) : [];
  }

  /** Status entries, newest first. */
  get timeline(): ParticipantStatusRec[] {
    return participantTimeline(this.store, this.id);
  }

  /** Phone and email from the member database. Members and managers only. */
  get contact(): RespondContactRec | undefined {
    return this.store.get<RespondContactRec>('contact', this.id);
  }

  /** Which kind of place they're at, null when unassigned, undefined when this viewer can't see it. */
  get targetKind(): Target['kind'] | null | undefined {
    if (!this.activity.canSeeAssignments) return undefined;
    return currentAssignment(this.store, this.id)?.target?.kind ?? null;
  }

  /**
   * The status buttons for this person acting under `unitId` (their own unit, when they act for
   * themselves). Active under another unit, they're offered switching or signing out of it.
   */
  statusStepsUnder(unitId: string): StatusStep[] {
    const activity = this.activity.record;
    const current = this.currentStatus;
    return activity ? statusStepsUnder(activity, current && { status: current.status, unitId: current.unitId }, unitId, this.activity.clock.now()) : [];
  }

  /** Member database tags, then the ones managers added for this activity. */
  get tags(): string[] {
    const r = this.record;
    return r ? [...r.memberTags, ...r.activityTags] : [];
  }

  /** Standby or responding: the statuses an ETA is kept for. */
  get isEnrouteOrStandby(): boolean {
    return this.status === 'standby' || this.status === 'responding';
  }

  /** Time on the clock so far, in ms; counts up while they're responding. */
  get timeOnClock(): number {
    return timeOnClock(this.store, this.id, this.activity.clock.now());
  }

  get isMe(): boolean {
    return this.activity.me?.id === this.id;
  }

  /** A local change to this person (record, status or assignment) hasn't been confirmed yet. */
  override get isPending(): boolean {
    const status = this.currentStatus;
    const assignment = currentAssignment(this.store, this.id);
    return (
      super.isPending || (!!status && this.store.isPending('participantStatus', status.id)) || (!!assignment && this.store.isPending('assignment', assignment.id))
    );
  }

  /**
   * Under their current unit unless `unit` is given; `at` defaults to now. Respond viewers may only
   * change themselves, within the activity's standby-only and light-mode rules.
   */
  setStatus(status: Exclude<ParticipantStatus, 'unknown'>, options: { at?: number; unit?: UnitRef } = {}): WireMutation {
    const unit = options.unit ?? this.unit?.record;
    if (!unit) throw new Error(`${this.name || 'This person'} has no unit to set a status under`);
    return this.activity.mutate('setParticipantStatus', { participantId: this.id, status, unit: unitRef(unit), at: options.at });
  }

  setEta(eta: number | null): WireMutation {
    return this.activity.mutate('setEta', { participantId: this.id, eta });
  }

  setMiles(miles: number | null): WireMutation {
    return this.activity.mutate('setMiles', { participantId: this.id, miles });
  }
}

export class ManageParticipant extends RespondParticipant<ParticipantRec, ManageKinds> {
  declare readonly activity: ManageActivity;

  constructor(activity: RespondActivity<ManageKinds>, id: string) {
    super(activity, id);
    makeObservable(this, {
      target: computedStruct,
      locationName: computed,
      team: computed,
    });
  }

  get target(): Target | null {
    return currentAssignment(this.store, this.id)?.target ?? null;
  }

  /** "Team 1", "Command Post", "unassigned". */
  get locationName(): string {
    return targetName(this.store, this.target);
  }

  get team(): ManageTeam | undefined {
    const t = this.target;
    return t?.kind === 'team' ? this.activity.team(t.id) : undefined;
  }

  /**
   * Whoever could take over the team this person leads when they leave it for `target`, when there's
   * a choice to make: two or more staying (one staying takes over by itself). Empty otherwise.
   */
  successorsLeaving(target: Target | null): ManageParticipant[] {
    const team = this.team;
    if (!team || team.leader?.id !== this.id || sameTarget(team.asTarget, target)) return [];
    const staying = team.members.filter((m) => m.id !== this.id);
    return staying.length >= 2 ? staying : [];
  }

  /** `newLeaderId` leads the team they leave, if they lead it (see `successorsLeaving`). */
  assign(target: Target | null, options: { asLeader?: boolean; newLeaderId?: string; at?: number } = {}): WireMutation {
    return this.activity.mutate('assign', { participantId: this.id, target, asLeader: options.asLeader, newLeaderId: options.newLeaderId, at: options.at });
  }

  /** Fixes a past status entry (from `timeline`): its status, its time, or both. */
  correctStatus(entryId: string, fix: { status?: Exclude<ParticipantStatus, 'unknown'>; at?: number }): WireMutation {
    return this.activity.mutate('correctParticipantStatus', { entryId, ...fix });
  }

  setActivityTags(tags: string[]): WireMutation {
    return this.activity.mutate('setActivityTags', { participantId: this.id, tags });
  }

  /** Points an ad-hoc entry at a real person, e.g. once they're found in the member database. */
  linkPerson(personRef: string): WireMutation {
    return this.activity.mutate('linkPerson', { participantId: this.id, personRef });
  }
}
