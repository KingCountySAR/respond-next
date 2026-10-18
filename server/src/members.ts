/**
 * Where member search and photos come from. The real directories (the legacy D4H and database
 * providers) need the network and credentials, so for now there's a fixture directory: a JSON file
 * of members per unit, or a fictional roster for the site's own unit.
 */
import { readFileSync } from 'node:fs';
import type { MemberInfo } from '@sync/domain';

export interface MemberDirectory {
  /** Members of the unit whose name or email contains the query; undefined if the unit has no directory. */
  search(unitId: string, query: string): Promise<MemberInfo[] | undefined>;
  photo(unitId: string, memberId: string): Promise<Uint8Array | undefined>;
}

export class FixtureDirectory implements MemberDirectory {
  constructor(private readonly members: Record<string, MemberInfo[]>) {}

  async search(unitId: string, query: string): Promise<MemberInfo[] | undefined> {
    const list = this.members[unitId];
    if (!list) return undefined;
    const q = query.trim().toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
  }

  async photo(): Promise<Uint8Array | undefined> {
    return undefined;
  }
}

type MemberSeed = [given: string, family: string, groups?: string[]];

// Fictional people, so the dev site doesn't look like any real unit's roster.
const DEV_ROSTER: MemberSeed[] = [
  ['Avery', 'Lindqvist', ['Field']],
  ['Bo', 'Okafor', ['Field', 'Medical']],
  ['Casey', 'Moreau', ['Field', 'K9']],
  ['Devon', 'Achterberg', ['Base']],
  ['Emery', 'Nakashima', ['Field', 'Rope']],
  ['Frankie', 'Delacroix', ['Field']],
  ['Gray', 'Abernathy', ['Field', 'Medical']],
  ['Harper', 'Okonkwo', ['Base', 'Comms']],
  ['Indy', 'Castellanos', ['Field']],
  ['Jules', 'Varga', ['Field', 'Rope']],
  ['Kai', 'Lindqvist', ['Field']],
  ['Logan', 'Pemberton', ['Base']],
];

/** A unit's members from `[given, family, groups]` seeds, with ids 1, 2, ... under `source`. */
export function fixtureMembers(source: string, seeds: MemberSeed[], domain = 'example.org'): MemberInfo[] {
  return seeds.map(([given, family, groups = []], i) => {
    const id = String(i + 1);
    const email = `${given}.${family}@${domain}`.toLowerCase();
    return { id, personRef: `${source}:${id}`, label: `${given} ${family} (${email})`, name: `${given} ${family}`, given_name: given, family_name: family, groups, email };
  });
}

/**
 * The dev directory: MEMBERS_FILE (JSON, `{ [unitId]: MemberInfo[] }`) if set, else the fictional
 * roster for the site's unit, under the person-ref source the dev sign-in uses.
 */
export function devDirectory(siteUnitId: string, source = 'kcsara'): FixtureDirectory {
  const file = process.env.MEMBERS_FILE;
  if (file) return new FixtureDirectory(JSON.parse(readFileSync(file, 'utf8')) as Record<string, MemberInfo[]>);
  return new FixtureDirectory({ [siteUnitId]: fixtureMembers(source, DEV_ROSTER) });
}
