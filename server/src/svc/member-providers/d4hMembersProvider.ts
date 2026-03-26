import { MemberInfo, ParticipantInfo } from '@app/shared/api';
import { D4HMemberProviderDoc } from '@server/db/memberProviderDoc.js';
import { getDb } from '@server/db/mongo.js';

import { MemberProvider } from './memberProvider.js';

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

interface D4HCache {
  lastFetch: number;
  lookup: { [d4hId: string]: D4HMember };
  authEmailToD4HId: { [email: string]: string };
}

interface D4HCacheDoc extends D4HCache {
  token: string;
}

export default class D4HMembersProvider implements MemberProvider {
  initialized: boolean = false;
  fetching: boolean = false;
  lastFetch: number = 0;
  cache: D4HCache = { lastFetch: 0, lookup: {}, authEmailToD4HId: {} };

  devNetworkDisabled: boolean = false;


  constructor(private readonly config: D4HMemberProviderDoc) {  }

  async findMembers(query: string | undefined): Promise<MemberInfo[]> {
    if (!query || query.length < 3) return [];

    query = query.toLowerCase();
    await this.initialize();
    const matches = Object.values(this.cache.lookup).filter(f => (
      f.response.name.toLowerCase().startsWith(query) ||
      f.response.name.toLowerCase().includes(`, ${query}`) ||
      f.response.email?.value?.toLowerCase()?.startsWith(query)
    ))
      .slice(0, 20)
      .map(row => row.memberInfo);
    return matches;
  }

  async getMemberInfoById(memberId: string) {
    await this.initialize();
    return this.cache.lookup[memberId]?.memberInfo;
  }

  async getMemberPhoto(memberId: string) {
    await this.initialize();

    const response = await fetch(`https://api.team-manager.us.d4h.com/v3/team/${this.config.teamId}/members/${memberId}/image`, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
      },
    });
    return await response.arrayBuffer();
  }

  async getParticipantInfo(memberId: string) {
    await this.initialize();
    const member = this.cache.lookup[memberId].response;

    const result: ParticipantInfo = {
      email: member.email?.value,
      mobilephone: member.mobile?.phone,
    };
    return result;
  }

  async getMemberInfoByEmail(email: string): Promise<MemberInfo | undefined> {
    await this.initialize();
    return this.cache.lookup[this.cache.authEmailToD4HId[email]]?.memberInfo;
  }

  private async initialize() {
    if (this.initialized) {
      return;
    }

    this.devNetworkDisabled = !!process.env.DEV_NETWORK_DISABLED;

    const row = await getDb().collection<D4HCacheDoc>(D4H_CACHE_COLLECTION).findOne({ token: `${this.config.teamId}:${this.config.token}` });
    if (row) {
      const { _id, token, ...rest } = row;
      Object.assign(this.cache, rest);
    } else {
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
      await this.refreshMembers();

      this.lastFetch = new Date().getTime();

      return {
        ok: true,
        runtime: new Date().getTime() - start,
      };
    } catch (err: unknown) {
      console.log('Error refreshing D4HMemberProvider', err);
      throw err;
    } finally {
      this.fetching = false;
    }
  }

  private async refreshMembers() {
    console.log('Refreshing D4H for', this.config.teamId);
    let page: number = 0;
    let totalSize: number = 0;

    let customFieldDefs: CustomFieldDef[] = [];
    do {
      const chunk = await (
        await fetch(`https://api.team-manager.us.d4h.com/v3/team/${this.config.teamId}/custom-fields?size=${D4H_FETCH_LIMIT}&page=${page}`, {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
          },
        })
      ).json();

      totalSize = chunk.totalSize;
      customFieldDefs = customFieldDefs.concat(chunk.results);
      page = chunk.page + 1;
    } while (customFieldDefs.length < totalSize);
    const customFieldNames = customFieldDefs.reduce((accum, cur) => ({ ...accum, [cur.id]: cur.title }), {} as { [id: number]: string });

    let groupRows: Group[] = [];
    page = 0;
    do {
      const chunk = await (
        await fetch(`https://api.team-manager.us.d4h.com/v3/team/${this.config.teamId}/member-groups?size=${D4H_FETCH_LIMIT}&page=${page}`, {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
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
      const url = `https://api.team-manager.us.d4h.com/v3/team/${this.config.teamId}/members?size=${D4H_FETCH_LIMIT}&page=${page}`;
      const chunk = await (
        await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
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
      const url = `https://api.team-manager.us.d4h.com/v3/team/${this.config.teamId}/member-group-memberships?size=${D4H_FETCH_LIMIT}&page=${page}`;
      const chunk = await (
        await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
          },
        })
      ).json();

      totalSize = chunk.totalSize;
      memberships = memberships.concat(chunk.results);
      page = chunk.page + 1;
    } while (memberships.length < totalSize);

    const lookup = rows.reduce(
      (accum, cur) => {
        const nameMatch = cur.name.match(/^ *((?<last>.*), *(?<first>[^,]+)|(?<first2>[^ ]+) +(?<last2>.*)) */);
        const memberInfo: MemberInfo = {
          id: cur.id + '',
          firstname: nameMatch?.groups?.first ?? nameMatch?.groups?.first2 ??cur.name,
          lastname: nameMatch?.groups?.last ?? nameMatch?.groups?.last2 ??'',
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
        if (this.config.moreEmailsField) {
          const moreEmails = ((cur.customFieldValues?.find((f) => customFieldNames[f.customField.id] === this.config.moreEmailsField)?.value as string) ?? '').split(/[;, /]+/);
          moreEmails.forEach((email) => (emailLookup[email] = member.memberInfo.id));
        }

        return { ...accum, [cur.id]: member };
      },
      {} as { [d4hId: number]: D4HMember },
    );

    Object.assign(this.cache, {
      lastFetch: new Date().getTime(),
      lookup,
      authEmailToD4HId: emailLookup
    });

    const token = `${this.config.teamId}:${this.config.token}`;
    await getDb()
      .collection<D4HCacheDoc>(D4H_CACHE_COLLECTION)
      .replaceOne({ token }, { token, ...this.cache }, { upsert: true });
  }
}
