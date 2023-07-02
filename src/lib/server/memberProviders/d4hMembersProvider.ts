import mongoPromise from '@respond/lib/server/mongodb';
import { MemberAuthInfo, MemberInfo, MemberProvider } from "./memberProvider";
import { D4HConfig, OrganizationDoc, ORGANIZATION_COLLECTION } from '@respond/types/data/organizationDoc';

const D4H_MEMBER_REFRESH_SECS = 15 * 60;
const D4H_FETCH_LIMIT = 250;
const D4H_CACHE_COLLECTION = 'd4hCache';

interface D4HMemberResponse {
  id: number,
  ref?: string,
  name: string,
  email?: string,
  mobilephone?: string,
  group_ids?: number[],
  custom_fields: any[],
}

interface D4HMember {
  response: D4HMemberResponse,
  memberInfo: MemberInfo,
}

interface FetchForTokenEntry {
  lastFetch: number,
  lookup: {[d4hId:string]: D4HMember},
  authEmailToD4HId: {[email:string]: string},
}

interface D4HCacheDoc extends FetchForTokenEntry {
  token: string;
}

export default class D4HMembersProvider implements MemberProvider {
  initialized: boolean = false;
  fetching: boolean = false;
  lastFetch: number = 0;
  devNetworkDisabled: boolean = false;

  readonly tokenFetchInfo: {[token: string]: FetchForTokenEntry} = {};

  async getMemberInfoById(memberId: string) {
    await this.initialize();

    const d4hMember = Object.values(this.tokenFetchInfo).map(f => f.lookup[memberId])?.find(f => f.memberInfo);
    return d4hMember?.memberInfo;
  }

  async getMemberInfo(organizationId: string, auth: MemberAuthInfo): Promise<MemberInfo | undefined> {
    await this.initialize();

    const mongo = await mongoPromise;
    const organization = await mongo.db().collection<OrganizationDoc>(ORGANIZATION_COLLECTION).findOne({ id: organizationId });
    if (!organization) {
      throw new Error('Unknown Organization');
    }

    const config = organization?.memberProvider as D4HConfig;
    if (!config || !config.token) {
      console.log("Could not find memberProvider config or D4H token for org " + organizationId);
      throw new Error("Invalid Configuration");
    }

    if (!this.tokenFetchInfo[config.token]) {
      throw new Error("Server is out of sync with member database");
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

    this.devNetworkDisabled = !!process.env.DEV_NETWORK_DISABLED

    const mongo = await mongoPromise;
    const rows = (await mongo.db().collection<D4HCacheDoc>(D4H_CACHE_COLLECTION).find({}).toArray());
    rows.forEach(row => {
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
    const window = (new Date().getTime() - (D4H_MEMBER_REFRESH_SECS * 1000));
    const expired = window > this.lastFetch;
    if (!(force || expired)) {
      return { ok: true, runtime: 0, cached: true };
    }
    this.fetching = true;

    try {
      const start = new Date().getTime();
      const tokenOrgs: {[token:string]: number[]} = {};
      const moreEmails: {[token:string]: string} = {};

      const mongo = await mongoPromise;
      (await mongo.db().collection(ORGANIZATION_COLLECTION).find({}).toArray())
      .filter(o => o.memberProvider?.provider === 'D4HMembers')
      .forEach(org => {
        const token = org.memberProvider.token;
        tokenOrgs[token] = [ ...tokenOrgs[token] ?? [], org.id];
        moreEmails[token] = org.memberProvider.moreEmailsLabel ?? 'Secondary Email';
      })

      for (let token in tokenOrgs) {
        await this.refreshMembersForToken(token, moreEmails[token]);
      }

      this.lastFetch = new Date().getTime();

      return {
        ok: true,
        runtime: (new Date().getTime() - start),
      };
    } finally {
      this.fetching = false;
    }
  }

  private async refreshMembersForToken(token: string, moreEmailsLabel?: string) {
    let offset: number = 0;

    let groupRows: any[] = [];
    do {
      const chunk = (await (await fetch(`https://api.d4h.org/v2/team/groups?limit=${D4H_FETCH_LIMIT}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })).json())?.data as any[];

      offset += D4H_FETCH_LIMIT;
      groupRows = groupRows.concat(chunk);
    } while (offset === groupRows.length);
    const groupLookup = groupRows.reduce((accum, cur) => ({ ...accum, [cur.id]: cur.title }), {} as {[id:number]: string});

    let rows: D4HMemberResponse[] = [];
    offset = 0;
    do {
      const url = `https://api.d4h.org/v2/team/members?include_custom_fields=true&include_details=true&limit=${D4H_FETCH_LIMIT}&offset=${offset}`;
      console.log("Fetching " + url, offset, rows.length);
      const chunk = (await (await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })).json())?.data as D4HMemberResponse[];

      offset += D4H_FETCH_LIMIT;
      rows = rows.concat(chunk);
    } while (offset === rows.length);

    let emailLookup: {[authEmail:string]: string} = {};

    const lookup = rows.reduce((accum, cur) => {

      const memberInfo :MemberInfo = {
        id: cur.id + '',
        groups: cur.group_ids?.reduce((accum, cur) => [ ...accum, groupLookup[cur]], [] as string[]) ?? [],
      };

      const member :D4HMember = {
        response: cur,
        memberInfo: memberInfo,
      };
      
      if (cur.email) {
        emailLookup[cur.email] = member.memberInfo.id;
      }
      if (moreEmailsLabel) {
        const moreEmails = (cur.custom_fields?.find(f => f.label === moreEmailsLabel)?.value as string ?? '').split(/[;, \/]+/);
        moreEmails.forEach(email => emailLookup[email] = member.memberInfo.id);
      }

      return { ...accum, [cur.id]: member };
    }, {} as {[d4hId:number]: D4HMember})


    this.tokenFetchInfo[token] = {
      lastFetch: new Date().getTime(),
      lookup,
      authEmailToD4HId: emailLookup,
    }

    const mongo = await mongoPromise;
    const dbResult = await mongo.db().collection<D4HCacheDoc>(D4H_CACHE_COLLECTION).replaceOne({ token }, { token, ...this.tokenFetchInfo[token] }, { upsert: true });
  }
}