// import { MongoClient } from 'mongodb';

import { ClientEnvironment } from '@app/shared';
import { WithId } from 'mongodb';

import { getDb } from '@server/db/index.js';
import { OrganizationDoc, ORGS_COLLECTION } from '@server/db/organizationDoc.js';

// import { getDb } from '../db/mongo';

export class OrganizationService {
  private docs: WithId<OrganizationDoc>[] = [];

  constructor() {

  }

  async reload(force?: boolean) {
    if (this.docs.length === 0 || force) {
      this.docs = await getDb().collection<OrganizationDoc>(ORGS_COLLECTION).find().toArray();
    }
  }

  private async getOrgForDomain(domain: string): Promise<OrganizationDoc> {
    await this.reload();
    const doc = this.docs.find((f) => f.domain?.toLowerCase() === domain.toLowerCase());
    if (!doc) {
      throw new Error('Not configured for domain ' + domain);
    }
    return doc;
  }

  async getEnvironmentForDomain(domain: string): Promise<ClientEnvironment> {
    await this.reload();
    const org = await this.getOrgForDomain(domain);

    const result: ClientEnvironment = {
      title: org.title ?? 'Team',
      shortTitle: org?.rosterName ?? org?.title ?? 'Team',
      brand: { ...org.brand },
    };
    return result;
  }
}
