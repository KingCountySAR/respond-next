import { describe, expect, it } from 'vitest';
import { MIN_ROSTER_ROWS, padRosterEntries, rosterCsv, rosterEntries, type RosterPerson } from '../src/sections/reports/rosterEntries';

const units: Record<string, string> = { crt: 'Cascade Rescue Team', rmr: 'Ridgeline Mountain Rescue' };
const title = (id: string) => units[id] ?? '';

/** A person from oldest-first [status, at, unit?] steps; the roster reads timelines newest first. */
const person = (id: string, steps: [RosterPerson['timeline'][number]['status'], number, string?][], miles: number | null = null): RosterPerson => {
  const timeline = steps.map(([status, at, unitId = 'crt']) => ({ status, at, unitId }));
  return { id, firstname: 'Pat', lastname: id.toUpperCase(), miles, unitId: timeline.at(-1)?.unitId, timeline: timeline.reverse() };
};

const opts = { lastNameFirst: false, showStandby: false };
const stamps = (e: { timestamps: object }) => Object.values(e.timestamps);

describe('roster entries', () => {
  it('stamps each stage of a stint', () => {
    const [e] = rosterEntries([person('a', [['responding', 1], ['staging', 2], ['demobilizing', 3], ['clear', 4]], 7)], title, opts);
    expect(e).toMatchObject({ participantId: 'a', participantName: 'Pat A', organizationName: units.crt, miles: 7 });
    expect(stamps(e!)).toEqual([1, 2, 3, 4]);
  });

  it('starts a new row for each sign in after a sign out, oldest first, with miles on the first', () => {
    const entries = rosterEntries([person('a', [['responding', 1], ['clear', 2], ['responding', 3, 'rmr'], ['staging', 4, 'rmr']], 5)], title, opts);
    expect(entries.map(stamps)).toEqual([
      [1, 0, 0, 2],
      [3, 4, 0, 0],
    ]);
    expect(entries.map((e) => e.organizationName)).toEqual([units.crt, units.rmr]);
    expect(entries.map((e) => e.miles)).toEqual([5, undefined]);
  });

  it('ignores stages out of order', () => {
    // Back to staging after an assignment doesn't move the arrive stamp.
    const [e] = rosterEntries([person('a', [['responding', 1], ['staging', 2], ['assigned', 3], ['staging', 4]])], title, opts);
    expect(stamps(e!)).toEqual([1, 2, 0, 0]);
    expect(rosterEntries([person('b', [['demobilizing', 1]])], title, opts)).toEqual([]);
  });

  it('starts a stint for someone added straight to staging or an assignment, at that time', () => {
    const entries = rosterEntries([person('s', [['staging', 5], ['demobilizing', 6]]), person('t', [['assigned', 7], ['staging', 8]])], title, opts);
    expect(entries.map((e) => [e.participantId, ...stamps(e)])).toEqual([
      ['s', 5, 5, 6, 0],
      ['t', 7, 8, 0, 0],
    ]);
    // Again after a sign out.
    expect(rosterEntries([person('u', [['responding', 1], ['clear', 2], ['assigned', 3]])], title, opts).map(stamps)).toEqual([
      [1, 0, 0, 2],
      [3, 0, 0, 0],
    ]);
  });

  it('adds a row for people who never signed in when standby is included', () => {
    const entries = rosterEntries([person('s', [['standby', 1]])], title, { lastNameFirst: true, showStandby: true });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ participantName: 'S, Pat', organizationName: units.crt, miles: undefined });
    expect(stamps(entries[0]!)).toEqual([0, 0, 0, 0]);
  });

  it('sorts by the name as shown, by unit first when grouped', () => {
    const people = [
      { ...person('z', [['responding', 1]]), firstname: 'Al' },
      { ...person('b', [['responding', 2, 'rmr']]), firstname: 'Cy' },
      { ...person('a10', [['responding', 3]]), firstname: 'Cy' },
      { ...person('a9', [['responding', 4]]), firstname: 'cy' },
    ];
    const names = (o: Partial<typeof opts> & { groupByUnit?: boolean }) => rosterEntries(people, title, { ...opts, ...o }).map((e) => e.participantName);
    expect(names({})).toEqual(['Al Z', 'cy A9', 'Cy A10', 'Cy B']);
    expect(names({ lastNameFirst: true })).toEqual(['A9, cy', 'A10, Cy', 'B, Cy', 'Z, Al']);
    expect(names({ groupByUnit: true })).toEqual(['Al Z', 'cy A9', 'Cy A10', 'Cy B']);
    expect(names({ groupByUnit: true, lastNameFirst: true })).toEqual(['A9, cy', 'A10, Cy', 'Z, Al', 'B, Cy']);
  });

  it('pads to the minimum rows', () => {
    expect(padRosterEntries([])).toHaveLength(MIN_ROSTER_ROWS);
  });

  it('writes the legacy csv, quoting and leaving blanks blank', () => {
    const entries = rosterEntries([{ ...person('a', [['responding', 1]]), firstname: 'Pat "PJ"' }], title, opts);
    expect(rosterCsv(entries, (t) => `t${t}`).split('\r\n')).toEqual([
      '"participant_id","participant_name","organization_name","sign_in","arrive_base","depart_base","sign_out","miles"',
      `"a","Pat ""PJ"" A","${units.crt}","t1","","","","0"`,
    ]);
  });
});
