/**
 * Which member directory answers for whom. An organization uses its nearest member provider up the
 * tree; a person ref (`<provider>:<id>`) names its provider. Each provider in the store gets one
 * directory, cedar or a fixture, built when first needed and again after the provider is changed.
 * Tags and tiers are the organizations' business: each gives its members' groups labels
 * (`memberTags`) and tiers (`memberTiers`).
 */
import { highestTier, type MemberInfo, type MemberProviderConfig } from '@sync/domain';
import { CedarDirectory } from './cedar';
import { FixtureDirectory, fixtureMembers, splitPersonRef, tagsFor, type DirectoryMember, type MemberDetails, type MemberDirectory, type MemberPhoto } from './members';
import type { OrganizationStore } from './organizations';

export function directoryFor(config: MemberProviderConfig): MemberDirectory {
  if (config.kind === 'cedar') {
    const { id, url, tokenUrl, clientId, clientSecret, scope } = config;
    if (!clientSecret) throw new Error(`member provider ${id} has no client secret`);
    return new CedarDirectory({ source: id, url, tokenUrl, clientId, clientSecret, scope });
  }
  // Ids run on across units, so each person ref is one person.
  let next = 1;
  const units = Object.fromEntries(
    Object.entries(config.units).map(([unit, { emailDomain, members }]) => {
      const list = fixtureMembers(config.id, members, emailDomain, next);
      next += list.length;
      return [unit, list];
    }),
  );
  return new FixtureDirectory(units);
}

export class MemberProviders {
  private readonly built = new Map<string, { version: object; directory: MemberDirectory }>();

  constructor(
    private readonly orgs: OrganizationStore,
    private readonly build: (config: MemberProviderConfig) => MemberDirectory = directoryFor,
  ) {}

  /** The organization's members matching the query; undefined when it has no member provider. */
  async search(orgId: string, query: string): Promise<MemberInfo[] | undefined> {
    const directory = this.forOrganization(orgId);
    return directory?.search(query, this.orgs.get(orgId)?.providerUnit ?? undefined);
  }

  async photo(orgId: string, memberId: string): Promise<MemberPhoto | undefined> {
    return this.forOrganization(orgId)?.photo(memberId);
  }

  /** With `unitId`, the tags are only those of that unit and the organizations above it, for someone responding under it. */
  async lookup(personRef: string, unitId?: string): Promise<MemberDetails | undefined> {
    const source = splitPersonRef(personRef)?.source;
    return source ? this.details(source, await this.directory(source)?.lookup(personRef), unitId) : undefined;
  }

  /**
   * Who is signing in with this email: asked of the provider for the email's domain, found up the
   * tree from the organization that domain belongs to, or else of the site's own provider.
   */
  async byEmail(email: string, siteOrgId: string): Promise<MemberDetails | undefined> {
    const domainOrg = this.orgs.forEmail(email);
    const provider = (domainOrg && this.orgs.providerOf(domainOrg.id)) ?? this.orgs.providerOf(siteOrgId);
    return provider ? this.details(provider, await this.directory(provider)?.byEmail(email)) : undefined;
  }

  /**
   * The member's tags and tier, from each organization on their provider that has them, by its unit
   * there, or that has no unit (so has everyone). The highest tier any of them gives wins.
   */
  private details(providerId: string, found: DirectoryMember | undefined, unitId?: string): MemberDetails | undefined {
    if (!found) return undefined;
    const { member } = found;
    const theirs = this.orgs.all().filter((o) => this.orgs.providerOf(o.id) === providerId && (!o.providerUnit || found.units.includes(o.providerUnit)));
    const line = unitId === undefined ? undefined : this.orgs.lineage(unitId).map((o) => o.id);
    const tagging = line ? theirs.filter((o) => line.includes(o.id)) : theirs;
    return {
      member,
      tags: [...new Set(tagging.flatMap((o) => tagsFor(member.groups, o.memberTags)))],
      tier: highestTier(theirs.flatMap((o) => member.groups.flatMap((g) => o.memberTiers[g] ?? []))),
    };
  }

  private forOrganization(orgId: string): MemberDirectory | undefined {
    const provider = this.orgs.providerOf(orgId);
    return provider ? this.directory(provider) : undefined;
  }

  /** Throws when the provider can't be used (no secret, or one SECRETS_KEY can't open). */
  private directory(providerId: string): MemberDirectory | undefined {
    const found = this.orgs.memberProvider(providerId);
    if (!found) return undefined;
    const cached = this.built.get(providerId);
    if (cached?.version === found.version) return cached.directory;
    const directory = this.build(found.config);
    this.built.set(providerId, { version: found.version, directory });
    return directory;
  }
}
