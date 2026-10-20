/** The dashboard's rules that aren't the domain's: orders, counts, names and suggestions, as the legacy dashboard had them. */
import { DEFAULT_PLACES, type Gar, type Priority, type TeamStatus } from '@sync/domain';
import type { CommandActivity, CommandParticipant, CommandTeam, Comm, LogLine } from '@sync/model';

export { TEAM_STATUS_TEXT } from '@sync/domain';

export const TEAM_STATUS_ORDER: TeamStatus[] = ['inBase', 'inTransit', 'onAssignment', 'onScene', 'returningToBase', 'disbanded'];

export const GAR_COLORS: Record<Gar, string> = { green: 'green', amber: 'goldenrod', red: 'darkred' };

/** 24-hour hours and minutes, e.g. 14:05. */
export const format24HourTime = (value: number): string => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);

const byFirstThenLast = (a: CommandParticipant, b: CommandParticipant) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

// --- Teams ----------------------------------------------------------------------------------

/** The lowest n with no "Team n" yet. */
export function nextTeamNumber(names: string[]): number {
  const used = new Set(names.flatMap((name) => /^team\s+(\d+)$/i.exec(name.trim())?.[1] ?? []).map(Number));
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

/** "Team …" names first, then by the letters, then by the first number: Team 2 before Team 10. */
export function compareTeamNames(left: string, right: string): number {
  const name = (s: string) => s.trim();
  const isTeam = (s: string) => /^team\b/i.test(name(s));
  const firstNumber = (s: string): number | null => {
    const match = /\d+/.exec(name(s));
    return match ? Number(match[0]) : null;
  };
  const letters = (s: string) => name(s).replace(/\d+/g, '').trim();

  if (isTeam(left) !== isTeam(right)) return isTeam(left) ? -1 : 1;
  const byLetters = letters(left).localeCompare(letters(right), undefined, { sensitivity: 'base' });
  if (byLetters !== 0) return byLetters;
  const [l, r] = [firstNumber(left), firstNumber(right)];
  if (l != null && r != null && l !== r) return l - r;
  if (l != null && r == null) return -1;
  if (l == null && r != null) return 1;
  return name(left).localeCompare(name(right), undefined, { sensitivity: 'base' });
}

const GAR_PRIORITY: (Gar | undefined)[] = ['red', 'amber', 'green'];

/** Active teams by GAR (red first), then name; disbanded teams last, by name. */
export function sortTeams(left: Pick<CommandTeam, 'name' | 'status' | 'gar'>, right: Pick<CommandTeam, 'name' | 'status' | 'gar'>): number {
  const [ld, rd] = [left.status === 'disbanded', right.status === 'disbanded'];
  if (ld !== rd) return ld ? 1 : -1;
  if (!ld) {
    const byGar = GAR_PRIORITY.indexOf(left.gar) - GAR_PRIORITY.indexOf(right.gar);
    if (byGar !== 0) return byGar;
  }
  return compareTeamNames(left.name, right.name);
}

/** The team leader, then everyone else by name. */
export function teamRoster(team: CommandTeam): { leader: CommandParticipant | undefined; others: CommandParticipant[] } {
  const leader = team.leader;
  return { leader, others: team.members.filter((p) => p.id !== leader?.id).sort(byFirstThenLast) };
}

/** Required, and unique among `others` ignoring case. */
export function uniqueNameError(name: string, others: string[], what: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return `${what} name is required.`;
  if (others.some((o) => o.trim().toLowerCase() === trimmed.toLowerCase())) return `${what} name already exists.`;
  return undefined;
}

// --- Responders -----------------------------------------------------------------------------

/** The header's counts: on their way, waiting at base, and out in the field. */
export function responderSummary(activity: CommandActivity): { responding: number; available: number; field: number } {
  const counts = activity.statusCounts;
  const inField = activity.teams.filter((t) => t.status !== 'inBase' && t.status !== 'disbanded').reduce((n, t) => n + t.members.length, 0);
  const atPlaces = activity.places.filter((p) => p.name !== DEFAULT_PLACES.base).reduce((n, p) => n + p.members.length, 0);
  return { responding: counts.responding, available: counts.staging, field: inField + atPlaces };
}

/** Names, unit and tags, for the responder search. */
export function matchesResponder(p: CommandParticipant, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.record?.firstname, p.record?.lastname, p.unit?.name, ...p.tags].filter(Boolean).join(' ').toLowerCase().includes(q);
}

