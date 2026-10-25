/**
 * Readable objects over one activity: `activity.phase`, `activity.participants[0].status`, `team.members`.
 * Every derived value is a MobX computed that calls the domain query, so the rules live in one place
 * (`@sync/domain`) and an `observer` component re-renders only when a value it read changes.
 *
 * Two levels, because the views nest: `RespondActivity` is what every viewer can read, and `ManageActivity`
 * extends it with what only managers see and do. A respond record type says which fields a respond
 * viewer gets; fields only members get are optional, because external people don't get them.
 *
 * Writes go through `client.mutate`, never into the observables: the change shows up when the
 * client's next snapshot is applied, which happens synchronously.
 */

import { action, compareShallow, computed, computedStruct, makeObservable, observable } from 'mobx';
import { randomId, type MutationInput, type MutationNamed, type Rec, type WireMutation } from '@sync/core';
import type { ActivityClient } from '../client';
import {
  ACTIVITY_INDEXES,
  activityPhase,
  activityProjector,
  asActivityViewer,
  commLog,
  findParticipantByPersonRef,
  getActivity,
  hasOperations,
  participantIdFor,
  statusCounts,
  type ActivityPhase,
  type ActivityMutation,
  type ActivityRec,
  type ActivityUnitRec,
  type EquipmentRec,
  type GroupRec,
  type ParticipantRec,
  type ParticipantStatus,
  type PlaceRec,
  type Target,
  type TeamRec,
  type UnitStatus,
  type ViewKey,
} from '@sync/domain';
import { Clock } from '../clock';
import { RecordStore } from '../store';
import { Comm } from './comm';
import { ManageEquipment, RespondEquipment } from './equipment';
import { ManageGroup, RespondGroup } from './group';
import type { ManageKinds, Kinds } from './kinds';
import { ManageParticipant, RespondParticipant } from './participant';
import { ManagePlace, RespondPlace } from './place';
import { byEquipment, byName, byPersonName, unitRef, type UnitRef } from './record';
import { ManageTeam, RespondTeam } from './team';
import { ManageUnit, RespondUnit } from './unit';

export interface ActivityModelOptions {
  /** Defaults to the client's server-corrected clock, ticking each second. */
  clock?: Clock;
}

export type ModelKind = Exclude<keyof Kinds, 'activity'>;
type ModelClasses<K extends Kinds> = { [T in ModelKind]: new (activity: RespondActivity<K>, id: string) => K[T] };

const RECORD_TYPE: Record<ModelKind, string> = {
  participant: 'participant',
  team: 'team',
  group: 'group',
  place: 'place',
  unit: 'activityUnit',
  equipment: 'equipment',
};

/** The model for the client's viewer: `ManageActivity` for managers, else `RespondActivity`. */
export function createActivityModel(client: ActivityClient, activityId: string, options?: ActivityModelOptions): RespondActivity {
  return activityProjector.viewKey(client.viewerIn(activityId)) === 'manage' ? new ManageActivity(client, activityId, options) : new RespondActivity(client, activityId, options);
}

export const isManageActivity = (model: RespondActivity): model is ManageActivity => model instanceof ManageActivity;

const byUnitName = (a: ActivityUnitRec, b: ActivityUnitRec) => (a.rosterName ?? a.title).localeCompare(b.rosterName ?? b.title);

/** What every viewer can read and do. */
export class RespondActivity<K extends Kinds = Kinds> {
  readonly store = new RecordStore(ACTIVITY_INDEXES);
  readonly clock: Clock;
  readonly viewKey: ViewKey;
  private readonly models = new Map<string, unknown>();
  private readonly unsubscribe: () => void;
  /** The server has answered and doesn't have it (and it isn't being created here): "Activity not found". */
  missing = false;

  /** The activity must already be open on the client (`await client.open(activityId)`). */
  constructor(
    protected readonly client: ActivityClient,
    readonly activityId: string,
    options: ActivityModelOptions = {},
  ) {
    this.clock = options.clock ?? new Clock(() => client.now());
    this.viewKey = activityProjector.viewKey(client.viewerIn(activityId)) as ViewKey;
    makeObservable<RespondActivity<K>, 'follow'>(this, {
      missing: observable,
      follow: action,
      record: computed,
      phase: computed,
      hasOperations: computed,
      participants: computed({ equals: compareShallow }),
      me: computed,
      teams: computed({ equals: compareShallow }),
      groups: computed({ equals: compareShallow }),
      places: computed({ equals: compareShallow }),
      units: computed({ equals: compareShallow }),
      equipment: computed({ equals: compareShallow }),
      statusCounts: computedStruct,
    });
    this.follow();
    this.unsubscribe = client.subscribe(activityId, () => this.follow());
  }

