import mongoPromise from '@respond/lib/server/mongodb';
import { MemberProviderConfig, OrganizationDoc, ORGS_COLLECTION } from '@respond/types/data/organizationDoc';
import { ParticipantInfo } from '@respond/types/participant';

import { MemberAuthInfo, MemberInfo, MemberProvider } from './memberProvider';

const D4H_MEMBER_REFRESH_SECS = 15 * 60;
const D4H_FETCH_LIMIT = 1000;
const D4H_CACHE_COLLECTION = 'd4hCache';

interface CustomFieldValue {
  customField: { id: number };
  value: string;
}

interface CustomFieldDef {
  id: number;
  title: string;
}

interface Group {
  id: number;
  title: string;
}

interface D4HMemberResponse {
  id: number;
  ref?: string;
  name: string;
  email?: { value: string };
  mobile?: { phone: string };
  customFieldValues: CustomFieldValue[];
}

interface D4HMember {
  response: D4HMemberResponse;
  memberInfo: MemberInfo;
}

interface D4HGroupMembership {
  group: { id: number };
  member: { id: number };
}

interface FetchForTokenEntry {
  lastFetch: number;
  lookup: { [d4hId: string]: D4HMember };
  authEmailToD4HId: { [email: string]: string };
}

interface D4HCacheDoc extends FetchForTokenEntry {
  token: string;
}

export default class D4HMembersProvider implements MemberProvider {
  initialized: boolean = false;
  fetching: boolean = false;
  lastFetch: number = 0;
  devNetworkDisabled: boolean = false;

  readonly tokenFetchInfo: { [token: string]: FetchForTokenEntry } = {};

  async getMemberInfoById(memberId: string) {
    await this.initialize();

    const d4hMember = Object.values(this.tokenFetchInfo)
      .map((f) => f.lookup[memberId])
      ?.find((f) => f.memberInfo);
    return d4hMember?.memberInfo;
  }

  async getMemberPhoto(memberId: string) {
    await this.initialize();

    for (const token in this.tokenFetchInfo) {
      const [teamId, v3Token] = token.split(':');
      const member = this.tokenFetchInfo[token].lookup[memberId].response;
      if (!member) continue;
      const response = await fetch(`https://api.team-manager.us.d4h.com/v3/team/${teamId}/members/${member.id}/image`, {
        headers: {
          Authorization: `Bearer ${v3Token}`,
        },
      });
      return await response.arrayBuffer();
    }
  }

  async getParticipantInfo(memberId: string) {
    await this.initialize();
    for (const token in this.tokenFetchInfo) {
      const member = this.tokenFetchInfo[token].lookup[memberId].response;
      if (!member) continue;
      const result: ParticipantInfo = {
        email: member.email?.value,
        mobilephone: member.mobile?.phone,
      };
      return result;
    }
  }

  async getMemberInfo(organizationId: string, auth: MemberAuthInfo): Promise<MemberInfo | undefined> {
    await this.initialize();

    const mongo = await mongoPromise;
    const organization = await mongo.db().collection<OrganizationDoc>(ORGS_COLLECTION).findOne({ id: organizationId });
    if (!organization) {
      throw new Error('Unknown Organization');
    }

    const config = organization?.memberProvider as MemberProviderConfig;
    if (!config || !config.token) {
      console.log('Could not find memberProvider config or D4H token for org ' + organizationId);
      throw new Error('Invalid Configuration');
    }

    if (!this.tokenFetchInfo[config.token]) {
      throw new Error('Server is out of sync with member database');
    }

    const info = this.tokenFetchInfo[config.token]?.lookup[this.tokenFetchInfo[config.token]?.authEmailToD4HId?.[auth.email]]?.memberInfo;
    if (info) {
      return {
        ...info,
        id: `${organizationId}:${info.id}`,
      };
    } else {
      return undefined;
    }
  }

  private async initialize() {
    if (this.initialized) {
      return;
    }

    this.devNetworkDisabled = !!process.env.DEV_NETWORK_DISABLED;

    const mongo = await mongoPromise;
    const rows = await mongo.db().collection<D4HCacheDoc>(D4H_CACHE_COLLECTION).find({}).toArray();
    rows.forEach((row) => {
      const { token, ...rest } = row;
      this.tokenFetchInfo[token] = rest;
    });

    if (rows.length == 0) {
      await this.refresh();
    }
    this.initialized = true;
  }

