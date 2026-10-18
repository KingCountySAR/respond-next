/**
 * Activity records, the same for missions, trainings and other activities. An activity is a flat set of these,
 * keyed by (type, id). Timed facts (statuses, assignments) are lists of entries that are only ever
 * added; current state is the latest `at`.
 */
import { z } from 'zod';
import type { Rec } from '@sync/core';

export const PARTICIPANT_STATUSES = ['unknown', 'notResponding', 'standby', 'remote', 'responding', 'staging', 'assigned', 'demobilizing', 'clear'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const UNIT_STATUSES = ['unknown', 'invited', 'notResponding', 'standby', 'responding', 'stoodDown'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** `disbanded` is terminal: a disbanded team keeps its history but takes no new members. */
export const TEAM_STATUSES = ['inBase', 'inTransit', 'onAssignment', 'onScene', 'returningToBase', 'disbanded'] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const GARS = ['green', 'amber', 'red'] as const;
export type Gar = (typeof GARS)[number];

export const ACTIVITY_KINDS = ['mission', 'training', 'other'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_MODES = ['full', 'light'] as const;
export type ActivityMode = (typeof ACTIVITY_MODES)[number];

/** Where a participant or piece of equipment is. */
export const Target = z.object({ kind: z.enum(['team', 'place', 'group']), id: z.string().min(1) });
export type Target = z.infer<typeof Target>;

export const Location = z.object({
  title: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  address: z.string().nullable(),
  /** The saved location (`GET /api/v1/locations`) it was picked from, if any. */
  savedId: z.string().nullable().optional(),
});
export type Location = z.infer<typeof Location>;

/** The single `activity` record in every activity uses this id. */
export const ACTIVITY_RECORD_ID = 'activity';

export interface ActivityRec extends Rec {
  type: 'activity';
  idNumber: string;
  kind: ActivityKind;
  title: string;
  description: string;
  location: Location;
  mapId: string;
  startTime: number;
  endTime: number | null;
  /** How long before startTime self sign-in opens, in ms; null = open at any time. */
  earlySignInWindow: number | null;
  ownerOrgId: string;
  mode: ActivityMode;
  standbyOnly: boolean;
  closed: boolean;
  /** Set when the activity is removed; removed activities drop out of every list. */
  removedAt: number | null;
}

/** A unit (organization) taking part. Its id is the org id, so each unit appears once per activity. */
export interface ActivityUnitRec extends Rec {
  type: 'activityUnit';
  title: string;
  rosterName: string | null;
}

export interface UnitStatusRec extends Rec {
  type: 'unitStatus';
  unitId: string;
  status: UnitStatus;
  at: number;
  by: string;
}

export interface ParticipantRec extends Rec {
  type: 'participant';
  /** `<source>:<id>`, e.g. `kcsara:85205` or `adhoc:<uuid>`. */
  personRef: string;
  firstname: string;
  lastname: string;
  /** From the member database; only system mutations write it. */
  memberTags: string[];
  activityTags: string[];
  eta: number | null;
  miles: number | null;
}

export interface ParticipantStatusRec extends Rec {
  type: 'participantStatus';
  participantId: string;
  /** The unit the participant is responding under. */
  unitId: string;
  status: ParticipantStatus;
  at: number;
  by: string;
}

export interface AssignmentRec extends Rec {
  type: 'assignment';
  participantId: string;
  /** null = unassigned. */
  target: Target | null;
  at: number;
  by: string;
}

export interface TeamRec extends Rec {
  type: 'team';
  name: string;
  gar: Gar;
  assignment: string | null;
  notes: string | null;
  leaderParticipantId: string | null;
  groupId: string | null;
}

export interface TeamStatusRec extends Rec {
  type: 'teamStatus';
  teamId: string;
  status: TeamStatus;
  at: number;
  by: string;
}

/** Contains teams through `team.groupId`; can also hold participants and equipment directly. */
export interface GroupRec extends Rec {
  type: 'group';
  name: string;
  leaderParticipantId: string | null;
}

export interface PlaceRec extends Rec {
  type: 'place';
  name: string;
  lat: number | null;
  lon: number | null;
  notes: string | null;
}

/** One physical item. `typeId` points into EQUIPMENT_CATALOGUE. */
export interface EquipmentRec extends Rec {
  type: 'equipment';
  typeId: string;
  /** The catalogue category (Medical, Rigging, …), copied so reports don't depend on the catalogue. */
  category: string;
  name: string;
  assignedTo: Target | null;
}

export interface CommRec extends Rec {
  type: 'comm';
  from: string;
  to: string;
  message: string;
  favorite: boolean;
  /** Soft delete: the entry stays in the log for the record. */
  removed: boolean;
  /** Imported from the legacy app, including its stored automated messages. */
  legacy?: boolean;
  automated?: boolean;
  at: number;
  by: string;
}

export interface ContactRec extends Rec {
  type: 'contact';
  participantId: string;
  mobile: string | null;
  email: string | null;
}

export type DomainRec =
  | ActivityRec
  | ActivityUnitRec
  | UnitStatusRec
  | ParticipantRec
  | ParticipantStatusRec
  | AssignmentRec
  | TeamRec
  | TeamStatusRec
  | GroupRec
  | PlaceRec
  | EquipmentRec
  | CommRec
  | ContactRec;

export type DomainRecType = DomainRec['type'];

/** Places every new activity starts with; the UI recognizes them by name, as the legacy app does. */
export const DEFAULT_PLACES = { base: 'Command Post', field: 'Field' } as const;