  private follow(): void {
    this.store.apply(this.client.snapshot(this.activityId));
    this.missing = this.client.missing(this.activityId) && !this.record;
  }

  /** Stops following the client. Doesn't close the activity on the client. */
  dispose(): void {
    this.unsubscribe();
  }

  /** External people get no assignments, so where someone is can't be shown to them. */
  get canSeeAssignments(): boolean {
    return this.viewKey !== 'respond:external';
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
    return this.list<'participant', ParticipantRec>('participant', byPersonName);
  }

  participant(id: string): K['participant'] | undefined {
    return this.lookup('participant', id);
  }

  /** The viewer's own entry, once they've signed in. */
  get me(): K['participant'] | undefined {
    const personRef = asActivityViewer(this.client.viewerIn(this.activityId)).personRef;
    return personRef ? this.participantByRef(personRef) : undefined;
  }

  /** Whoever takes part as this person, e.g. a member found in the directory. */
  participantByRef(personRef: string): K['participant'] | undefined {
    return this.participant(participantIdFor(personRef)) ?? this.participant(findParticipantByPersonRef(this.store, personRef)?.id ?? '');
  }

  /** In name order, numbers by value: Team 2 before Team 10. Disbanded teams included. */
  get teams(): K['team'][] {
    return this.list<'team', TeamRec>('team', byName);
  }

  team(id: string): K['team'] | undefined {
    return this.lookup('team', id);
  }

  get groups(): K['group'][] {
    return this.list<'group', GroupRec>('group', byName);
  }

  group(id: string): K['group'] | undefined {
    return this.lookup('group', id);
  }

  get places(): K['place'][] {
    return this.list<'place', PlaceRec>('place', byName);
  }

  place(id: string): K['place'] | undefined {
    return this.lookup('place', id);
  }

  /** The units taking part, by roster name. */
  get units(): K['unit'][] {
    return this.list<'unit', ActivityUnitRec>('unit', byUnitName);
  }

  unit(id: string): K['unit'] | undefined {
    return this.lookup('unit', id);
  }

  /** Every item, by category and name. */
  get equipment(): K['equipment'][] {
    return this.list<'equipment', EquipmentRec>('equipment', byEquipment);
  }

  equipmentItem(id: string): K['equipment'] | undefined {
    return this.lookup('equipment', id);
  }

  get statusCounts(): Record<ParticipantStatus, number> {
    return statusCounts(this.store);
  }

  /**
   * Signs someone in, or updates them if they're already on the activity. Respond viewers may only
   * sign in themselves.
   */
  addParticipant(person: { personRef: string; firstname: string; lastname: string }, unit: UnitRef, status: Exclude<ParticipantStatus, 'unknown'>, options: { at?: number } = {}): K['participant'] {
    this.mutate('addParticipant', { ...person, unit: unitRef(unit), status, at: options.at });
    return this.participant(findParticipantByPersonRef(this.store, person.personRef)!.id)!;
  }

  /** Any change by name; see `@sync/domain` for names and args. Throws Rejection if refused locally. */
  mutate<N extends ActivityMutation['name']>(name: N, args: MutationInput<MutationNamed<ActivityMutation, N>>): WireMutation {
    return this.client.mutate(this.activityId, name, args);
  }

  /**
   * Makes this level's model for a record. A factory, not a table of classes: K appears only in
   * what it returns, so a `RespondActivity<ManageKinds>` still counts as a `RespondActivity`.
   */
  protected createModel(kind: ModelKind, id: string): K[ModelKind] {
    return new RESPOND_MODELS[kind](this as unknown as RespondActivity, id) as K[ModelKind];
  }

  /** Models are cached by key, so a component holding one keeps the same object. */
  protected cached<M>(key: string, create: () => M): M {
    let m = this.models.get(key) as M | undefined;
    if (!m) this.models.set(key, (m = create()));
    return m;
  }

