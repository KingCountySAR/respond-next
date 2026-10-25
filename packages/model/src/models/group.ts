import { compareShallow, computed, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import { groupTeams, type RespondGroupRec, type GroupRec, type Target } from '@sync/domain';
import type { ManageActivity, RespondActivity } from './activity';
import type { ManageEquipment } from './equipment';
import type { ManageKinds, Kinds } from './kinds';
import type { ManageParticipant } from './participant';
import { byName, equipmentModelsAt, type Holder, participantsAt, RecordModel } from './record';
import type { ManageTeam } from './team';

/** Respond viewers see a group's name; members also see its leader. */
export class RespondGroup<R extends RespondGroupRec = RespondGroupRec, K extends Kinds = Kinds> extends RecordModel<R, K> implements Holder {
  constructor(activity: RespondActivity<K>, id: string) {
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

export class ManageGroup extends RespondGroup<GroupRec, ManageKinds> {
  declare readonly activity: ManageActivity;

  constructor(activity: RespondActivity<ManageKinds>, id: string) {
    super(activity, id);
    makeObservable(this, {
      teams: computed({ equals: compareShallow }),
      members: computed({ equals: compareShallow }),
      equipment: computed({ equals: compareShallow }),
    });
  }

  get teams(): ManageTeam[] {
    return groupTeams(this.store, this.id)
      .sort(byName)
      .map((t) => this.activity.team(t.id)!);
  }

  /** People held by the group directly, not through its teams. */
  get members(): ManageParticipant[] {
    return participantsAt<ManageKinds>(this.activity, this.asTarget);
  }

  /** Equipment held by the group directly. */
  get equipment(): ManageEquipment[] {
    return equipmentModelsAt<ManageKinds>(this.activity, this.asTarget);
  }

  rename(name: string): WireMutation {
    return this.activity.mutate('updateGroup', { id: this.id, name });
  }

  /** May be anyone on the activity, wherever they are; null clears it. */
  setLeader(participant: ManageParticipant | null): WireMutation {
    return this.activity.mutate('setGroupLeader', { groupId: this.id, participantId: participant?.id ?? null });
  }

  /** Its teams leave the group; people and equipment it holds move to `reassignTo`. */
  delete(reassignTo: Target | null, options: { at?: number } = {}): WireMutation {
    return this.activity.mutate('deleteGroup', { groupId: this.id, reassignTo, at: options.at });
  }
}
