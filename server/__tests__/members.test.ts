import { describe, expect, it } from 'vitest';
import type { MemberInfo } from '@sync/domain';
import { MemberProviders } from '../src/memberProviders';
import { OrganizationStore } from '../src/organizations';
import { testApp, testSeed } from './helpers';

type Found = { data?: MemberInfo[]; error?: string };

async function signedIn() {
  const crt = testApp().client();
  await crt.signIn('avery.lindqvist@crt.example.org');
  return crt;
}

describe('member routes', () => {
  it("finds an organization's members by name or email, from its provider up the tree", async () => {
    const crt = await signedIn();
    const byName = await crt.json<Found>('/api/v1/organizations/org-crt/members?query=lindq');
    expect(byName.status).toBe(200);
    expect(byName.body.data!.map((m) => [m.personRef, m.label])).toEqual([
      ['kcsara:1', 'Avery Lindqvist (avery.lindqvist@crt.example.org)'],
      ['kcsara:2', 'Kai Lindqvist (kai.lindqvist@crt.example.org)'],
    ]);
    expect((await crt.json<Found>('/api/v1/organizations/org-crt/members?query=bo.okafor@')).body.data!.map((m) => m.name)).toEqual(['Bo Okafor']);
    // Only the unit's own members: Rowan is RMR's.
    expect((await crt.json<Found>('/api/v1/organizations/org-crt/members?query=pike')).body.data).toEqual([]);
    expect((await crt.json<Found>('/api/v1/organizations/org-rmr/members?query=pike')).body.data!.map((m) => m.personRef)).toEqual(['kcsara:5']);
    // The umbrella has no unit of its own there, so it searches everyone.
    expect((await crt.json<Found>('/api/v1/organizations/org-cvsc/members?query=li')).status).toBe(400);
    expect((await crt.json<Found>('/api/v1/organizations/org-cvsc/members?query=pike')).body.data!.map((m) => m.name)).toEqual(['Rowan Pike']);
  });

  it('holds the query to 3 to 100 characters, as the legacy route did', async () => {
    const crt = await signedIn();
    expect((await crt.request('/api/v1/organizations/org-crt/members?query=li')).status).toBe(400);
    expect((await crt.request(`/api/v1/organizations/org-crt/members?query=${'x'.repeat(101)}`)).status).toBe(400);
  });

  it('is not found for an unknown organization, or a photo the provider lacks', async () => {
    const crt = await signedIn();
    expect((await crt.request('/api/v1/organizations/org-other/members?query=lindq')).status).toBe(404);
    expect((await crt.request('/api/v1/organizations/org-crt/members/1/photo')).status).toBe(404);
  });

  it('needs a session', async () => {
    expect((await testApp().client().request('/api/v1/organizations/org-crt/members?query=lindq')).status).toBe(401);
  });
});

describe('member tags', () => {
  const providers = (umbrellaTags: Record<string, string> = {}) => {
    const seed = testSeed();
    seed.organizations[0]!.memberTags = umbrellaTags;
    return new MemberProviders(OrganizationStore.memory(seed));
  };

  it("come from the member's unit", async () => {
    const members = providers();
    // Bo is in CRT's Medical group, which CRT tags MED.
    expect((await members.lookup('kcsara:3'))?.tags).toEqual(['MED']);
    expect((await members.byEmail('bo.okafor@crt.example.org', 'org-rmr'))?.tags).toEqual(['MED']);
    expect((await members.lookup('kcsara:1'))?.tags).toEqual([]);
  });

  it('and from organizations on the provider without a unit, which have everyone', async () => {
    const members = providers({ Medical: 'MED', Field: 'FLD' });
    expect((await members.lookup('kcsara:1'))?.tags).toEqual(['FLD']);
    expect((await members.lookup('kcsara:3'))?.tags).toEqual(['MED']);
  });
});