  private model<T extends ModelKind>(kind: T, id: string): K[T] {
    return this.cached(`${kind}/${id}`, () => this.createModel(kind, id) as K[T]);
  }

  private lookup<T extends ModelKind>(kind: T, id: string): K[T] | undefined {
    return this.store.get(RECORD_TYPE[kind], id) ? this.model(kind, id) : undefined;
  }

  private list<T extends ModelKind, R extends Rec>(kind: T, order: (a: R, b: R) => number): K[T][] {
    return [...this.store.scan<R>(RECORD_TYPE[kind])].sort(order).map((r) => this.model(kind, r.id));
  }
}

/** Managers: every record in full, comms, and the operations actions. */
export class ManageActivity extends RespondActivity<ManageKinds> {
  constructor(client: ActivityClient, activityId: string, options?: ActivityModelOptions) {
    super(client, activityId, options);
    makeObservable(this, { comms: computed({ equals: compareShallow }) });
  }

  /** The comms log, oldest first, without deleted entries. */
  get comms(): Comm[] {
    return commLog(this.store).map((c) => this.commModel(c.id));
  }

  comm(id: string): Comm | undefined {
    return this.store.get('comm', id) ? this.commModel(id) : undefined;
  }

  update(fields: Partial<Pick<ActivityRec, 'idNumber' | 'kind' | 'title' | 'description' | 'location' | 'mapId' | 'startTime' | 'earlySignInWindow' | 'ownerOrgId' | 'mode' | 'standbyOnly'>>): WireMutation {
    return this.mutate('updateActivity', fields);
  }

  /** Everyone still active is cleared at `at`, and the activity becomes read-only. */
  close(options: { at?: number } = {}): WireMutation {
    return this.mutate('closeActivity', { at: options.at });
  }

  reopen(): WireMutation {
    return this.mutate('reopenActivity', {});
  }

  /** Drops the activity from every list. Its records stay. */
  remove(options: { at?: number } = {}): WireMutation {
    return this.mutate('removeActivity', { at: options.at });
  }

  /** Adds the unit to the activity if it isn't on it yet. */
  setUnitStatus(unit: UnitRef, status: Exclude<UnitStatus, 'unknown'>, options: { at?: number } = {}): WireMutation {
    return this.mutate('setUnitStatus', { unit: unitRef(unit), status, at: options.at });
  }

  createTeam(name: string): ManageTeam {
    const id = randomId();
    this.mutate('createTeam', { id, name });
    return this.team(id)!;
  }

  createGroup(name: string): ManageGroup {
    const id = randomId();
    this.mutate('createGroup', { id, name });
    return this.group(id)!;
  }

  createPlace(fields: { name: string; lat?: number | null; lon?: number | null; notes?: string | null }): ManagePlace {
    const id = randomId();
    this.mutate('createPlace', { id, lat: null, lon: null, notes: null, ...fields });
    return this.place(id)!;
  }

  /** An item from `EQUIPMENT_CATALOG`; the custom type needs a `name`. */
  addEquipment(typeId: string, assignedTo: Target | null, options: { name?: string } = {}): ManageEquipment {
    const id = randomId();
    this.mutate('createEquipment', { id, typeId, name: options.name, assignedTo });
    return this.equipmentItem(id)!;
  }

  /** Logs a comms entry. */
  logComm(entry: { from: string; to: string; message: string; at?: number }): Comm {
    const id = randomId();
    this.mutate('addComm', { id, ...entry });
    return this.comm(id)!;
  }

  protected override createModel(kind: ModelKind, id: string): ManageKinds[ModelKind] {
    return new MANAGE_MODELS[kind](this, id);
  }

  private commModel(id: string): Comm {
    return this.cached(`comm/${id}`, () => new Comm(this, id));
  }
}

const RESPOND_MODELS: ModelClasses<Kinds> = {
  participant: RespondParticipant,
  team: RespondTeam,
  group: RespondGroup,
  place: RespondPlace,
  unit: RespondUnit,
  equipment: RespondEquipment,
};

const MANAGE_MODELS: ModelClasses<ManageKinds> = {
  participant: ManageParticipant,
  team: ManageTeam,
  group: ManageGroup,
  place: ManagePlace,
  unit: ManageUnit,
  equipment: ManageEquipment,
};
