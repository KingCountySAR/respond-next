import { compareShallow, computed, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import {
  teamStatusOf,
  type FieldParticipantRec,
  type FieldTeamRec,
  type Gar,
  type Target,
  type TeamRec,
  type TeamStatus,
} from '@sync/domain';
import type { CommandActivity, FieldActivity } from './activity';
import type { CommandEquipment } from './equipment';
import type { CommandGroup } from './group';
import type { CommandKinds, Kinds } from './kinds';
import type { CommandParticipant, FieldParticipant } from './participant';
import { equipmentModelsAt, type Holder, participantsAt, RecordModel } from './record';

/** Field viewers see a team's name only. */
export class FieldTeam<R extends FieldTeamRec = FieldTeamRec, K extends Kinds = Kinds> extends RecordModel<R, K> implements Holder {
  constructor(activity: FieldActivity<K>, id: string) {
    super(activity, id, 'team');
    makeObservable(this, { name: computed });
  }

  get name(): string {
    return this.record?.name ?? '';
  }

  get asTarget(): Target {
    return { kind: 'team', id: this.id };
  }
}

export class CommandTeam extends FieldTeam<TeamRec, CommandKinds> {
  declare readonly activity: CommandActivity;

  constructor(activity: FieldActivity<CommandKinds>, id: string) {
    super(activity, id);
    makeObservable(this, {
      status: computed,
      members: computed({ equals: compareShallow }),
      leader: computed,
      group: computed,
      equipment: computed({ equals: compareShallow }),
    });
  }

  get status(): TeamStatus {
    return teamStatusOf(this.store, this.id);
  }

  get gar(): Gar | undefined {
    return this.record?.gar;
  }

  /** The team's task, as free text. */
  get assignment(): string | null {
    return this.record?.assignment ?? null;
  }

  get notes(): string | null {
    return this.record?.notes ?? null;
  }

  get members(): CommandParticipant[] {
    return participantsAt<CommandKinds>(this.activity, this.asTarget);
  }

  get leader(): CommandParticipant | undefined {
    const id = this.record?.leaderParticipantId;
    return id ? this.activity.participant(id) : undefined;
  }

  get group(): CommandGroup | undefined {
    const id = this.record?.groupId;
    return id ? this.activity.group(id) : undefined;
  }

  get equipment(): CommandEquipment[] {
    return equipmentModelsAt<CommandKinds>(this.activity, this.asTarget);
  }

  /** Blank text clears `assignment` and `notes`. */
  update(fields: { name?: string; gar?: Gar; assignment?: string | null; notes?: string | null }): WireMutation {
    return this.activity.mutate('updateTeam', { id: this.id, ...fields });
  }

  setStatus(status: Exclude<TeamStatus, 'disbanded'>, options: { at?: number } = {}): WireMutation {
    return this.activity.mutate('setTeamStatus', { teamId: this.id, status, at: options.at });
  }

  /** The leader must be on the team; null clears it. */
  setLeader(participant: FieldParticipant<FieldParticipantRec, CommandKinds> | null): WireMutation {
    return this.activity.mutate('setTeamLeader', { teamId: this.id, participantId: participant?.id ?? null });
  }

  /**
   * Into a group, or out of one with null. If the team holds its old group's leader, pass a
   * `newLeader` for that group or `disbandGroup`.
   */
  moveToGroup(group: CommandGroup | null, options: { newLeader?: CommandParticipant; disbandGroup?: boolean; at?: number } = {}): WireMutation {
    return this.activity.mutate('setTeamGroup', { teamId: this.id, groupId: group?.id ?? null, newLeaderId: options.newLeader?.id, disbandGroup: options.disbandGroup, at: options.at });
  }

  /** Ends the team: members and equipment move to `reassignTo`. The team keeps its history. */
  disband(reassignTo: Target | null, options: { at?: number } = {}): WireMutation {
    return this.activity.mutate('disbandTeam', { teamId: this.id, reassignTo, at: options.at });
  }

  /** For a team made by mistake. Members and equipment move to `reassignTo`. */
  delete(reassignTo: Target | null, options: { at?: number } = {}): WireMutation {
    return this.activity.mutate('deleteTeam', { teamId: this.id, reassignTo, at: options.at });
  }
}
