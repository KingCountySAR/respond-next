/**
 * The member directory from cedar, our API in front of D4H (see cedar's API.md). Lookups use cedar's
 * own model (`/api/v1/members/:id`). Search and photos use its D4H passthrough (`/api/d4h/v3`),
 * since v1 has neither. Cedar holds one D4H team; an organization's search finds only the members of
 * its unit there (`providerUnit`, one of cedar's unit titles).
 */
import type { MemberInfo } from '@sync/domain';
import { splitPersonRef, type DirectoryMember, type MemberDirectory, type MemberPhoto } from './members';

/** cedar's member (`GET /api/v1/members/:id`), as much of it as is used here. */
interface CedarMember {
  d4hId: number;
  name: { full: string; first: string; legalFirst?: string; last: string };
  emails: string[];
  phone?: string;
  groups: { title: string }[];
  units: { title: string }[];
}

/** D4H's member, from the passthrough's search. */
interface D4HMember {
  id: number;
  ref?: string;
}

export interface CedarOptions {
  /** cedar's base URL, e.g. `https://cedar.example.org`. */
  url: string;
  /** Hydra's token endpoint, `<issuer>/oauth2/token`. */
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  /** Needs `members.read` (lookups) and `d4h:members.read` (search, photos). */
  scope?: string;
  /** The person-ref source for cedar's members: the member provider's id. */
  source: string;
  fetch?: typeof fetch;
}

const SEARCH_SIZE = 25;
const D4H_STATUS_OPERATIONAL = 'OPERATIONAL';
// cedar reloads from D4H every 5 minutes; members found by search are kept as long.
const MEMBER_TTL_MS = 5 * 60 * 1000;
const TOKEN_EARLY_MS = 60 * 1000;

export class CedarError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class CedarDirectory implements MemberDirectory {
  private readonly fetch: typeof fetch;
  private readonly source: string;
  private token: { value: string; until: number } | undefined;
  private readonly members = new Map<string, { member: CedarMember | null; until: number }>();

  constructor(private readonly options: CedarOptions) {
    this.fetch = options.fetch ?? fetch;
    this.source = options.source;
  }

  async search(query: string, unit?: string): Promise<MemberInfo[]> {
    const params = new URLSearchParams({ search: query, size: String(SEARCH_SIZE), status: D4H_STATUS_OPERATIONAL });
    const found = (await this.json<{ results: D4HMember[] }>(`/api/d4h/v3/members?${params}`)).results ?? [];
    const members = await Promise.all(found.map(async (m) => ({ d4h: m, member: await this.member(String(m.id)) })));
    return members.filter(({ member }) => member && (!unit || member.units.some((u) => u.title === unit))).map(({ d4h, member }) => this.memberInfo(member!, d4h.ref));
  }

  async photo(memberId: string): Promise<MemberPhoto | undefined> {
    if (!/^\d+$/.test(memberId)) return undefined;
    const res = await this.get(`/api/d4h/v3/members/${memberId}/image`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw await this.failure(res);
    return { data: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
  }

  async lookup(personRef: string): Promise<DirectoryMember | undefined> {
    const ref = splitPersonRef(personRef);
    if (!ref || ref.source !== this.source || !/^\d+$/.test(ref.id)) return undefined;
    return this.details(await this.member(ref.id));
  }

  /** cedar matches every one of a member's addresses, ignoring case. */
  async byEmail(email: string): Promise<DirectoryMember | undefined> {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s/]+@[^@\s/]+$/.test(e)) return undefined;
    return this.details(await this.member(e));
  }

  private details(member: CedarMember | null): DirectoryMember | undefined {
    return member ? { member: this.memberInfo(member), units: member.units.map((u) => u.title) } : undefined;
  }

  /** cedar's member by D4H id or email, kept for a while; null when cedar has no such member. */
  private async member(key: string): Promise<CedarMember | null> {
    const cached = this.members.get(key);
    if (cached && cached.until > Date.now()) return cached.member;
    const res = await this.get(`/api/v1/members/${encodeURIComponent(key)}`);
    if (res.status !== 404 && !res.ok) throw await this.failure(res);
    const member = res.status === 404 ? null : ((await res.json()) as CedarMember);
    this.members.set(key, { member, until: Date.now() + MEMBER_TTL_MS });
    return member;
  }

  private memberInfo(m: CedarMember, ref?: string): MemberInfo {
    const id = String(m.d4hId);
    return {
      id,
      personRef: `${this.source}:${id}`,
      label: `${m.name.full}${ref ? ` (${ref})` : ''}`,
      name: m.name.full,
      given_name: m.name.first,
      family_name: m.name.last,
      groups: m.groups.map((g) => g.title),
      email: m.emails[0],
      mobilephone: m.phone,
    };
  }

  private async json<T>(path: string): Promise<T> {
    const res = await this.get(path);
    if (!res.ok) throw await this.failure(res);
    return (await res.json()) as T;
  }

  /** A GET with the bearer token, getting a new token once if cedar refuses the one held. */
  private async get(path: string): Promise<Response> {
    const send = async () => this.fetch(new URL(path, this.options.url), { headers: { Authorization: `Bearer ${await this.accessToken()}` } });
    const res = await send();
    if (res.status !== 401) return res;
    this.token = undefined;
    return send();
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const { clientId, clientSecret, scope = 'members.read d4h:members.read' } = this.options;
    const res = await this.fetch(this.options.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}` },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
    });
    if (!res.ok) throw new CedarError(`cedar token: HTTP ${res.status}`, 502);
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    this.token = { value: body.access_token, until: Date.now() + (body.expires_in ?? 300) * 1000 - TOKEN_EARLY_MS };
    return body.access_token;
  }

  private async failure(res: Response): Promise<CedarError> {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return new CedarError(`cedar: ${body.message ?? body.error ?? `HTTP ${res.status}`}`, 502);
  }
}
