import { compareShallow, computed, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import { DEFAULT_PLACES, type RespondPlaceRec, type PlaceRec, type Target } from '@sync/domain';
import type { ManageActivity, RespondActivity } from './activity';
import type { ManageEquipment } from './equipment';
import type { ManageKinds, Kinds } from './kinds';
import type { ManageParticipant } from './participant';
import { equipmentModelsAt, type Holder, participantsAt, RecordModel } from './record';

/** Respond viewers see a place's name only. */
export class RespondPlace<R extends RespondPlaceRec = RespondPlaceRec, K extends Kinds = Kinds> extends RecordModel<R, K> implements Holder {
  constructor(activity: RespondActivity<K>, id: string) {
    super(activity, id, 'place');
    makeObservable(this, { name: computed });
  }

  get name(): string {
    return this.record?.name ?? '';
  }

  /** The Command Post every activity starts with, recognized by name as the legacy app does. */
  get isBase(): boolean {
    return this.name === DEFAULT_PLACES.base;
  }

  get asTarget(): Target {
    return { kind: 'place', id: this.id };
  }
}

export class ManagePlace extends RespondPlace<PlaceRec, ManageKinds> {
  declare readonly activity: ManageActivity;

  constructor(activity: RespondActivity<ManageKinds>, id: string) {
    super(activity, id);
    makeObservable(this, {
      members: computed({ equals: compareShallow }),
      equipment: computed({ equals: compareShallow }),
    });
  }

  get lat(): number | null {
    return this.record?.lat ?? null;
  }

  get lon(): number | null {
    return this.record?.lon ?? null;
  }

  get notes(): string | null {
    return this.record?.notes ?? null;
  }

  get members(): ManageParticipant[] {
    return participantsAt<ManageKinds>(this.activity, this.asTarget);
  }

  get equipment(): ManageEquipment[] {
    return equipmentModelsAt<ManageKinds>(this.activity, this.asTarget);
  }

  /** Blank notes clear them. */
  update(fields: { name?: string; lat?: number | null; lon?: number | null; notes?: string | null }): WireMutation {
    return this.activity.mutate('updatePlace', { id: this.id, ...fields });
  }

  /** People and equipment here move to `reassignTo`. */
  delete(reassignTo: Target | null, options: { at?: number } = {}): WireMutation {
    return this.activity.mutate('deletePlace', { placeId: this.id, reassignTo, at: options.at });
  }
}
