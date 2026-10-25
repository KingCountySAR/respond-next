/** What every per-record model shares, and the helpers they use. */

import { computed, makeObservable } from 'mobx';
import type { Rec } from '@sync/core';
import { equipmentAt, membersOf, type ActivityUnitRec, type EquipmentRec, type ParticipantRec, type Target } from '@sync/domain';
import type { RecordStore } from '../store';
import type { RespondActivity } from './activity';
import type { Kinds } from './kinds';

/** A unit as the status mutations take it. */
export type UnitRef = Pick<ActivityUnitRec, 'id' | 'title' | 'rosterName'>;
export const unitRef = (u: UnitRef): UnitRef => ({ id: u.id, title: u.title, rosterName: u.rosterName });

/** People and equipment can be at a team, a place or a group, or nowhere (null). */
export type Holder = { readonly asTarget: Target };

export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });
export const byPersonName = (a: Pick<ParticipantRec, 'firstname' | 'lastname'>, b: Pick<ParticipantRec, 'firstname' | 'lastname'>) =>
  a.lastname.localeCompare(b.lastname) || a.firstname.localeCompare(b.firstname);
export const byEquipment = (a: EquipmentRec, b: EquipmentRec) => a.category.localeCompare(b.category) || byName(a, b);

/** One record's model: the record as this viewer sees it, and whether a local change is unconfirmed. */
export abstract class RecordModel<R extends Rec, K extends Kinds> {
  constructor(
    readonly activity: RespondActivity<K>,
    readonly id: string,
    private readonly recordType: string,
  ) {
    makeObservable<RecordModel<R, K>>(this, { record: computed });
  }

  protected get store(): RecordStore {
    return this.activity.store;
  }

  get record(): R | undefined {
    return this.store.get<Rec>(this.recordType, this.id) as R | undefined;
  }

  /** A local change to this record hasn't been confirmed yet. */
  get isPending(): boolean {
    return this.store.isPending(this.recordType, this.id);
  }
}

export function participantsAt<K extends Kinds>(activity: RespondActivity<K>, target: Target): K['participant'][] {
  return membersOf(activity.store, target)
    .sort(byPersonName)
    .map((p) => activity.participant(p.id)!);
}

export function equipmentModelsAt<K extends Kinds>(activity: RespondActivity<K>, target: Target): K['equipment'][] {
  return equipmentAt(activity.store, target)
    .sort(byEquipment)
    .map((e) => activity.equipmentItem(e.id)!);
}