  async refresh(force?: boolean) {
    if (this.devNetworkDisabled) {
      console.log('## D4H Network access disabled by DEV_NETWORK_DISABLED');
      return { ok: true, runtime: 0, cached: true };
    }

    if (this.fetching) {
      return { ok: true, runtime: 0, cached: true };
    }
    const window = new Date().getTime() - D4H_MEMBER_REFRESH_SECS * 1000;
    const expired = window > this.lastFetch;
    if (!(force || expired)) {
      return { ok: true, runtime: 0, cached: true };
    }
    this.fetching = true;

    try {
      const start = new Date().getTime();
      const tokenOrgs: { [token: string]: number[] } = {};
      const moreEmails: { [token: string]: string } = {};

      const mongo = await mongoPromise;
      (await mongo.db().collection(ORGS_COLLECTION).find({}).toArray())
        .filter((o) => o.memberProvider?.provider === 'D4HMembers')
        .forEach((org) => {
          const token = org.memberProvider.token;

          tokenOrgs[token] = [...(tokenOrgs[token] ?? []), org.id];
          moreEmails[token] = org.memberProvider.moreEmailsLabel ?? 'Secondary Email';
        });

      for (const token in tokenOrgs) {
        await this.refreshMembersForToken(token, moreEmails[token]);
      }

      this.lastFetch = new Date().getTime();

      return {
        ok: true,
        runtime: new Date().getTime() - start,
      };
    } finally {
      this.fetching = false;
    }
  }

  private async refreshMembersForToken(token: string, moreEmailsLabel?: string) {
    const [teamId, v3Token] = token.split(':');
    let page: number = 0;
    let totalSize: number = 0;

    let customFieldDefs: CustomFieldDef[] = [];
    do {
      const chunk = await (
        await fetch(`https://api.team-manager.us.d4h.com/v3/team/${teamId}/custom-fields?size=${D4H_FETCH_LIMIT}&page=${page}`, {
          headers: {
            Authorization: `Bearer ${v3Token}`,
          },
        })
      ).json();

      totalSize = chunk.totalSize;
      customFieldDefs = customFieldDefs.concat(chunk.results);
      page = chunk.page + 1;
    } while (customFieldDefs.length < totalSize);
    const customFieldNames = customFieldDefs.reduce((accum, cur) => ({ ...accum, [cur.id]: cur.title }), {} as { [id: number]: string });

    let groupRows: Group[] = [];
    do {
      const chunk = await (
        await fetch(`https://api.team-manager.us.d4h.com/v3/team/${teamId}/member-groups?size=${D4H_FETCH_LIMIT}&page=${page}`, {
          headers: {
            Authorization: `Bearer ${v3Token}`,
          },
        })
      ).json();

      totalSize = chunk.totalSize;
      groupRows = groupRows.concat(chunk.results);
      page = chunk.page + 1;
    } while (groupRows.length < totalSize);

    const groupLookup = groupRows.reduce((accum, cur) => ({ ...accum, [cur.id]: cur.title }), {} as { [id: number]: string });

    let rows: D4HMemberResponse[] = [];
    page = 0;
    do {
      const url = `https://api.team-manager.us.d4h.com/v3/team/${teamId}/members?size=${D4H_FETCH_LIMIT}&page=${page}`;
      const chunk = await (
        await fetch(url, {
          headers: {
            Authorization: `Bearer ${v3Token}`,
          },
        })
      ).json();
      totalSize = chunk.totalSize;
      rows = rows.concat(chunk.results);
      page = chunk.page + 1;
    } while (rows.length < totalSize);

    const emailLookup: { [authEmail: string]: string } = {};

    let memberships: D4HGroupMembership[] = [];
    page = 0;
    do {
      const url = `https://api.team-manager.us.d4h.com/v3/team/${teamId}/member-group-memberships?size=${D4H_FETCH_LIMIT}&page=${page}`;
      const chunk = await (
        await fetch(url, {
          headers: {
            Authorization: `Bearer ${v3Token}`,
          },
        })
      ).json();

      totalSize = chunk.totalSize;
      memberships = memberships.concat(chunk.results);
      page = chunk.page + 1;
    } while (memberships.length < totalSize);

    const lookup = rows.reduce(
      (accum, cur) => {
        const memberInfo: MemberInfo = {
          id: cur.id + '',
          groups: memberships
            .filter((f) => f.member.id === cur.id)
            .map((f) => groupLookup[f.group.id])
            .filter((f) => !!f),
        };

        const member: D4HMember = {
          response: cur,
          memberInfo: memberInfo,
        };

        if (cur.email) {
          emailLookup[cur.email.value] = member.memberInfo.id;
        }
        if (moreEmailsLabel) {
          const moreEmails = ((cur.customFieldValues?.find((f) => customFieldNames[f.customField.id] === moreEmailsLabel)?.value as string) ?? '').split(/[;, /]+/);
          moreEmails.forEach((email) => (emailLookup[email] = member.memberInfo.id));
        }

        return { ...accum, [cur.id]: member };
      },
      {} as { [d4hId: number]: D4HMember },
    );

    this.tokenFetchInfo[token] = {
      lastFetch: new Date().getTime(),
      lookup,
      authEmailToD4HId: emailLookup,
    };

    const mongo = await mongoPromise;
    await mongo
      .db()
      .collection<D4HCacheDoc>(D4H_CACHE_COLLECTION)
      .replaceOne({ token }, { token, ...this.tokenFetchInfo[token] }, { upsert: true });
  }
}
