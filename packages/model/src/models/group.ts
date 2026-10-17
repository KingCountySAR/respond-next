import { compareShallow, computed, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import { groupTeams, type FieldGroupRec, type GroupRec, type Target } from '@sync/domain';
import type { CommandActivity, FieldActivity } from './activity';
import type { CommandEquipment } from './equipment';
import type { CommandKinds, Kinds } from './kinds';
import type { CommandParticipant } from './participant';
import { byName, equipmentModelsAt, type Holder, participantsAt, RecordModel } from './record';
import type { CommandTeam } from './team';

/** Field viewers see a group's name; members also see its leader. */
export class FieldGroup<R extends FieldGroupRec = FieldGroupRec, K extends Kinds = Kinds> extends RecordModel<R, K> implements Holder {
  constructor(activity: FieldActivity<K>, id: string) {
    super(activity, id, 'group');
    makeObservable(this, { name: computed, leader: computed });
  }

  get name(): string {
    return this.record?.name ?? '';
  }

  get leader(): K['participant'] | undefined {
    const id = this.record?.leaderParticipantId;
    return id ? this.activity.participant(id) : undefined;
  }

  get asTarget(): Target {
    return { kind: 'group', id: this.id };
  }
}

export class CommandGroup extends FieldGroup<GroupRec, CommandKinds> {
  declare readonly activity: CommandActivity;

  constructor(activity: FieldActivity<CommandKinds>, id: string) {
    super(activity, id);
    makeObservable(this, {
      teams: computed({ equals: compareShallow }),
      members: computed({ equals: compareShallow }),
      equipment: computed({ equals: compareShallow }),
    });
  }

  get teams(): CommandTeam[] {
    return groupTeams(this.store, this.id)
      .sort(byName)
      .map((t) => this.activity.team(t.id)!);
  }

  /** People held by the group directly, not through its teams. */
  get members(): CommandParticipant[] {
    return participantsAt<CommandKinds>(this.activity, this.asTarget);
  }

  /** Equipment held by the group directly. */
  get equipment(): CommandEquipment[] {
    return equipmentModelsAt<CommandKinds>(this.activity, this.asTarget);
  }

  rename(name: string): WireMutation {
    return this.activity.mutate('updateGroup', { id: this.id, name });
  }

  /** May be anyone on the activity, wherever they are; null clears it. */
  setLeader(participant: CommandParticipant | null): WireMutation {
    return this.activity.mutate('setGroupLeader', { groupId: this.id, participantId: participant?.id ?? null });
  }

  /** Its teams leave the group; people and equipment it holds move to `reassignTo`. */
  delete(reassignTo: Target | null, options: { at?: number } = {}): WireMutation {
    return this.activity.mutate('deleteGroup', { groupId: this.id, reassignTo, at: options.at });
  }
}
