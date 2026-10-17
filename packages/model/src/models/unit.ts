import { computed, computedStruct, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import {
  currentUnitStatus,
  statusCounts,
  type ActivityUnitRec,
  type FieldUnitRec,
  type ParticipantStatus,
  type UnitStatus,
} from '@sync/domain';
import type { CommandActivity, FieldActivity } from './activity';
import type { CommandKinds, Kinds } from './kinds';
import { RecordModel } from './record';

/** Every viewer sees the units taking part and their status. */
export class FieldUnit<R extends FieldUnitRec = FieldUnitRec, K extends Kinds = Kinds> extends RecordModel<R, K> {
  constructor(activity: FieldActivity<K>, id: string) {
    super(activity, id, 'activityUnit');
    makeObservable(this, { status: computed, statusCounts: computedStruct });
  }

  /** The roster name ("CRT") when there is one, else the full title. */
  get name(): string {
    const r = this.record;
    return r ? (r.rosterName ?? r.title) : '';
  }

  get title(): string {
    return this.record?.title ?? '';
  }

  get status(): UnitStatus {
    return currentUnitStatus(this.store, this.id)?.status ?? 'unknown';
  }

  /** People responding under this unit, by status. */
  get statusCounts(): Record<ParticipantStatus, number> {
    return statusCounts(this.store, this.id);
  }
}

export class CommandUnit extends FieldUnit<ActivityUnitRec, CommandKinds> {
  declare readonly activity: CommandActivity;

  setStatus(status: Exclude<UnitStatus, 'unknown'>, options: { at?: number } = {}): WireMutation {
    const unit = this.record;
    if (!unit) throw new Error('This unit is no longer on the activity');
    return this.activity.setUnitStatus(unit, status, options);
  }
}
