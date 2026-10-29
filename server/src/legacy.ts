/**
 * respond-next's activities and saved locations (its MongoDB, as `mongoexport --jsonArray` writes
 * it) as this app's records. Pure: `import-legacy` reads the files and writes what this returns.
 *
 * Ids carry over where respond-next had them (activities, so `/mission/<id>` links still work;
 * status entries, teams, groups, places, equipment, comms); records it didn't have get ids derived
 * from the activity and what they stand for, so a second run makes the same ones. Legacy
 * organization ids come through each organization's `legacyId`.
 */
import { deriveId, type Rec } from '@sync/core';
import {
  ACTIVITY_RECORD_ID,
  CUSTOM_EQUIPMENT_TYPE_ID,
  DEFAULT_EARLY_SIGN_IN_WINDOW,
  DEFAULT_PLACES,
  GARS,
  SYSTEM_VIEWER,
  equipmentType,
  participantIdFor,
  type Gar,
  type Organization,
  type ParticipantStatus,
  type SavedLocation,
  type Target,
  type TeamStatus,
  type UnitStatus,
} from '@sync/domain';

/** Every imported record's version: each activity is written as one commit. */
export const IMPORT_VERSION = 1;

const BY = SYSTEM_VIEWER.userId;

// respond-next's ParticipantStatus and OrganizationStatus enums, and its team statuses.
const PARTICIPANT_STATUS: Record<number, ParticipantStatus> = {
  0: 'notResponding',
  1: 'remote',
  2: 'standby',
  3: 'responding',
  4: 'clear',
  5: 'staging',
  6: 'assigned',
  7: 'demobilizing',
};
const UNIT_STATUS: Record<number, UnitStatus> = { 0: 'unknown', 1: 'invited', 3: 'standby', 4: 'responding', 5: 'stoodDown' };
const TEAM_STATUS: Record<string, TeamStatus> = {
  'In Base': 'inBase',
  'In Transit': 'inTransit',
  'On Assignment': 'onAssignment',
  'On Scene': 'onScene',
  'Returning To Base': 'returningToBase',
  Disbanded: 'disbanded',
};

type LegacyId = string | number;

/** respond-next's `lastUpdatedBy.id` on entries it added by itself, named "System: <reason>". */
const LEGACY_SYSTEM_ID = 'system';
/** Its reasons, in this app's words (see `addStatus`'s causes); any other is sentence-cased. */
const LEGACY_CAUSES: Record<string, string> = { 'Activity Closed': 'Activity closed', 'Organization Changed': 'Changed units' };

/**
 * Who made a status entry (`byName`), or why (`cause`), from respond-next's `lastUpdatedBy`: nothing
 * for the participant's own. It kept only the last editor, so a corrected entry names its corrector.
 */
function statusAudit(editor: { id: string; name: string } | undefined, participantId: string): { byName?: string; cause?: string } {
  if (!editor || editor.id === participantId) return {};
  if (editor.id === LEGACY_SYSTEM_ID) {
    const reason = editor.name.replace(/^System:s*/, '').trim();
    if (!reason) return {};
    return { cause: LEGACY_CAUSES[reason] ?? reason.charAt(0).toUpperCase() + reason.slice(1).toLowerCase() };
  }
  return editor.name.trim() ? { byName: editor.name.trim() } : {};
}

interface LegacyLocation {
  id?: string;
  title?: string;
  lat?: string;
  lon?: string;
  address?: string;
  description?: string;
  isSaved?: boolean;
}

interface LegacyEquipment {
  id: string;
  type?: string;
  uuid?: string;
  name: string;
}

interface LegacyContainer {
  id: string;
  name: string;
  assignedParticipants?: string[];
  assignedEquipment?: LegacyEquipment[];
}

