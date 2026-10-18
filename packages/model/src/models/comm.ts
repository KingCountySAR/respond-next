import type { WireMutation } from '@sync/core';
import type { CommRec } from '@sync/domain';
import type { CommandActivity } from './activity';
import type { CommandKinds } from './kinds';
import { RecordModel } from './record';

/** A comms log entry. Command only: field viewers get no comms. */
export class Comm extends RecordModel<CommRec, CommandKinds> {
  declare readonly activity: CommandActivity;

  constructor(activity: CommandActivity, id: string) {
    super(activity, id, 'comm');
  }

  get from(): string {
    return this.record?.from ?? '';
  }

  get to(): string {
    return this.record?.to ?? '';
  }

  get message(): string {
    return this.record?.message ?? '';
  }

  get at(): number {
    return this.record?.at ?? 0;
  }

  get favorite(): boolean {
    return this.record?.favorite ?? false;
  }

  /** One of the legacy app's automated messages (imported); none are logged here. */
  get automated(): boolean {
    return this.record?.automated ?? false;
  }

  edit(fields: { from?: string; to?: string; message?: string; at?: number }): WireMutation {
    return this.activity.mutate('editComm', { id: this.id, ...fields });
  }

  setFavorite(favorite: boolean): WireMutation {
    return this.activity.mutate('editComm', { id: this.id, favorite });
  }

  /** The entry stays stored for the record but leaves the log. */
  delete(): WireMutation {
    return this.activity.mutate('deleteComm', { id: this.id });
  }
}
