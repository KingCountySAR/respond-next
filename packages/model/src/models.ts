/**
 * Readable objects over one activity: `activity.phase`, `activity.participants[0].status`, `team.members`.
 * Every derived value is a MobX computed that calls the domain query, so the rules live in one place
 * (`@sync/domain`) and an `observer` component re-renders only when a value it read changes.
 *
 * Two levels, because the views nest: `FieldActivity` is what every viewer can read, and `CommandActivity`
 * extends it with what only command sees and does. A field record type says which fields a field
 * viewer gets; fields only members get are optional, because external people don't get them.
 *
 * Writes go through `client.mutate`, never into the observables: the change shows up when the
 * client's next snapshot is applied, which happens synchronously.
 */
import { compareShallow, computed, computedStruct, makeObservable } from 'mobx';
import type { SyncClient } from '@sync/client';
import type { WireMutation } from '@sync/core';
import {
  ACTIVITY_INDEXES,
  asActivityViewer,
  currentAssignment,
  currentParticipantStatus,
  activityPhase,
  findParticipantByPersonRef,
  fullName,
  getActivity,
  hasOperations,
  activityProjector,
  participantIdFor,
  statusCounts,
  targetName,
  teamMembers,
  teamStatusOf,
  type ActivityPhase,
  type ActivityRec,
  type ActivityUnitRec,
  type FieldActivityRec,
  type FieldParticipantRec,
  type FieldTeamRec,
  type ParticipantRec,
  type ParticipantStatus,
  type ParticipantStatusRec,
  type Target,
  type TeamRec,
  type TeamStatus,
  type ViewKey,
} from '@sync/domain';
import { Clock } from './clock';
import { RecordStore } from './store';

export interface ActivityModelOptions {
  /** Defaults to the client's server-corrected clock, ticking each second. */
  clock?: Clock;
}

/** The classes one level of the hierarchy uses, so subclasses get precise types without overrides. */
interface Kinds {
  activity: FieldActivityRec;
  participant: FieldParticipant;
  team: FieldTeam;
}
interface CommandKinds extends Kinds {
  activity: ActivityRec;
  participant: CommandParticipant;
  team: CommandTeam;
}

/** The model for the client's viewer: `CommandActivity` for command and support, else `FieldActivity`. */
export function createActivityModel(client: SyncClient, activityId: string, options?: ActivityModelOptions): FieldActivity {
  return activityProjector.viewKey(client.viewer) === 'command' ? new CommandActivity(client, activityId, options) : new FieldActivity(client, activityId, options);
}

export const isCommandActivity = (model: FieldActivity): model is CommandActivity => model instanceof CommandActivity;

// --- Activities -----------------------------------------------------------------------------------

/** What every viewer can read and do. */
export class FieldActivity<K extends Kinds = Kinds> {
  readonly store = new RecordStore(ACTIVITY_INDEXES);
  readonly clock: Clock;
  readonly viewKey: ViewKey;
  private readonly participantModels = new Map<string, K['participant']>();
  private readonly teamModels = new Map<string, K['team']>();
  private readonly unsubscribe: () => void;

  /** The activity must already be open on the client (`await client.open(activityId)`). */
  constructor(
    protected readonly client: SyncClient,
    readonly activityId: string,
    options: ActivityModelOptions = {},
  ) {
    this.clock = options.clock ?? new Clock(() => client.now());
    this.viewKey = activityProjector.viewKey(client.viewer) as ViewKey;
    makeObservable(this, {
      record: computed,
      phase: computed,
      hasOperations: computed,
      participants: computed({ equals: compareShallow }),
      me: computed,
      teams: computed({ equals: compareShallow }),
      statusCounts: computedStruct,
    });
    this.store.apply(client.snapshot(activityId));
    this.unsubscribe = client.subscribe(activityId, () => this.store.apply(client.snapshot(activityId)));
  }

  /** Stops following the client. Doesn't close the activity on the client. */
  dispose(): void {
    this.unsubscribe();
  }

  /** External people get no assignments, so where someone is can't be shown to them. */
  get canSeeAssignments(): boolean {
    return this.viewKey !== 'field:external';
  }

  get record(): K['activity'] | undefined {
    return getActivity(this.store) as K['activity'] | undefined;
  }

  get phase(): ActivityPhase | undefined {
    const rec = this.record;
    return rec && activityPhase(rec as ActivityRec, this.clock.now());
  }

  /** False in light mode: no teams, groups, places, equipment or comms. */
  get hasOperations(): boolean {
    return hasOperations(this.record as ActivityRec | undefined);
  }

  /** Sorted by last name, then first. */
  get participants(): K['participant'][] {
    const recs = [...this.store.scan<ParticipantRec>('participant')];
    recs.sort((a, b) => a.lastname.localeCompare(b.lastname) || a.firstname.localeCompare(b.firstname));
    return recs.map((r) => this.participantModel(r.id));
  }

  participant(id: string): K['participant'] | undefined {
    return this.store.get('participant', id) ? this.participantModel(id) : undefined;
  }

  /** The viewer's own entry, once they've signed in. */
  get me(): K['participant'] | undefined {
    const personRef = asActivityViewer(this.client.viewer).personRef;
    if (!personRef) return undefined;
    return this.participant(participantIdFor(personRef)) ?? this.participant(findParticipantByPersonRef(this.store, personRef)?.id ?? '');
  }

  get teams(): K['team'][] {
    const recs = [...this.store.scan<TeamRec>('team')];
    recs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return recs.map((r) => this.teamModel(r.id));
  }

  team(id: string): K['team'] | undefined {
    return this.store.get('team', id) ? this.teamModel(id) : undefined;
  }

