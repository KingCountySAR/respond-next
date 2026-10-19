/**
 * A member provider's directory: search, photos and member info. The real one is cedar (`cedar.ts`),
 * our API in front of D4H; dev and tests use a fixture of fictional members. Which directory an
 * organization uses is `memberProviders.ts`'s business.
 */
import type { MemberInfo, TagRules } from '@sync/domain';

export interface MemberPhoto {
  data: Uint8Array;
  contentType: string;
}

/** A member as their directory has them, with the provider's names for their units. */
export interface DirectoryMember {
  member: MemberInfo;
  units: string[];
}

/** A member, with the tags their organizations give their groups (e.g. "Medical" shows as "MED"). */
export interface MemberDetails {
  member: MemberInfo;
  tags: string[];
}

export interface MemberDirectory {
  /** Members whose name or email contains the query; only `unit`'s (the provider's name for it), when given. */
  search(query: string, unit?: string): Promise<MemberInfo[]>;
  photo(memberId: string): Promise<MemberPhoto | undefined>;
  /** The member a person ref names (`<source>:<id>`), if this directory has them. */
  lookup(personRef: string): Promise<DirectoryMember | undefined>;
  /** The member with this email address, if any. */
  byEmail(email: string): Promise<DirectoryMember | undefined>;
}

/** The labels `rules` gives these groups. */
export const tagsFor = (groups: string[], rules: TagRules): string[] => [...new Set(groups.flatMap((g) => rules[g] ?? []))];

/** Splits `<source>:<id>`; undefined without a colon. */
export function splitPersonRef(personRef: string): { source: string; id: string } | undefined {
  const at = personRef.indexOf(':');
  return at < 0 ? undefined : { source: personRef.slice(0, at), id: personRef.slice(at + 1) };
}

/** Members by unit, held in memory. */
export class FixtureDirectory implements MemberDirectory {
  constructor(private readonly units: Record<string, MemberInfo[]>) {}

  async search(query: string, unit?: string): Promise<MemberInfo[]> {
    const list = unit ? (this.units[unit] ?? []) : this.everyone();
    const q = query.trim().toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
  }

  async photo(): Promise<MemberPhoto | undefined> {
    return undefined;
  }

  async lookup(personRef: string): Promise<DirectoryMember | undefined> {
    return this.find((m) => m.personRef === personRef);
  }

  async byEmail(email: string): Promise<DirectoryMember | undefined> {
    const e = email.trim().toLowerCase();
    return this.find((m) => m.email?.toLowerCase() === e);
  }

  private everyone(): MemberInfo[] {
    return Object.values(this.units).flat();
  }

  private find(match: (m: MemberInfo) => boolean): DirectoryMember | undefined {
    for (const [unit, members] of Object.entries(this.units)) {
      const member = members.find(match);
      if (member) return { member, units: [unit] };
    }
    return undefined;
  }
}

export type MemberSeed = [given: string, family: string, ...groups: string[]];

/** Members from `[given, family, ...groups]` seeds, with ids `first`, `first + 1`, ... under `source`. */
export function fixtureMembers(source: string, seeds: MemberSeed[], domain = 'example.org', first = 1): MemberInfo[] {
  return seeds.map(([given, family, ...groups], i) => {
    const id = String(first + i);
    const email = `${given}.${family}@${domain}`.toLowerCase();
    return { id, personRef: `${source}:${id}`, label: `${given} ${family} (${email})`, name: `${given} ${family}`, given_name: given, family_name: family, groups, email };
  });
}