/**
 * The resource pool: unassigned people who are available (by name), then those still responding
 * (earliest ETA first, unknown ETAs last by name).
 */
export function resourcePool(activity: CommandActivity, query: string): { available: CommandParticipant[]; responding: CommandParticipant[] } {
  const free = activity.participants.filter((p) => !p.target && matchesResponder(p, query));
  const eta = (p: CommandParticipant) => p.record?.eta ?? null;
  return {
    available: free.filter((p) => p.status === 'staging').sort(byFirstThenLast),
    responding: free
      .filter((p) => p.status === 'responding')
      .sort((a, b) => {
        const [ea, eb] = [eta(a), eta(b)];
        if (ea == null && eb == null) return byFirstThenLast(a, b);
        if (ea == null) return 1;
        if (eb == null) return -1;
        return ea - eb || byFirstThenLast(a, b);
      }),
  };
}

// --- Equipment ------------------------------------------------------------------------------

/** "count - name" lines, by name. */
export function countByName(items: { name: string }[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}

/** On scene (teams there), assigned (other teams and groups, with who holds it) and staged (by place). */
export function equipmentSummary(activity: CommandActivity) {
  const onScene = activity.teams.filter((t) => t.status === 'onScene');
  const holders = [...activity.teams.filter((t) => t.status !== 'onScene'), ...activity.groups];
  const assigned = new Map<string, { count: number; holders: Set<string> }>();
  for (const holder of holders) {
    for (const item of holder.equipment) {
      const entry = assigned.get(item.name) ?? { count: 0, holders: new Set<string>() };
      entry.count += 1;
      entry.holders.add(holder.name);
      assigned.set(item.name, entry);
    }
  }
  return {
    onScene: countByName(onScene.flatMap((t) => t.equipment)),
    assigned: [...assigned].sort(([a], [b]) => a.localeCompare(b)).map(([name, { count, holders }]) => ({ name, count, holders: [...holders] })),
    staged: activity.places.filter((p) => p.equipment.length > 0).map((p) => ({ place: p, counts: countByName(p.equipment) })),
  };
}

// --- Comms ----------------------------------------------------------------------------------

const PREDEFINED_COMMS_CONTACTS = ['All Teams', 'Incident Commander'];

/** From/to suggestions: the usual ones, active teams, places, and everyone the log has named. */
export function commsContacts(activity: CommandActivity): string[] {
  const names = new Set<string>(PREDEFINED_COMMS_CONTACTS);
  for (const t of activity.teams) if (t.status !== 'disbanded') names.add(t.name);
  for (const p of activity.places) names.add(p.name);
  for (const c of activity.comms) {
    if (c.from) names.add(c.from);
    if (c.to) names.add(c.to);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** A comms entry, or a line of the activity log, as the comms log shows them together. */
export type LogItem = Comm | LogLine;
export const isComm = (item: LogItem): item is Comm => 'message' in item;

/** What the comms log shows: favorites only, or items at or above a priority (4 shows everything). */
export type CommLevel = 'favorites' | Priority;

/** Comms entries and log lines, oldest first. */
export const mergeLog = (comms: Comm[], lines: LogLine[]): LogItem[] => [...comms, ...lines].sort((a, b) => a.at - b.at);

const searchText = (item: LogItem) => (isComm(item) ? [item.message, item.from, item.to] : [item.text, item.by]);

/** Favorites rank above priority 1, so every level shows them. */
export function filterComms<T extends LogItem>(items: T[], options: { query: string; level: CommLevel }): T[] {
  const q = options.query.trim().toLowerCase();
  const { level } = options;
  return items.filter((c) => (c.favorite || (level !== 'favorites' && c.priority <= level)) && (!q || searchText(c).some((t) => t.toLowerCase().includes(q))));
}

const decimalDegrees = /(\d){1,3}\.(\d)*\s*[,]?\s*[+-]?(\d){1,3}\.(\d)*/g;
const utmCoordinates = /(\d){1,2}([a-zA-Z]){1}\s(\d)*([EW])?\s(\d)*([NS])?/g;

/** Coordinates in a message, to offer as copy chips. */
export function coordinatesIn(message: string): string[] {
  const found = new Set<string>();
  for (const pattern of [decimalDegrees, utmCoordinates]) for (const match of message.matchAll(pattern)) found.add(match[0]);
  return [...found];
}
