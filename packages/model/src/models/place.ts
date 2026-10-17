import { compareShallow, computed, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import { DEFAULT_PLACES, type FieldPlaceRec, type PlaceRec, type Target } from '@sync/domain';
import type { CommandActivity, FieldActivity } from './activity';
import type { CommandEquipment } from './equipment';
import type { CommandKinds, Kinds } from './kinds';
import type { CommandParticipant } from './participant';
import { equipmentModelsAt, type Holder, participantsAt, RecordModel } from './record';

/** Field viewers see a place's name only. */
export class FieldPlace<R extends FieldPlaceRec = FieldPlaceRec, K extends Kinds = Kinds> extends RecordModel<R, K> implements Holder {
  constructor(activity: FieldActivity<K>, id: string) {
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

export class CommandPlace extends FieldPlace<PlaceRec, CommandKinds> {
  declare readonly activity: CommandActivity;

  constructor(activity: FieldActivity<CommandKinds>, id: string) {
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

  get members(): CommandParticipant[] {
    return participantsAt<CommandKinds>(this.activity, this.asTarget);
  }

  get equipment(): CommandEquipment[] {
    return equipmentModelsAt<CommandKinds>(this.activity, this.asTarget);
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