  get statusCounts(): Record<ParticipantStatus, number> {
    return statusCounts(this.store);
  }

  /** Any change by name; see `@sync/domain` for names and args. Throws Rejection if refused locally. */
  mutate(name: string, args: Record<string, unknown>): WireMutation {
    return this.client.mutate(this.activityId, name, args);
  }

  protected createParticipant(id: string): K['participant'] {
    return new FieldParticipant(this, id) as K['participant'];
  }

  protected createTeam(id: string): K['team'] {
    return new FieldTeam(this, id) as K['team'];
  }

  /** Models are cached by id, so a component holding one keeps the same object. */
  private participantModel(id: string): K['participant'] {
    let m = this.participantModels.get(id);
    if (!m) this.participantModels.set(id, (m = this.createParticipant(id)));
    return m;
  }

  private teamModel(id: string): K['team'] {
    let m = this.teamModels.get(id);
    if (!m) this.teamModels.set(id, (m = this.createTeam(id)));
    return m;
  }
}

/** Command and support: every record in full, and the operations actions. */
export class CommandActivity extends FieldActivity<CommandKinds> {
  protected override createParticipant(id: string): CommandParticipant {
    return new CommandParticipant(this, id);
  }

  protected override createTeam(id: string): CommandTeam {
    return new CommandTeam(this, id);
  }
}

// --- Participants -----------------------------------------------------------------------------

export class FieldParticipant<R extends FieldParticipantRec = FieldParticipantRec> {
  constructor(
    readonly activity: FieldActivity,
    readonly id: string,
  ) {
    makeObservable(this, {
      record: computed,
      name: computed,
      currentStatus: computed,
      status: computed,
      targetKind: computed,
      isMe: computed,
      isPending: computed,
    });
  }

  protected get store(): RecordStore {
    return this.activity.store;
  }

  /** As this viewer sees it. */
  get record(): R | undefined {
    return this.store.get<ParticipantRec>('participant', this.id) as R | undefined;
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

  /** Which kind of place they're at, null when unassigned, undefined when this viewer can't see it. */
  get targetKind(): Target['kind'] | null | undefined {
    if (!this.activity.canSeeAssignments) return undefined;
    return currentAssignment(this.store, this.id)?.target?.kind ?? null;
  }

  get isMe(): boolean {
    return this.activity.me === this;
  }

  /** A local change to this person (record, status or assignment) hasn't been confirmed yet. */
  get isPending(): boolean {
    const status = this.currentStatus;
    const assignment = currentAssignment(this.store, this.id);
    return (
      this.store.isPending('participant', this.id) ||
      (!!status && this.store.isPending('participantStatus', status.id)) ||
      (!!assignment && this.store.isPending('assignment', assignment.id))
    );
  }

  /**
   * Under their current unit unless `unitId` is given; `at` defaults to now. Field viewers may only
   * change themselves, within the activity's standby-only and light-mode rules.
   */
  setStatus(status: Exclude<ParticipantStatus, 'unknown'>, options: { at?: number; unitId?: string } = {}): WireMutation {
    const unitId = options.unitId ?? this.currentStatus?.unitId;
    const unit = unitId ? this.store.get<ActivityUnitRec>('activityUnit', unitId) : undefined;
    if (!unit) throw new Error(`${this.name || 'This person'} has no unit to set a status under`);
    return this.activity.mutate('setParticipantStatus', {
      participantId: this.id,
      status,
      unit: { id: unit.id, title: unit.title, rosterName: unit.rosterName },
      at: options.at,
    });
  }

  setEta(eta: number | null): WireMutation {
    return this.activity.mutate('setEta', { participantId: this.id, eta });
  }

  setMiles(miles: number | null): WireMutation {
    return this.activity.mutate('setMiles', { participantId: this.id, miles });
  }
}

export class CommandParticipant extends FieldParticipant<ParticipantRec> {
  declare readonly activity: CommandActivity;

  constructor(activity: CommandActivity, id: string) {
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

  get team(): CommandTeam | undefined {
    const t = this.target;
    return t?.kind === 'team' ? this.activity.team(t.id) : undefined;
  }

  assign(target: Target | null, options: { asLeader?: boolean; at?: number } = {}): WireMutation {
    return this.activity.mutate('assign', { participantId: this.id, target, asLeader: options.asLeader, at: options.at });
  }
}

// --- Teams ------------------------------------------------------------------------------------

/** Field viewers see a team's name only. */
export class FieldTeam<R extends FieldTeamRec = FieldTeamRec> {
  constructor(
    readonly activity: FieldActivity,
    readonly id: string,
  ) {
    makeObservable(this, { record: computed, name: computed });
  }

  get record(): R | undefined {
    return this.activity.store.get<TeamRec>('team', this.id) as R | undefined;
  }

  get name(): string {
    return this.record?.name ?? '';
  }
}

export class CommandTeam extends FieldTeam<TeamRec> {
  declare readonly activity: CommandActivity;

  constructor(activity: CommandActivity, id: string) {
    super(activity, id);
    makeObservable(this, {
      status: computed,
      members: computed({ equals: compareShallow }),
      leader: computed,
    });
  }

  get status(): TeamStatus {
    return teamStatusOf(this.activity.store, this.id);
  }

  get members(): CommandParticipant[] {
    return teamMembers(this.activity.store, this.id)
      .map((p) => this.activity.participant(p.id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get leader(): CommandParticipant | undefined {
    const id = this.record?.leaderParticipantId;
    return id ? this.activity.participant(id) : undefined;
  }

  setStatus(status: Exclude<TeamStatus, 'disbanded'>, options: { at?: number } = {}): WireMutation {
    return this.activity.mutate('setTeamStatus', { teamId: this.id, status, at: options.at });
  }
}
