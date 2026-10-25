import { computed, computedStruct, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import { targetName, type EquipmentRec, type RespondEquipmentRec, type Target } from '@sync/domain';
import type { ManageActivity, RespondActivity } from './activity';
import type { ManageKinds, Kinds } from './kinds';
import { RecordModel } from './record';

/** Every viewer sees equipment in full; only managers move it. */
export class RespondEquipment<R extends RespondEquipmentRec = RespondEquipmentRec, K extends Kinds = Kinds> extends RecordModel<R, K> {
  constructor(activity: RespondActivity<K>, id: string) {
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

export class ManageEquipment extends RespondEquipment<EquipmentRec, ManageKinds> {
  declare readonly activity: ManageActivity;

  assign(target: Target | null): WireMutation {
    return this.activity.mutate('assignEquipment', { equipmentId: this.id, target });
  }
}