export interface LegacyActivity {
  id: string;
  idNumber?: string;
  title: string;
  description?: string;
  location?: LegacyLocation;
  mapId?: string;
  ownerOrgId: LegacyId;
  isMission: boolean;
  asMission?: boolean;
  forceStandbyOnly?: boolean | null;
  startTime: number;
  endTime?: number | null;
  /** Infinity ("Open Immediately") comes out of Mongo as null. */
  earlySignInWindow?: number | null;
  removeTime?: number;
  participants: Record<
    string,
    {
      id: string;
      firstname: string;
      lastname: string;
      organizationId: LegacyId;
      /** Newest first. `lastUpdatedBy` (from late 2026) is who last added or edited an entry: a participant, or `system`. */
      timeline: { id?: string; time: number | null; status: number; organizationId: LegacyId; lastUpdatedBy?: { id: string; name: string } }[];
      tags?: string[];
      miles?: number | null;
      eta?: number | null;
    }
  >;
  organizations: Record<string, { id: LegacyId; title: string; rosterName?: string; timeline: { time: number; status: number }[] }>;
  teams?: (LegacyContainer & { gar?: string; status?: string; assignment?: string | null; notes?: string | null; teamLeaderParticipantId?: string | null })[] | null;
  groups?: (LegacyContainer & { leaderId?: string; assignedTeams?: string[] })[] | null;
  places?: (LegacyContainer & { lat?: string; lon?: string; notes?: string })[] | null;
  comms?: { id: string; from?: string; to?: string; message: string; timestamp: number; isAutomated?: boolean; isDeleted?: boolean; isFavorite?: boolean }[] | null;
}

export interface LegacyOrganizations {
  /** The organization with this `legacyId`. */
  byLegacyId(legacyId: string): Organization | undefined;
  /** The organizations with a `legacyId`. */
  all(): Organization[];
  /** The member provider an organization's people come from (its own or an ancestor's). */
  providerOf(orgId: string): string | undefined;
}

export interface Converted {
  id: string;
  records: Rec[];
  /** Data left out or filled in, by kind, for the run's report. */
  notes: string[];
}

/** Why an activity can't be imported; the run stops before writing anything. */
export class ConversionError extends Error {}

