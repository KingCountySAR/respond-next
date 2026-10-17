/**
 * Every model takes its level's `Kinds`, so `CommandTeam.group` is a `CommandGroup` without
 * overriding the getter (MobX doesn't allow overriding a computed).
 */
import type { ActivityRec, FieldActivityRec } from '@sync/domain';
import type { CommandEquipment, FieldEquipment } from './equipment';
import type { CommandGroup, FieldGroup } from './group';
import type { CommandParticipant, FieldParticipant } from './participant';
import type { CommandPlace, FieldPlace } from './place';
import type { CommandTeam, FieldTeam } from './team';
import type { CommandUnit, FieldUnit } from './unit';

/** The record and model types one level of the hierarchy uses. */
export interface Kinds {
  activity: FieldActivityRec;
  participant: FieldParticipant;
  team: FieldTeam;
  group: FieldGroup;
  place: FieldPlace;
  unit: FieldUnit;
  equipment: FieldEquipment;
}
export interface CommandKinds extends Kinds {
  activity: ActivityRec;
  participant: CommandParticipant;
  team: CommandTeam;
  group: CommandGroup;
  place: CommandPlace;
  unit: CommandUnit;
  equipment: CommandEquipment;
}
