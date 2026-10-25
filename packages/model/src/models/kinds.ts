/**
 * Every model takes its level's `Kinds`, so `ManageTeam.group` is a `ManageGroup` without
 * overriding the getter (MobX doesn't allow overriding a computed).
 */
import type { ActivityRec, RespondActivityRec } from '@sync/domain';
import type { ManageEquipment, RespondEquipment } from './equipment';
import type { ManageGroup, RespondGroup } from './group';
import type { ManageParticipant, RespondParticipant } from './participant';
import type { ManagePlace, RespondPlace } from './place';
import type { ManageTeam, RespondTeam } from './team';
import type { ManageUnit, RespondUnit } from './unit';

/** The record and model types one level of the hierarchy uses. */
export interface Kinds {
  activity: RespondActivityRec;
  participant: RespondParticipant;
  team: RespondTeam;
  group: RespondGroup;
  place: RespondPlace;
  unit: RespondUnit;
  equipment: RespondEquipment;
}
export interface ManageKinds extends Kinds {
  activity: ActivityRec;
  participant: ManageParticipant;
  team: ManageTeam;
  group: ManageGroup;
  place: ManagePlace;
  unit: ManageUnit;
  equipment: ManageEquipment;
}