/** A legacy string coordinate; blank or unparsable is none. */
function coordinate(value: string | undefined): number | null {
  const n = value === undefined || value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A saved location, or null if it has no title (the catalog requires one). */
export function convertLocation(l: LegacyLocation & { id: string }): SavedLocation | null {
  const title = l.title?.trim();
  if (!title) return null;
  return { id: l.id, title, lat: coordinate(l.lat), lon: coordinate(l.lon), address: l.address || null, description: l.description ?? '' };
}

/** The legacy organization ids an export's activities use, for checking they all map before converting. */
export function legacyOrgIds(activities: LegacyActivity[]): Set<string> {
  const ids = new Set<string>();
  for (const a of activities) {
    ids.add(String(a.ownerOrgId));
    for (const [key, u] of Object.entries(a.organizations ?? {})) ids.add(String(u.id ?? key));
    for (const p of Object.values(a.participants ?? {})) {
      ids.add(String(p.organizationId));
      for (const t of p.timeline) ids.add(String(t.organizationId));
    }
  }
  return ids;
}

export function convertActivity(a: LegacyActivity, orgs: LegacyOrganizations): Converted {
  const notes: string[] = [];
  const records: Rec[] = [];
  const put = (rec: Omit<Rec, 'version'>) => records.push({ ...rec, version: IMPORT_VERSION } as Rec);
  const derived = (...parts: (string | number)[]) => deriveId(['legacy', a.id, ...parts].join(':'));

  /**
   * An organization for a legacy id. A unit's own roster name wins when it names another
   * organization: one legacy id was given to two units, and the activity says which it meant.
   */
  const orgFor = (legacyId: LegacyId, rosterName?: string): Organization => {
    const org = orgs.byLegacyId(String(legacyId));
    if (!org) throw new ConversionError(`no organization has legacyId ${legacyId}`);
    if (rosterName && rosterName !== org.shortTitle) {
      const named = orgs.all().find((o) => o.shortTitle === rosterName);
      if (named) return named;
    }
    return org;
  };

  // Units, keyed as the legacy activity keys them.
  const units = new Map<string, Organization>();
  for (const [key, u] of Object.entries(a.organizations ?? {})) units.set(key, orgFor(u.id ?? key, u.rosterName));
  const unitFor = (legacyId: LegacyId) => units.get(String(legacyId)) ?? orgFor(legacyId);

  const owner = units.get(String(a.ownerOrgId)) ?? orgFor(a.ownerOrgId);
  const location = a.location ?? {};
  put({
    type: 'activity',
    id: ACTIVITY_RECORD_ID,
    idNumber: a.idNumber ?? '',
    // A legacy event run "as a mock mission" is a training here: in full mode, as every import is.
    kind: a.isMission ? 'mission' : 'training',
    title: a.title,
    description: a.description ?? '',
    location: {
      title: location.title ?? '',
      lat: coordinate(location.lat),
      lon: coordinate(location.lon),
      address: location.address || null,
      savedId: location.isSaved && location.id ? location.id : null,
    },
    mapId: a.mapId ?? '',
    startTime: a.startTime,
    endTime: a.endTime ?? null,
    earlySignInWindow: a.earlySignInWindow === undefined ? DEFAULT_EARLY_SIGN_IN_WINDOW : a.earlySignInWindow,
    ownerOrgId: owner.id,
    mode: 'full',
    standbyOnly: a.forceStandbyOnly ?? false,
    // respond-next ended an activity by setting its end time.
    closed: a.endTime != null,
    removedAt: a.removeTime ?? null,
  });

  const unitRecs = new Map<string, Organization>();
  const addUnit = (org: Organization, title: string, rosterName: string | null) => {
    if (unitRecs.has(org.id)) return false;
    unitRecs.set(org.id, org);
    put({ type: 'activityUnit', id: org.id, title, rosterName });
    return true;
  };
  for (const [key, u] of Object.entries(a.organizations ?? {})) {
    const org = units.get(key)!;
    addUnit(org, u.title, u.rosterName ?? null);
    u.timeline.forEach((t, i) => {
      const status = UNIT_STATUS[t.status];
      if (!status) throw new ConversionError(`unit ${key} has status ${t.status}`);
      put({ type: 'unitStatus', id: derived('unitStatus', key, i), unitId: org.id, status, at: t.time, by: BY });
    });
  }

  // Participants, with their legacy id mapped to this app's (derived from the person ref).
  const participantIds = new Map<string, string>();
  const lastStatusAt = new Map<string, number>();
  const statusIds = new Set<string>();
  for (const [legacyId, p] of Object.entries(a.participants ?? {})) {
    const org = unitFor(p.organizationId);
    const provider = orgs.providerOf(org.id);
    let personRef: string;
    if (/^\d+$/.test(p.id) && provider) personRef = `${provider}:${p.id}`;
    else {
      personRef = `adhoc:${p.id}`;
      notes.push(`participant without a member id or provider (${personRef})`);
    }
    const id = participantIdFor(personRef);
    participantIds.set(legacyId, id);
    // Its tags are the ones it had then, from the unit of its latest status (the timeline is newest first).
    const latest = p.timeline.find((t) => t.time != null);
    const memberTagsUnitId = latest ? unitFor(latest.organizationId).id : null;
    put({ type: 'participant', id, personRef, firstname: p.firstname, lastname: p.lastname, memberTags: p.tags ?? [], memberTagsUnitId, activityTags: [], eta: p.eta ?? null, miles: p.miles ?? null });

    p.timeline.forEach((t, i) => {
      if (t.time == null) {
        notes.push('status entry without a time, left out');
        return;
      }
      const status = PARTICIPANT_STATUS[t.status];
      if (!status) throw new ConversionError(`participant ${legacyId} has status ${t.status}`);
      const unit = unitFor(t.organizationId);
      if (addUnit(unit, unit.title, unit.shortTitle)) {
        // As when a unit's first responder signs in: it comes onto the activity responding.
        put({ type: 'unitStatus', id: derived('unitStatus', unit.id), unitId: unit.id, status: 'responding', at: t.time, by: BY });
        notes.push('unit not on the activity, added');
      }
      let statusId = t.id && !statusIds.has(t.id) ? t.id : derived('participantStatus', legacyId, i);
      statusIds.add(statusId);
      put({ type: 'participantStatus', id: statusId, participantId: id, unitId: unit.id, status, at: t.time, by: BY, ...statusAudit(t.lastUpdatedBy, p.id) });
      lastStatusAt.set(id, Math.max(lastStatusAt.get(id) ?? -Infinity, t.time));
    });
  }
  const participantId = (legacyId: string | null | undefined): string | null => {
    if (!legacyId) return null;
    const id = participantIds.get(legacyId);
    if (!id) notes.push('reference to someone not on the activity, dropped');
    return id ?? null;
  };

  // Where people and equipment are: respond-next kept only the current place, without a time, so
  // the assignment is dated at the person's latest status.
  const assign = (container: LegacyContainer, target: Target) => {
    for (const legacyId of container.assignedParticipants ?? []) {
      const id = participantId(legacyId);
      if (!id) continue;
      put({ type: 'assignment', id: derived('assignment', legacyId), participantId: id, target, at: lastStatusAt.get(id) ?? a.startTime, by: BY });
    }
    for (const e of container.assignedEquipment ?? []) {
      const type = equipmentType(e.id) ?? equipmentType(CUSTOM_EQUIPMENT_TYPE_ID)!;
      put({ type: 'equipment', id: e.uuid ?? derived('equipment', target.id, e.id, e.name), typeId: type.id, category: type.category, name: e.name, assignedTo: target });
    }
  };

  const groups = a.groups ?? [];
  const groupOfTeam = new Map<string, string>();
  for (const g of groups) {
    for (const teamId of g.assignedTeams ?? []) groupOfTeam.set(teamId, g.id);
    put({ type: 'group', id: g.id, name: g.name, leaderParticipantId: participantId(g.leaderId) });
    assign(g, { kind: 'group', id: g.id });
  }

  for (const t of a.teams ?? []) {
    const gar: Gar = (GARS as readonly string[]).includes(t.gar ?? '') ? (t.gar as Gar) : 'green';
    put({ type: 'team', id: t.id, name: t.name, gar, assignment: t.assignment || null, notes: t.notes || null, leaderParticipantId: participantId(t.teamLeaderParticipantId), groupId: groupOfTeam.get(t.id) ?? null });
    // Only the current status is known; it's dated at the start.
    const status = TEAM_STATUS[t.status ?? 'In Base'];
    if (!status) throw new ConversionError(`team ${t.id} has status ${t.status}`);
    put({ type: 'teamStatus', id: derived('teamStatus', t.id), teamId: t.id, status, at: a.startTime, by: BY });
    assign(t, { kind: 'team', id: t.id });
  }

  // respond-next added its default places when an activity was first opened for operations; every
  // activity here has them.
  const places = a.places ?? [];
  for (const p of places) {
    put({ type: 'place', id: p.id, name: p.name, lat: coordinate(p.lat), lon: coordinate(p.lon), notes: p.notes || null });
    assign(p, { kind: 'place', id: p.id });
  }
  for (const name of Object.values(DEFAULT_PLACES)) {
    if (!places.some((p) => p.name === name)) put({ type: 'place', id: derived('place', name), name, lat: null, lon: null, notes: null });
  }

  for (const c of a.comms ?? []) {
    put({
      type: 'comm',
      id: c.id,
      from: c.from ?? '',
      to: c.to ?? '',
      message: c.message,
      favorite: c.isFavorite ?? false,
      removed: c.isDeleted ?? false,
      legacy: true,
      ...(c.isAutomated && { automated: true }),
      at: c.timestamp,
      by: BY,
    });
  }

  return { id: a.id, records, notes };
}
