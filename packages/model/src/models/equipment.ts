import { computed, computedStruct, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import { targetName, type EquipmentRec, type FieldEquipmentRec, type Target } from '@sync/domain';
import type { CommandActivity, FieldActivity } from './activity';
import type { CommandKinds, Kinds } from './kinds';
import { RecordModel } from './record';

/** Every viewer sees equipment in full; only command moves it. */
export class FieldEquipment<R extends FieldEquipmentRec = FieldEquipmentRec, K extends Kinds = Kinds> extends RecordModel<R, K> {
  constructor(activity: FieldActivity<K>, id: string) {
    super(activity, id, 'equipment');
    makeObservable(this, { assignedTo: computedStruct, locationName: computed });
  }

  get name(): string {
    return this.record?.name ?? '';
  }

  /** Medical, Rigging, ... */
  get category(): string {
    return this.record?.category ?? '';
  }

  get assignedTo(): Target | null {
    return this.record?.assignedTo ?? null;
  }

  get locationName(): string {
    return targetName(this.store, this.assignedTo);
  }
}

export class CommandEquipment extends FieldEquipment<EquipmentRec, CommandKinds> {
  declare readonly activity: CommandActivity;

  assign(target: Target | null): WireMutation {
    return this.activity.mutate('assignEquipment', { equipmentId: this.id, target });
  }
}
