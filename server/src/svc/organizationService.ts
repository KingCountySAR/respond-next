import { ClientEnvironment } from '@app/shared';
import { WithId } from 'mongodb';

import { getDb } from '@server/db/index.js';
import { isD4HProviderDoc, MEMBER_PROVIDER_COLLECTION, MemberProviderDoc } from '@server/db/memberProviderDoc.js';
import { OrganizationDoc, ORGS_COLLECTION } from '@server/db/organizationDoc.js';

import D4HMembersProvider from './member-providers/d4hMembersProvider.js';
import { MemberProvider } from './member-providers/memberProvider.js';

export class OrganizationService {
  private docs: WithId<OrganizationDoc>[] = [];
  private memberProviders: Record<string, MemberProvider> = {};

  constructor() {

  }

  async reload(force?: boolean) {
    if (this.docs.length === 0 || force) {
      const providerDocs = await getDb().collection<MemberProviderDoc>(MEMBER_PROVIDER_COLLECTION).find().toArray();
      this.memberProviders = providerDocs.reduce((lookup, doc) => {
        if (isD4HProviderDoc(doc)) {
          lookup[doc.name] = new D4HMembersProvider(doc);
        } else {
          console.error(`Unknown member provider type for ${doc.name}: ${doc.provider}`);
        }
        return lookup;
      }, {} as Record<string, MemberProvider>);
      this.docs = await getDb().collection<OrganizationDoc>(ORGS_COLLECTION).find().toArray();
    }
  }

  async getOrgForDomain(domain: string): Promise<OrganizationDoc> {
    await this.reload();
    const doc = this.docs.find((f) => f.domain?.toLowerCase() === domain.toLowerCase());
    if (!doc) {
      throw new Error('Not configured for domain ' + domain);
    }
    return doc;
  }

  async getEnvironmentForDomain(domain: string): Promise<ClientEnvironment> {
    const org = await this.getOrgForDomain(domain);

    const result: ClientEnvironment = {
      title: org.title ?? 'Team',
      shortTitle: org?.rosterName ?? org?.title ?? 'Team',
      brand: { ...org.brand },
    };
    return result;
  }

  async getMemberProviderForOrganization(organization: OrganizationDoc): Promise<MemberProvider> {
    const provider = this.memberProviders[organization.memberProvider];
    if (!provider) {
      throw new Error('No member provider found for organization: ' + organization.id);
    }
    return provider;
  }
}
